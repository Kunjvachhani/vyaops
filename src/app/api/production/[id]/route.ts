import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { captureWithContext } from '@/lib/utils/sentry'
import { requireTier } from '@/lib/utils/feature-gate'

type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function computeYield(produced: number, rejected: number): number {
  if (produced === 0) return 0
  return Math.max(0, ((produced - rejected) / produced) * 100)
}

// GET /api/production/[id]
// Returns a single production batch with order, product, and logger details.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const gate = await requireTier('tier_2', user.org_id)
  if (gate) return gate

  const supabase = await createClient()
  const { data: batchRaw, error } = await supabase
    .from('production_batches')
    .select(
      `*,
       orders(id, order_number, quantity, quantity_produced, status, delivery_date),
       products(id, name, unit, code),
       users(id, full_name, role)`
    )
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !batchRaw) {
    if (error?.code !== 'PGRST116') {
      captureWithContext(error ?? new Error('batch not found'), {
        action: 'GET /api/production/[id]',
        batch_id: id,
        org_id: user.org_id,
      })
    }
    return NextResponse.json({ error: 'Production batch not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  type BatchWithRelations = ProductionBatchRow & {
    orders: Pick<OrderRow, 'id' | 'order_number' | 'quantity' | 'quantity_produced' | 'status' | 'delivery_date'> | null
    products: Pick<ProductRow, 'id' | 'name' | 'unit' | 'code'> | null
    users: Pick<UserRow, 'id' | 'full_name' | 'role'> | null
  }
  const batch = batchRaw as unknown as BatchWithRelations

  return NextResponse.json({
    data: {
      ...batch,
      yield_percentage: computeYield(batch.quantity_produced, batch.quantity_rejected),
    },
  })
}
