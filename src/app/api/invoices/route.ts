import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { computeGst, isIntrastate } from '@/lib/utils/gst'
import { createInvoiceSchema } from '@/lib/validations/invoice'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

// Supabase JS v2 column-select inference can resolve to `never` in strict mode;
// these helpers cast safely without widening to `any`.
type AsSingle<T> = T | null
type AsList<T> = T[] | null

const ALLOWED_SORT_COLUMNS = new Set([
  'due_date',
  'created_at',
  'total_amount_paise',
  'invoice_number',
])

// Statuses that count as "unpaid" — i.e. still owed money and eligible to be overdue.
const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid'] as const

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// Strips PostgREST filter-string metacharacters from user input.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// Today's date in IST as YYYY-MM-DD — the boundary for overdue comparisons.
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// GET /api/invoices
// Lists invoices for the authenticated org with filtering, sorting, and pagination.
// status=overdue is virtual: due_date < today AND status is still unpaid.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const statusParam = sp.get('statuses') ?? sp.get('status')
  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const customerId = sp.get('customer_id')
  const orderId = sp.get('order_id')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)
  // Default sort: most urgent first (earliest due date).
  const sortByParam = sp.get('sort_by') ?? 'due_date'
  const sortBy = ALLOWED_SORT_COLUMNS.has(sortByParam) ? sortByParam : 'due_date'
  const sortAsc = sp.get('sort_dir') !== 'desc'

  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select('*, customers(id, name, company_name, phone)', { count: 'exact' })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  // "overdue" is a virtual status — translate it into a due-date + unpaid filter.
  const wantsOverdue = statuses.includes('overdue')
  const concreteStatuses = statuses.filter((s) => s !== 'overdue')
  const today = istToday()

  if (wantsOverdue && concreteStatuses.length === 0) {
    query = query.lt('due_date', today).in('status', UNPAID_STATUSES as unknown as string[])
  } else if (concreteStatuses.length === 1) {
    query = query.eq('status', concreteStatuses[0])
  } else if (concreteStatuses.length > 1) {
    query = query.in('status', concreteStatuses)
  }

  if (customerId) query = query.eq('customer_id', customerId)
  if (orderId) query = query.eq('order_id', orderId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  if (search) query = query.ilike('invoice_number', `%${search}%`)

  query = query.order(sortBy, { ascending: sortAsc }).range(offset, offset + limit - 1)

  const { data: invoicesRaw, error, count } = await query

  if (error) {
    console.error('[GET /api/invoices]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  type InvoiceListItem = InvoiceRow & {
    customers: Pick<CustomerRow, 'id' | 'name' | 'company_name' | 'phone'> | null
  }
  const rows = (invoicesRaw as unknown as AsList<InvoiceListItem>) ?? []

  // Annotate each row with a derived is_overdue flag for badge rendering.
  const invoices = rows.map((inv) => ({
    ...inv,
    is_overdue:
      (UNPAID_STATUSES as readonly string[]).includes(inv.status) && inv.due_date < today,
  }))

  return NextResponse.json({
    data: invoices,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/invoices
// Creates an invoice from a completed order: copies the line item, computes GST,
// and links back to the order. One active invoice per order (re-create blocked).
// Requires: owner or manager role.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { orderId, taxRate, dueDate, subtotalPaise: subtotalOverride, notes } = parsed.data

  // Idempotency: caller-supplied X-Idempotency-Key header → return existing invoice on retry.
  const callerKey = req.headers.get('x-idempotency-key')?.trim()
  const idempotencyKey = callerKey
    ? createHash('sha256').update(`${user.org_id}:${callerKey}`).digest('hex')
    : null

  const supabase = await createClient()

  if (idempotencyKey) {
    const { data: existingRaw } = await supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', user.org_id)
      .eq('idempotency_key', idempotencyKey)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingRaw) {
      return NextResponse.json(
        { data: existingRaw as unknown as InvoiceRow, idempotent: true },
        { status: 200 }
      )
    }
  }

  // Verify the order belongs to this org and is completed/dispatched (invoiceable).
  const { data: orderRaw } = await supabase
    .from('orders')
    .select('id, status, customer_id, total_amount_paise')
    .eq('id', orderId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const order = orderRaw as unknown as AsSingle<
    Pick<OrderRow, 'id' | 'status' | 'customer_id' | 'total_amount_paise'>
  >
  if (!order) {
    return NextResponse.json({ error: 'Order not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  if (order.status !== 'completed' && order.status !== 'dispatched') {
    return NextResponse.json(
      {
        error: 'Only completed orders can be invoiced',
        code: 'INVALID_ORDER_STATUS',
        details: { status: order.status },
      },
      { status: 422 }
    )
  }

  // Block duplicate invoices for the same order (excludes cancelled).
  const { data: existingRaw } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('organization_id', user.org_id)
    .eq('order_id', orderId)
    .neq('status', 'cancelled')
    .is('deleted_at', null)
    .maybeSingle()

  const existing = existingRaw as unknown as AsSingle<
    Pick<InvoiceRow, 'id' | 'invoice_number' | 'status'>
  >
  if (existing) {
    return NextResponse.json(
      {
        error: 'An invoice already exists for this order',
        code: 'INVOICE_EXISTS',
        details: { invoiceId: existing.id, invoiceNumber: existing.invoice_number },
      },
      { status: 409 }
    )
  }

  // Resolve customer + GSTINs to determine intrastate (CGST/SGST) vs interstate (IGST).
  const { data: customerRaw } = await supabase
    .from('customers')
    .select('id, gstin')
    .eq('id', order.customer_id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const customer = customerRaw as unknown as AsSingle<Pick<CustomerRow, 'id' | 'gstin'>>
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('gstin')
    .eq('id', user.org_id)
    .single()
  const orgGstin = (orgRaw as { gstin: string | null } | null)?.gstin ?? null

  const subtotalPaise = subtotalOverride ?? order.total_amount_paise
  const gst = computeGst(subtotalPaise, taxRate, isIntrastate(orgGstin, customer.gstin))
  const totalPaise = subtotalPaise + gst.totalTaxPaise

  // Generate sequential invoice number from DB sequence via RPC.
  type SeqRpc = (
    fn: 'generate_invoice_number'
  ) => Promise<{ data: string | null; error: { message: string; code: string } | null }>
  const { data: invoiceNumber, error: seqErr } = await (adminClient.rpc as unknown as SeqRpc)(
    'generate_invoice_number'
  )
  if (seqErr || !invoiceNumber) {
    console.error('[POST /api/invoices] generate_invoice_number rpc failed', seqErr)
    return NextResponse.json(
      { error: 'Failed to generate invoice number', code: 'SEQ_ERROR' },
      { status: 500 }
    )
  }

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('invoices')
    .insert({
      organization_id: user.org_id,
      invoice_number: invoiceNumber,
      order_id: orderId,
      customer_id: customer.id,
      subtotal_paise: subtotalPaise,
      tax_rate: taxRate,
      tax_amount_paise: gst.totalTaxPaise,
      total_amount_paise: totalPaise,
      status: 'draft',
      due_date: dueDate,
      notes: notes ?? null,
      idempotency_key: idempotencyKey ?? null,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    console.error('[POST /api/invoices] insert failed', insertErr)
    return NextResponse.json(
      { error: 'Failed to create invoice', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const created = createdRaw as unknown as InvoiceRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'invoice',
    entity_id: created.id,
    changes: [
      { field: 'invoice_number', old_value: null, new_value: created.invoice_number },
      { field: 'order_id', old_value: null, new_value: orderId },
      { field: 'customer_id', old_value: null, new_value: customer.id },
      { field: 'subtotal_paise', old_value: null, new_value: subtotalPaise },
      { field: 'tax_rate', old_value: null, new_value: taxRate },
      { field: 'tax_amount_paise', old_value: null, new_value: gst.totalTaxPaise },
      { field: 'total_amount_paise', old_value: null, new_value: totalPaise },
      { field: 'due_date', old_value: null, new_value: dueDate },
      { field: 'status', old_value: null, new_value: 'draft' },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
