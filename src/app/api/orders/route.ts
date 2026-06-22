import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { createOrderSchema } from '@/lib/validations/order'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

// Supabase JS v2 column-select inference can resolve to `never` in strict mode;
// these helpers cast safely without widening to `any`.
type AsSingle<T> = T | null
type AsList<T> = T[] | null

const ALLOWED_SORT_COLUMNS = new Set(['created_at', 'order_number', 'total_amount_paise'])

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// Strips PostgREST filter-string metacharacters from user input.
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/orders
// Lists orders for the authenticated org with filtering, sorting, and pagination.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  // Accept comma-separated statuses (e.g. "draft,confirmed") or legacy single status.
  const statusParam = sp.get('statuses') ?? sp.get('status')
  const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const customerId = sp.get('customer_id')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)
  const sortByParam = sp.get('sort_by') ?? 'created_at'
  const sortAsc = sp.get('sort_dir') === 'asc'
  const sortBy = ALLOWED_SORT_COLUMNS.has(sortByParam) ? sortByParam : 'created_at'

  const supabase = await createClient()

  // When searching, resolve matching customer IDs first so we can filter orders by
  // customer_id OR order_number — PostgREST can't filter on a joined column value directly.
  let matchedCustomerIds: string[] | null = null
  if (search) {
    const { data: customersRaw } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .ilike('name', `%${search}%`)

    const customers = customersRaw as unknown as AsList<Pick<CustomerRow, 'id'>>
    matchedCustomerIds = customers?.map((c) => c.id) ?? []
  }

  let query = supabase
    .from('orders')
    .select('*, customers(id, name, company_name, phone), products(id, name, unit)', { count: 'exact' })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (statuses.length === 1) query = query.eq('status', statuses[0])
  else if (statuses.length > 1) query = query.in('status', statuses)
  if (customerId) query = query.eq('customer_id', customerId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  if (search && matchedCustomerIds !== null) {
    if (matchedCustomerIds.length > 0) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_id.in.(${matchedCustomerIds.join(',')})`
      )
    } else {
      query = query.ilike('order_number', `%${search}%`)
    }
  }

  query = query.order(sortBy, { ascending: sortAsc }).range(offset, offset + limit - 1)

  const { data: ordersRaw, error, count } = await query

  if (error) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json({ error: 'Failed to fetch orders', code: 'DB_ERROR' }, { status: 500 })
  }

  type OrderListItem = OrderRow & {
    customers: Pick<CustomerRow, 'id' | 'name' | 'company_name' | 'phone'> | null
    products: Pick<ProductRow, 'id' | 'name' | 'unit'> | null
  }
  const orders = ordersRaw as unknown as AsList<OrderListItem>

  return NextResponse.json({
    data: orders,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/orders
// Creates a new order. Returns the existing order if the same request is replayed within one hour.
// Requires: owner or manager role.
// Note: depends on generate_order_number() DB function — see supabase/migrations.
//   CREATE FUNCTION generate_order_number() RETURNS text LANGUAGE sql AS $$
//     SELECT format('ORD-%s-%s', to_char(now(),'YYMM'), lpad(nextval('order_number_seq')::text,3,'0'));
//   $$;
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

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { customer_id, product_id, quantity, unit_price_paise, delivery_date, notes, status } =
    parsed.data
  const total_amount_paise = quantity * unit_price_paise

  // Idempotency key: caller-supplied X-Idempotency-Key header takes precedence;
  // falls back to SHA-256(org_id:customer_id:product_id:quantity:YYYY-MM-DDTHH).
  const callerKey = req.headers.get('x-idempotency-key')?.trim()
  const dateHour = new Date().toISOString().slice(0, 13)
  const idempotencyKey = callerKey
    ? createHash('sha256').update(`${user.org_id}:${callerKey}`).digest('hex')
    : createHash('sha256')
        .update(`${user.org_id}:${customer_id}:${product_id}:${quantity}:${dateHour}`)
        .digest('hex')

  const supabase = await createClient()

  // Return existing order for duplicate requests within the same hour.
  const { data: existingRaw } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', user.org_id)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle()

  const existing = existingRaw as unknown as AsSingle<OrderRow>
  if (existing) {
    return NextResponse.json({ data: existing, idempotent: true }, { status: 200 })
  }

  // Verify customer belongs to this org.
  const { data: customerRaw } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customer_id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!customerRaw) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Verify product belongs to this org.
  const { data: productRaw } = await supabase
    .from('products')
    .select('id')
    .eq('id', product_id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!productRaw) {
    return NextResponse.json({ error: 'Product not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Generate sequential order number from DB sequence via RPC.
  type SeqRpc = (fn: 'generate_order_number') => Promise<{ data: string | null; error: { message: string; code: string } | null }>
  const { data: orderNumber, error: seqErr } = await (adminClient.rpc as unknown as SeqRpc)(
    'generate_order_number'
  )
  if (seqErr || !orderNumber) {
    console.error('[POST /api/orders] generate_order_number rpc failed', seqErr)
    return NextResponse.json(
      { error: 'Failed to generate order number', code: 'SEQ_ERROR' },
      { status: 500 }
    )
  }

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('orders')
    .insert({
      organization_id: user.org_id,
      order_number: orderNumber,
      customer_id,
      product_id,
      quantity,
      unit_price_paise,
      total_amount_paise,
      status,
      delivery_date: delivery_date ?? null,
      notes: notes ?? null,
      source: 'web',
      idempotency_key: idempotencyKey,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    console.error('[POST /api/orders] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create order', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as OrderRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'order',
    entity_id: created.id,
    changes: [
      { field: 'order_number', old_value: null, new_value: created.order_number },
      { field: 'customer_id', old_value: null, new_value: customer_id },
      { field: 'product_id', old_value: null, new_value: product_id },
      { field: 'quantity', old_value: null, new_value: quantity },
      { field: 'unit_price_paise', old_value: null, new_value: unit_price_paise },
      { field: 'total_amount_paise', old_value: null, new_value: total_amount_paise },
      { field: 'status', old_value: null, new_value: status },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
