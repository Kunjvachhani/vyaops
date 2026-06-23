import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import { updatePurchaseOrderSchema } from '@/lib/validations/vendor'
import { softDelete, SoftDeleteError } from '@/lib/utils/soft-delete'
import { captureWithContext } from '@/lib/utils/sentry'

type VendorOrderRow = Database['public']['Tables']['vendor_orders']['Row']
type VendorOrderUpdate = Database['public']['Tables']['vendor_orders']['Update']

type RouteContext = { params: Promise<{ id: string; poId: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/vendors/[id]/purchase-orders/[poId]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: vendorId, poId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: poRaw, error } = await supabase
    .from('vendor_orders')
    .select('*')
    .eq('id', poId)
    .eq('organization_id', user.org_id)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .single()

  if (error || !poRaw) {
    return NextResponse.json(
      { error: 'Purchase order not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: poRaw as unknown as VendorOrderRow })
}

// PATCH /api/vendors/[id]/purchase-orders/[poId]
// Updates PO status, received quantity, quality status, or notes.
// Uses integer version for optimistic locking. Requires owner or manager.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id: vendorId, poId } = await params
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

  const parsed = updatePurchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { version: clientVersion, ...fields } = parsed.data

  const supabase = await createClient()

  // Fetch current for existence check + audit diff baseline.
  const { data: currentRaw, error: fetchErr } = await supabase
    .from('vendor_orders')
    .select('*')
    .eq('id', poId)
    .eq('organization_id', user.org_id)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json(
      { error: 'Purchase order not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const current = currentRaw as unknown as VendorOrderRow

  const payload: VendorOrderUpdate = {}
  if (fields.status !== undefined) payload.status = fields.status
  if (fields.received_quantity !== undefined) payload.received_quantity = fields.received_quantity
  if (fields.received_date !== undefined) payload.received_date = fields.received_date ?? null
  if (fields.quality_status !== undefined) payload.quality_status = fields.quality_status
  if (fields.expected_date !== undefined) payload.expected_date = fields.expected_date ?? null
  if (fields.unit_price_paise !== undefined) {
    payload.unit_price_paise = fields.unit_price_paise ?? null
    if (fields.unit_price_paise != null) {
      payload.total_amount_paise = Math.round(current.quantity * fields.unit_price_paise)
    }
  }
  if (fields.notes !== undefined) payload.notes = fields.notes

  // The version filter IS the conflict check — atomic at the DB level.
  // If another request already incremented the version, this matches 0 rows → PGRST116.
  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('vendor_orders')
    .update(payload)
    .eq('id', poId)
    .eq('organization_id', user.org_id)
    .eq('version', clientVersion)
    .select()
    .single()

  if (updateErr) {
    if (updateErr.code === 'PGRST116') {
      return NextResponse.json(
        {
          error: 'Purchase order was modified by another process. Refresh and try again.',
          code: 'CONFLICT',
        },
        { status: 409 }
      )
    }
    captureWithContext(updateErr, {
      action: 'PATCH /api/vendors/[id]/purchase-orders/[poId]',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to update purchase order', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const updated = updatedRaw as unknown as VendorOrderRow

  const changes = diffChanges(
    current as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: fields.status !== undefined ? 'status_change' : 'update',
    entity_type: 'vendor_order',
    entity_id: poId,
    changes,
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/vendors/[id]/purchase-orders/[poId]
// Soft-deletes the purchase order. Requires owner or manager role.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id: vendorId, poId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  // Verify the PO belongs to this vendor and org before deleting
  const supabase = await createClient()
  const { data: poRaw } = await supabase
    .from('vendor_orders')
    .select('id')
    .eq('id', poId)
    .eq('organization_id', user.org_id)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .single()

  if (!poRaw) {
    return NextResponse.json(
      { error: 'Purchase order not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  try {
    await softDelete('vendor_orders', poId, user.org_id, user.id, { ip: getIp(req) })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      if (err.code === 'NOT_FOUND' || err.code === 'ALREADY_DELETED') {
        return NextResponse.json(
          { error: 'Purchase order not found', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      captureWithContext(err, {
        action: 'DELETE /api/vendors/[id]/purchase-orders/[poId]',
        org_id: user.org_id,
        user_role: user.role,
      })
      return NextResponse.json(
        { error: 'Failed to delete purchase order', code: 'DB_ERROR' },
        { status: 500 }
      )
    }
    throw err
  }

  return NextResponse.json({ data: { id: poId, table: 'vendor_orders', deleted: true } })
}
