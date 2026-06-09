import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProductRow = Database['public']['Tables']['products']['Row']
type ProductSummary = Pick<ProductRow, 'id' | 'name' | 'unit' | 'unit_price_paise' | 'code'>

function sanitize(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/products
// Lists products for the authenticated org. Supports search by name.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitize(rawSearch)
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)))

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('id, name, unit, unit_price_paise, code')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/products]', error)
    return NextResponse.json({ error: 'Failed to fetch products', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ data: (data as unknown as ProductSummary[]) ?? [] })
}
