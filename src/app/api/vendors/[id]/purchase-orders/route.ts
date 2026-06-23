import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { createPurchaseOrderSchema } from '@/lib/validations/vendor'

type VendorOrderRow = Database['public']['Tables']['vendor_orders']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/vendors/[id]/purchase-orders
// Lists all purchase orders for a vendor, paginated, newest first.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id: vendorId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const supabase = await createClient()

  const { data: vendorRaw } = await supabase
    .from('vendors')
    .select('id')
    .eq('id', vendorId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!vendorRaw) {
    return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: posRaw, error, count } = await supabase
    .from('vendor_orders')
    .select('*', { count: 'exact' })
    .eq('organization_id', user.org_id)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    captureWithContext(error, {
      action: 'GET /api/vendors/[id]/purchase-orders',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: (posRaw ?? []) as unknown as VendorOrderRow[],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/vendors/[id]/purchase-orders
// Creates a PO for the vendor. Auto-generates PO number via DB function.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: vendorId } = await params
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

  const parsed = createPurchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = await createClient()

  const { data: vendorRaw } = await supabase
    .from('vendors')
    .select('id')
    .eq('id', vendorId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!vendorRaw) {
    return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: poNumberRaw, error: poNumErr } = await adminClient.rpc('generate_po_number')
  if (poNumErr || !poNumberRaw) {
    captureWithContext(poNumErr ?? new Error('generate_po_number returned null'), {
      action: 'POST /api/vendors/[id]/purchase-orders',
      org_id: user.org_id,
    })
    return NextResponse.json(
      { error: 'Failed to generate PO number', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const po_number = poNumberRaw as string
  const {
    material_name,
    quantity,
    unit,
    unit_price_paise,
    expected_date,
    triggered_by_order_id,
    notes,
  } = parsed.data

  const total_amount_paise =
    unit_price_paise !== undefined ? Math.round(quantity * unit_price_paise) : null

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('vendor_orders')
    .insert({
      organization_id: user.org_id,
      vendor_id: vendorId,
      po_number,
      material_name,
      quantity,
      unit: unit ?? 'tons',
      unit_price_paise: unit_price_paise ?? null,
      total_amount_paise,
      status: 'draft',
      expected_date: expected_date ?? null,
      triggered_by_order_id: triggered_by_order_id ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    captureWithContext(insertErr ?? new Error('insert returned null'), {
      action: 'POST /api/vendors/[id]/purchase-orders',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to create purchase order', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const created = createdRaw as unknown as VendorOrderRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'vendor_order',
    entity_id: created.id,
    changes: [
      { field: 'po_number', old_value: null, new_value: po_number },
      { field: 'material_name', old_value: null, new_value: material_name },
      { field: 'quantity', old_value: null, new_value: quantity },
      { field: 'total_amount_paise', old_value: null, new_value: total_amount_paise },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

