import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

// GET /api/invoices/eligible-orders
// Returns completed/dispatched orders that do not yet have a (non-cancelled)
// invoice — the candidate list for "Create Invoice". Includes customer payment
// terms so the dialog can pre-fill the due date.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  // Order IDs already invoiced (excluding cancelled invoices).
  const { data: invoicedRaw, error: invErr } = await supabase
    .from('invoices')
    .select('order_id')
    .eq('organization_id', user.org_id)
    .neq('status', 'cancelled')
    .not('order_id', 'is', null)
    .is('deleted_at', null)

  if (invErr) {
    captureWithContext(invErr, { action: 'GET /api/invoices/eligible-orders/invoices', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to load orders', code: 'DB_ERROR' }, { status: 500 })
  }

  const invoicedIds = ((invoicedRaw as unknown as { order_id: string | null }[] | null) ?? [])
    .map((r) => r.order_id)
    .filter((v): v is string => v !== null)

  let query = supabase
    .from('orders')
    .select(
      `id, order_number, quantity, unit_price_paise, total_amount_paise, status, created_at,
       customers(id, name, company_name, gstin, payment_terms_days),
       products(id, name, unit)`
    )
    .eq('organization_id', user.org_id)
    .in('status', ['completed', 'dispatched'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (invoicedIds.length > 0) {
    query = query.not('id', 'in', `(${invoicedIds.join(',')})`)
  }

  const { data: ordersRaw, error } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/invoices/eligible-orders/orders', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to load orders', code: 'DB_ERROR' }, { status: 500 })
  }

  type EligibleOrder = Pick<
    OrderRow,
    'id' | 'order_number' | 'quantity' | 'unit_price_paise' | 'total_amount_paise' | 'status' | 'created_at'
  > & {
    customers: Pick<
      CustomerRow,
      'id' | 'name' | 'company_name' | 'gstin' | 'payment_terms_days'
    > | null
    products: Pick<ProductRow, 'id' | 'name' | 'unit'> | null
  }

  return NextResponse.json({ data: (ordersRaw as unknown as EligibleOrder[] | null) ?? [] })
}
