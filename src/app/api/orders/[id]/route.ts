import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import { ORDER_STATUSES, STATUS_TRANSITIONS, updateOrderSchema } from '@/lib/validations/order'
import type { OrderStatus } from '@/lib/validations/order'

type OrderRow = Database['public']['Tables']['orders']['Row']
type OrderUpdate = Database['public']['Tables']['orders']['Update']
type CustomerRow = Database['public']['Tables']['customers']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/orders/[id]
// Returns the full order with customer details. Enforces org ownership.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: dataRaw, error } = await supabase
    .from('orders')
    .select(
      '*, customers(id, name, company_name, phone, email, payment_terms_days, address)'
    )
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !dataRaw) {
    return NextResponse.json({ error: 'Order not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  type OrderWithCustomer = OrderRow & {
    customers: Pick<CustomerRow, 'id' | 'name' | 'company_name' | 'phone' | 'email' | 'payment_terms_days' | 'address'> | null
  }
  const data = dataRaw as unknown as OrderWithCustomer

  return NextResponse.json({ data })
}

// PATCH /api/orders/[id]
// Updates status, notes, quantity, unit_price_paise, or delivery_date.
// Requires `updated_at` (optimistic lock). Status follows forward-only transition rules.
// Requires: owner or manager role.
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

  const parsed = updateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const {
    updated_at: clientUpdatedAt,
    status: newStatus,
    notes,
    quantity,
    unit_price_paise,
    delivery_date,
  } = parsed.data

  const supabase = await createClient()
  const { data: currentRaw, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json({ error: 'Order not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const current = currentRaw as unknown as OrderRow

  // Optimistic locking — reject if a concurrent write happened since the client last read.
  if (current.updated_at !== clientUpdatedAt) {
    return NextResponse.json(
      {
        error: 'Order was modified by another process. Refresh and try again.',
        code: 'CONFLICT',
      },
      { status: 409 }
    )
  }

  // Validate forward-only status transition.
  if (newStatus !== undefined) {
    const currentStatus = current.status
    if (!ORDER_STATUSES.includes(currentStatus as OrderStatus)) {
      return NextResponse.json(
        { error: 'Order has an unrecognised status in database', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
    const allowed = STATUS_TRANSITIONS[currentStatus as OrderStatus]
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
          code: 'INVALID_TRANSITION',
          details: { current: currentStatus, allowed },
        },
        { status: 422 }
      )
    }
  }

  // Build typed update payload.
  const payload: OrderUpdate = {}
  if (newStatus !== undefined) payload.status = newStatus
  if (notes !== undefined) payload.notes = notes
  if (delivery_date !== undefined) payload.delivery_date = delivery_date
  if (quantity !== undefined) payload.quantity = quantity
  if (unit_price_paise !== undefined) payload.unit_price_paise = unit_price_paise

  // Recalculate total when quantity or price changes.
  if (quantity !== undefined || unit_price_paise !== undefined) {
    const effectiveQty = payload.quantity ?? current.quantity
    const effectivePrice = payload.unit_price_paise ?? current.unit_price_paise
    payload.total_amount_paise = effectiveQty * effectivePrice
  }

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('orders')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    console.error('[PATCH /api/orders/[id]]', updateErr)
    return NextResponse.json({ error: 'Failed to update order', code: 'DB_ERROR' }, { status: 500 })
  }

  const updated = updatedRaw as unknown as OrderRow

  const changes = diffChanges(
    current as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: newStatus !== undefined ? 'status_change' : 'update',
    entity_type: 'order',
    entity_id: id,
    changes,
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}
