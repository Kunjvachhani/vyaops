import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { manualAdjustmentSchema } from '@/lib/validations/inventory'

type InventoryRow = Database['public']['Tables']['inventory']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type MovementRow = Database['public']['Tables']['inventory_movements']['Row']

type AsSingle<T> = T | null

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/inventory/[id]
// Returns stock movement history for the last 30 days.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: invRaw, error: invErr } = await supabase
    .from('inventory')
    .select('id')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (invErr || !invRaw) {
    return NextResponse.json({ error: 'Inventory item not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rawMovements, error: movErr } = await supabase
    .from('inventory_movements')
    .select('*, users(name)')
    .eq('inventory_id', id)
    .eq('organization_id', user.org_id)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100)

  if (movErr) {
    captureWithContext(movErr, {
      action: 'GET /api/inventory/[id]',
      inventory_id: id,
      org_id: user.org_id,
    })
    return NextResponse.json({ error: 'Failed to fetch movements', code: 'DB_ERROR' }, { status: 500 })
  }

  type MovementWithUser = MovementRow & { users: { name: string } | null }

  const movements = ((rawMovements ?? []) as unknown as MovementWithUser[]).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    quantity: m.quantity,
    reason: m.reason,
    notes: m.notes,
    balance_after: m.balance_after,
    created_by_name: m.users?.name ?? null,
  }))

  return NextResponse.json({ data: movements })
}

// PATCH /api/inventory/[id]
// Manual stock adjustment. Logs the change to inventory_movements (append-only).
// Requires owner or manager role.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const parsed = manualAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { change_quantity, reason, notes } = parsed.data

  const supabase = await createClient()

  const { data: invRaw, error: fetchErr } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !invRaw) {
    return NextResponse.json({ error: 'Inventory item not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const inv = invRaw as unknown as InventoryRow
  const newQuantity = inv.current_quantity + change_quantity

  const { data: userRecordRaw } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_auth_id', user.id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const createdBy: string | null = (userRecordRaw as AsSingle<Pick<UserRow, 'id'>>)?.id ?? null

  const updatePayload: Database['public']['Tables']['inventory']['Update'] = {
    current_quantity: newQuantity,
    ...(change_quantity > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
  }

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('inventory')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    captureWithContext(updateErr ?? new Error('update returned null'), {
      action: 'PATCH /api/inventory/[id]',
      inventory_id: id,
      org_id: user.org_id,
    })
    return NextResponse.json({ error: 'Failed to update inventory', code: 'DB_ERROR' }, { status: 500 })
  }

  const { error: movErr } = await adminClient.from('inventory_movements').insert({
    organization_id: user.org_id,
    inventory_id: id,
    movement_type: 'adjustment',
    quantity: change_quantity,
    reason,
    notes: notes ?? null,
    reference_type: null,
    reference_id: null,
    balance_after: newQuantity,
    created_by: createdBy,
  })

  if (movErr) {
    captureWithContext(movErr, {
      action: 'PATCH /api/inventory/[id]/movement',
      inventory_id: id,
      org_id: user.org_id,
    })
  }

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'inventory',
    entity_id: id,
    changes: [
      { field: 'current_quantity', old_value: inv.current_quantity, new_value: newQuantity },
    ],
    ip_address: getIp(req),
  })

  const updated = updatedRaw as unknown as InventoryRow

  return NextResponse.json({
    data: {
      ...updated,
      is_low_stock: newQuantity <= updated.reorder_level,
    },
  })
}
