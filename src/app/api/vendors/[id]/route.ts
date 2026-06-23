import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import { updateVendorSchema } from '@/lib/validations/vendor'
import { softDelete, SoftDeleteError } from '@/lib/utils/soft-delete'
import { captureWithContext } from '@/lib/utils/sentry'

type VendorRow = Database['public']['Tables']['vendors']['Row']
type VendorUpdate = Database['public']['Tables']['vendors']['Update']
type VendorOrderRow = Database['public']['Tables']['vendor_orders']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/vendors/[id]
// Returns full vendor record, recent purchase orders, and total spend.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: vendorRaw, error: vendorErr } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (vendorErr || !vendorRaw) {
    return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const vendor = vendorRaw as unknown as VendorRow

  const { data: posRaw } = await supabase
    .from('vendor_orders')
    .select('*')
    .eq('organization_id', user.org_id)
    .eq('vendor_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const purchase_orders = (posRaw ?? []) as unknown as VendorOrderRow[]

  const total_spend_paise = purchase_orders.reduce(
    (sum, po) => sum + (po.total_amount_paise ?? 0),
    0
  )

  return NextResponse.json({
    data: {
      vendor,
      purchase_orders,
      total_spend_paise,
      purchase_orders_count: purchase_orders.length,
    },
  })
}

// PATCH /api/vendors/[id]
// Updates vendor fields. Uses integer version for optimistic locking. Requires owner or manager.
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

  const parsed = updateVendorSchema.safeParse(body)
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
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const current = currentRaw as unknown as VendorRow

  const payload: VendorUpdate = {}
  if (fields.name !== undefined) payload.name = fields.name
  if (fields.company_name !== undefined) payload.company_name = fields.company_name
  if (fields.phone !== undefined) payload.phone = fields.phone
  if (fields.email !== undefined) payload.email = fields.email ?? null
  if (fields.gstin !== undefined) payload.gstin = fields.gstin ?? null
  if (fields.address !== undefined) payload.address = fields.address
  if (fields.materials_supplied !== undefined) payload.materials_supplied = fields.materials_supplied
  if (fields.payment_terms_days !== undefined) payload.payment_terms_days = fields.payment_terms_days
  if (fields.rating !== undefined) payload.rating = fields.rating
  if (fields.notes !== undefined) payload.notes = fields.notes

  // The version filter IS the conflict check — atomic at the DB level.
  // If another request already incremented the version, this matches 0 rows → PGRST116.
  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('vendors')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .eq('version', clientVersion)
    .select()
    .single()

  if (updateErr) {
    if (updateErr.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Vendor was modified by another process. Refresh and try again.', code: 'CONFLICT' },
        { status: 409 }
      )
    }
    captureWithContext(updateErr, {
      action: 'PATCH /api/vendors/[id]',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json({ error: 'Failed to update vendor', code: 'DB_ERROR' }, { status: 500 })
  }

  const updated = updatedRaw as unknown as VendorRow

  const changes = diffChanges(
    current as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'vendor',
    entity_id: id,
    changes,
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/vendors/[id]
// Soft-deletes the vendor. Requires owner or manager role.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    await softDelete('vendors', id, user.org_id, user.id, { ip: getIp(req) })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      if (err.code === 'NOT_FOUND' || err.code === 'ALREADY_DELETED') {
        return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
      }
      captureWithContext(err, {
        action: 'DELETE /api/vendors/[id]',
        org_id: user.org_id,
        user_role: user.role,
      })
      return NextResponse.json({ error: 'Failed to delete vendor', code: 'DB_ERROR' }, { status: 500 })
    }
    throw err
  }

  return NextResponse.json({ data: { id, table: 'vendors', deleted: true } })
}
