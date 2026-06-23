import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { bulkAdjustmentSchema } from '@/lib/validations/inventory'

type InventoryRow = Database['public']['Tables']['inventory']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type AsSingle<T> = T | null

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// POST /api/inventory/adjust
// Bulk stock adjustment. Each item must belong to this org.
// Requires owner or manager role.
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

  const parsed = bulkAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { adjustments } = parsed.data

  const supabase = await createClient()

  // Resolve VyaOps users.id for created_by FK.
  const { data: userRecordRaw } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_auth_id', user.id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const createdBy: string | null = (userRecordRaw as AsSingle<Pick<UserRow, 'id'>>)?.id ?? null

  // Fetch all referenced inventory items in one query.
  const inventoryIds = adjustments.map((a) => a.inventory_id)
  const { data: invItemsRaw, error: fetchErr } = await supabase
    .from('inventory')
    .select('*')
    .in('id', inventoryIds)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (fetchErr) {
    captureWithContext(fetchErr, {
      action: 'POST /api/inventory/adjust/fetch',
      org_id: user.org_id,
    })
    return NextResponse.json({ error: 'Failed to fetch inventory items', code: 'DB_ERROR' }, { status: 500 })
  }

  const invMap = new Map(
    ((invItemsRaw ?? []) as unknown as InventoryRow[]).map((i) => [i.id, i])
  )

  // Verify all requested IDs exist in this org.
  const missing = inventoryIds.filter((id) => !invMap.has(id))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Some inventory items not found', code: 'NOT_FOUND', details: missing },
      { status: 404 }
    )
  }

  const results: Array<{ inventory_id: string; new_quantity: number; is_low_stock: boolean }> = []
  const errors: Array<{ inventory_id: string; error: string }> = []

  for (const adj of adjustments) {
    const inv = invMap.get(adj.inventory_id)!
    const newQuantity = inv.current_quantity + adj.change_quantity

    const updatePayload: Database['public']['Tables']['inventory']['Update'] = {
      current_quantity: newQuantity,
      ...(adj.change_quantity > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
    }

    const { error: updateErr } = await adminClient
      .from('inventory')
      .update(updatePayload)
      .eq('id', adj.inventory_id)
      .eq('organization_id', user.org_id)

    if (updateErr) {
      captureWithContext(updateErr, {
        action: 'POST /api/inventory/adjust/update',
        inventory_id: adj.inventory_id,
        org_id: user.org_id,
      })
      errors.push({ inventory_id: adj.inventory_id, error: 'Failed to update' })
      continue
    }

    const { error: movErr } = await adminClient.from('inventory_movements').insert({
      organization_id: user.org_id,
      inventory_id: adj.inventory_id,
      movement_type: 'adjustment',
      quantity: adj.change_quantity,
      reason: adj.reason,
      reference_type: null,
      reference_id: null,
      balance_after: newQuantity,
      created_by: createdBy,
    })

    if (movErr) {
      captureWithContext(movErr, {
        action: 'POST /api/inventory/adjust/movement',
        inventory_id: adj.inventory_id,
        org_id: user.org_id,
      })
    }

    void logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'update',
      entity_type: 'inventory',
      entity_id: adj.inventory_id,
      changes: [
        { field: 'current_quantity', old_value: inv.current_quantity, new_value: newQuantity },
      ],
      ip_address: getIp(req),
    })

    // Update the map so subsequent adjustments to the same item use the latest quantity.
    invMap.set(adj.inventory_id, { ...inv, current_quantity: newQuantity })

    results.push({
      inventory_id: adj.inventory_id,
      new_quantity: newQuantity,
      is_low_stock: newQuantity <= inv.reorder_level,
    })
  }

  const status = errors.length === 0 ? 200 : results.length > 0 ? 207 : 500
  return NextResponse.json({ results, errors }, { status })
}
