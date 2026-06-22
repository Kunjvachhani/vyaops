import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { createCustomerSchema } from '@/lib/validations/customer'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']

const ALLOWED_SORT = new Set(['created_at', 'name', 'city'])

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/customers
// Lists customers for the authenticated org. Supports search (name, phone, aliases),
// sort, and pagination. Augments each row with outstanding_amount_paise and last_order_date.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)
  const sortByParam = sp.get('sort_by') ?? 'created_at'
  const sortAsc = sp.get('sort_dir') === 'asc'
  const sortBy = ALLOWED_SORT.has(sortByParam) ? sortByParam : 'created_at'

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (search) {
    // Search name, phone, or any alias element
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  query = query.order(sortBy, { ascending: sortAsc }).range(offset, offset + limit - 1)

  const { data: customersRaw, error, count } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/customers', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to fetch customers', code: 'DB_ERROR' }, { status: 500 })
  }

  const customers = (customersRaw ?? []) as CustomerRow[]

  if (customers.length === 0) {
    return NextResponse.json({
      data: [],
      pagination: { page, limit, total: 0, pages: 0 },
    })
  }

  const customerIds = customers.map((c) => c.id)

  // Fetch outstanding amounts: invoices with unpaid balance grouped by customer
  const { data: invoicesRaw } = await supabase
    .from('invoices')
    .select('customer_id, total_amount_paise, paid_amount_paise, status')
    .eq('organization_id', user.org_id)
    .in('customer_id', customerIds)
    .in('status', ['sent', 'partially_paid', 'overdue'])
    .is('deleted_at', null)

  const invoices = (invoicesRaw ?? []) as unknown as Array<
    Pick<InvoiceRow, 'customer_id' | 'total_amount_paise' | 'paid_amount_paise' | 'status'>
  >

  const outstandingByCustomer: Record<string, number> = {}
  for (const inv of invoices) {
    const balance = inv.total_amount_paise - (inv.paid_amount_paise ?? 0)
    if (balance > 0) {
      outstandingByCustomer[inv.customer_id] =
        (outstandingByCustomer[inv.customer_id] ?? 0) + balance
    }
  }

  // Fetch the most recent order date per customer
  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('customer_id, created_at')
    .eq('organization_id', user.org_id)
    .in('customer_id', customerIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const orders = (ordersRaw ?? []) as unknown as Array<Pick<OrderRow, 'customer_id' | 'created_at'>>

  const lastOrderByCustomer: Record<string, string> = {}
  for (const order of orders) {
    if (!lastOrderByCustomer[order.customer_id]) {
      lastOrderByCustomer[order.customer_id] = order.created_at
    }
  }

  const enriched = customers.map((c) => ({
    ...c,
    outstanding_amount_paise: outstandingByCustomer[c.id] ?? 0,
    last_order_date: lastOrderByCustomer[c.id] ?? null,
  }))

  return NextResponse.json({
    data: enriched,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/customers
// Creates a new customer. Requires owner or manager role.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = createCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const {
    name,
    company_name,
    phone,
    email,
    city,
    state,
    gstin,
    aliases,
    credit_limit_paise,
    payment_terms_days,
    notes,
  } = parsed.data

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('customers')
    .insert({
      organization_id: user.org_id,
      name,
      company_name: company_name ?? null,
      phone: phone ?? null,
      email: email || null,
      city: city ?? null,
      state: state ?? 'Gujarat',
      gstin: gstin || null,
      aliases: aliases ?? [],
      credit_limit_paise: credit_limit_paise ?? 0,
      payment_terms_days: payment_terms_days ?? 30,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    captureWithContext(insertErr ?? new Error('insert returned null'), { action: 'POST /api/customers', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to create customer', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as CustomerRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'customer',
    entity_id: created.id,
    changes: [
      { field: 'name', old_value: null, new_value: name },
      { field: 'phone', old_value: null, new_value: phone ?? null },
      { field: 'city', old_value: null, new_value: city ?? null },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
