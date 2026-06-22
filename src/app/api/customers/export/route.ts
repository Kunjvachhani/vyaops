import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { buildCsvResponse } from '@/lib/utils/csv-export'
import { formatISTDate } from '@/lib/utils/date'
import { captureWithContext } from '@/lib/utils/sentry'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']

const EXPORT_LIMIT = 10_000

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/customers/export?search=patel
// Exports all customers matching the current filter state as a CSV download.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('id, name, company_name, phone, city, state, gstin, created_at')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT)

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  const { data: customersRaw, error } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/customers/export', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to export customers', code: 'DB_ERROR' }, { status: 500 })
  }

  const customers = (customersRaw ?? []) as unknown as Pick<
    CustomerRow,
    'id' | 'name' | 'company_name' | 'phone' | 'city' | 'state' | 'gstin' | 'created_at'
  >[]

  if (customers.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    return buildCsvResponse(
      ['Name', 'City', 'Phone', 'GSTIN', 'Outstanding(₹)', 'Last Order'],
      [],
      `vyaops-customers-${today}.csv`
    )
  }

  const customerIds = customers.map((c) => c.id)

  const [invoicesResult, ordersResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('customer_id, total_amount_paise, paid_amount_paise, status')
      .eq('organization_id', user.org_id)
      .in('customer_id', customerIds)
      .in('status', ['sent', 'partially_paid', 'overdue'])
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('customer_id, created_at')
      .eq('organization_id', user.org_id)
      .in('customer_id', customerIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const invoices = ((invoicesResult.data ?? []) as unknown as Array<
    Pick<InvoiceRow, 'customer_id' | 'total_amount_paise' | 'paid_amount_paise' | 'status'>
  >)

  const outstandingByCustomer: Record<string, number> = {}
  for (const inv of invoices) {
    const balance = inv.total_amount_paise - (inv.paid_amount_paise ?? 0)
    if (balance > 0) {
      outstandingByCustomer[inv.customer_id] =
        (outstandingByCustomer[inv.customer_id] ?? 0) + balance
    }
  }

  const lastOrderByCustomer: Record<string, string> = {}
  for (const order of ((ordersResult.data ?? []) as unknown as Array<
    Pick<OrderRow, 'customer_id' | 'created_at'>
  >)) {
    if (!lastOrderByCustomer[order.customer_id]) {
      lastOrderByCustomer[order.customer_id] = order.created_at
    }
  }

  const headers = ['Name', 'City', 'Phone', 'GSTIN', 'Outstanding(₹)', 'Last Order']
  const rows = customers.map((c) => {
    const outstandingPaise = outstandingByCustomer[c.id] ?? 0
    const lastOrderIso = lastOrderByCustomer[c.id] ?? null
    return [
      c.name,
      [c.city, c.state].filter(Boolean).join(', '),
      c.phone ?? '',
      c.gstin ?? '',
      (outstandingPaise / 100).toFixed(2),
      lastOrderIso ? formatISTDate(new Date(lastOrderIso)) : '',
    ]
  })

  const today = new Date().toISOString().slice(0, 10)
  return buildCsvResponse(headers, rows, `vyaops-customers-${today}.csv`)
}
