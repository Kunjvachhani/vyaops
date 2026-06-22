import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { buildCsvResponse } from '@/lib/utils/csv-export'
import { formatISTDate } from '@/lib/utils/date'
import { captureWithContext } from '@/lib/utils/sentry'

const EXPORT_LIMIT = 10_000

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/orders/export?statuses=confirmed,completed&date_from=2026-01-01&date_to=2026-06-30
// Exports all orders matching the current filter state as a CSV download.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const statusParam = sp.get('statuses') ?? sp.get('status')
  const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const customerId = sp.get('customer_id')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)

  const supabase = await createClient()

  let matchedCustomerIds: string[] | null = null
  if (search) {
    const { data: customersRaw } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .ilike('name', `%${search}%`)
    matchedCustomerIds = ((customersRaw ?? []) as { id: string }[]).map((c) => c.id)
  }

  type OrderExportRow = {
    order_number: string
    status: string
    quantity: number
    total_amount_paise: number
    created_at: string
    customers: { name: string } | null
    products: { name: string } | null
  }

  let query = supabase
    .from('orders')
    .select('order_number, status, quantity, total_amount_paise, created_at, customers(name), products(name)')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT)

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

  const { data: ordersRaw, error } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/orders/export', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to export orders', code: 'DB_ERROR' }, { status: 500 })
  }

  const orders = (ordersRaw ?? []) as unknown as OrderExportRow[]

  const headers = ['Order#', 'Customer', 'Products', 'Qty', 'Amount(₹)', 'Status', 'Date']
  const rows = orders.map((o) => [
    o.order_number,
    o.customers?.name ?? '',
    o.products?.name ?? '',
    String(o.quantity),
    (o.total_amount_paise / 100).toFixed(2),
    o.status,
    formatISTDate(new Date(o.created_at)),
  ])

  const today = new Date().toISOString().slice(0, 10)
  return buildCsvResponse(headers, rows, `vyaops-orders-${today}.csv`)
}
