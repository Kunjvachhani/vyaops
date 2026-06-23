import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { captureWithContext } from '@/lib/utils/sentry'

type InventoryRow = Database['public']['Tables']['inventory']['Row']

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const itemType = sp.get('type') // raw_material | finished_good | null
  const lowStockOnly = sp.get('low_stock') === 'true'

  const supabase = await createClient()

  let query = supabase
    .from('inventory')
    .select('*, products(id, name)')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (itemType === 'raw_material' || itemType === 'finished_good') {
    query = query.eq('item_type', itemType)
  }

  query = query.order('item_type').order('item_name')

  const { data: rawData, error } = await query

  if (error) {
    captureWithContext(error, {
      action: 'GET /api/inventory',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json({ error: 'Failed to fetch inventory', code: 'DB_ERROR' }, { status: 500 })
  }

  type InventoryWithProduct = InventoryRow & {
    products: { id: string; name: string } | null
  }

  const allItems = (rawData as unknown as InventoryWithProduct[]) ?? []

  const withComputed = allItems.map((i) => ({
    ...i,
    is_low_stock: i.current_quantity <= i.reorder_level,
    product_name: i.products?.name ?? null,
  }))

  const items = lowStockOnly ? withComputed.filter((i) => i.is_low_stock) : withComputed

  const summary = {
    total_items: withComputed.length,
    low_stock_count: withComputed.filter((i) => i.is_low_stock).length,
    raw_material_count: withComputed.filter((i) => i.item_type === 'raw_material').length,
    finished_good_count: withComputed.filter((i) => i.item_type === 'finished_good').length,
  }

  return NextResponse.json({ data: items, summary })
}
