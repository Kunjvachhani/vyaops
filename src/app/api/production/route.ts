import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { createProductionBatchSchema } from '@/lib/validations/production'

type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type AsSingle<T> = T | null
type AsList<T> = T[] | null

type RawMaterialBOM = { material_id: string; qty_per_unit: number }
type LowStockAlert = { inventory_id: string; item_name: string; current_quantity: number; reorder_level: number }
type PostBatchEffects = {
  order_completed: boolean
  order_quantity_produced: number
  order_quantity_rejected: number
  order_rejection_rate: number
  low_stock_alerts: LowStockAlert[]
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function computeYield(produced: number, rejected: number): number {
  if (produced === 0) return 0
  return Math.max(0, ((produced - rejected) / produced) * 100)
}

// Runs all post-insert side effects for a new production batch:
//   1. Re-sums all batches for the order → updates quantity_produced, auto-completes order if done.
//   2. Deducts raw materials from inventory (BOM from product.raw_materials).
//   3. Adds finished goods to inventory (quality-passed units only).
//   4. Logs every inventory change to inventory_movements.
//   5. Returns any inventory items that dropped to or below reorder_level.
async function runPostBatchEffects(params: {
  batchId: string
  orgId: string
  orderId: string | null
  productId: string
  quantityProduced: number
  quantityRejected: number
  loggedBy: string | null
  authUserId: string
}): Promise<PostBatchEffects> {
  const { batchId, orgId, orderId, productId, quantityProduced, quantityRejected, loggedBy, authUserId } = params
  const goodUnits = Math.max(0, quantityProduced - quantityRejected)
  const lowStockAlerts: LowStockAlert[] = []
  let orderCompleted = false
  let sumProduced = 0
  let sumRejected = 0

  // 1. Order progress: re-aggregate all batches to get accurate totals.
  if (orderId) {
    const [orderRes, batchesRes] = await Promise.all([
      adminClient
        .from('orders')
        .select('quantity, status')
        .eq('id', orderId)
        .eq('organization_id', orgId)
        .single(),
      adminClient
        .from('production_batches')
        .select('quantity_produced, quantity_rejected')
        .eq('order_id', orderId)
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

    const batches = (batchesRes.data ?? []) as Pick<ProductionBatchRow, 'quantity_produced' | 'quantity_rejected'>[]
    sumProduced = batches.reduce((s, b) => s + b.quantity_produced, 0)
    sumRejected = batches.reduce((s, b) => s + b.quantity_rejected, 0)

    if (orderRes.error) {
      captureWithContext(orderRes.error, { action: 'runPostBatchEffects/order_fetch', order_id: orderId, org_id: orgId })
    } else if (orderRes.data) {
      const order = orderRes.data as unknown as Pick<OrderRow, 'quantity' | 'status'>
      const shouldComplete = order.status === 'in_production' && sumProduced >= order.quantity
      const updatePayload: { quantity_produced: number; status?: string } = { quantity_produced: sumProduced }
      if (shouldComplete) {
        updatePayload.status = 'completed'
        orderCompleted = true
      }

      const { error: updateErr } = await adminClient
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('organization_id', orgId)

      if (updateErr) {
        captureWithContext(updateErr, { action: 'runPostBatchEffects/order_update', order_id: orderId, org_id: orgId })
      } else if (shouldComplete) {
        void logAudit({
          organization_id: orgId,
          user_id: authUserId,
          action: 'status_change',
          entity_type: 'order',
          entity_id: orderId,
          changes: [{ field: 'status', old_value: 'in_production', new_value: 'completed' }],
        })
      }
    }
  }

  // 2. Load product BOM.
  const { data: productRaw, error: productErr } = await adminClient
    .from('products')
    .select('raw_materials')
    .eq('id', productId)
    .eq('organization_id', orgId)
    .single()

  if (productErr) {
    captureWithContext(productErr, { action: 'runPostBatchEffects/product_fetch', product_id: productId, org_id: orgId })
    return buildEffectsResult(orderCompleted, sumProduced, sumRejected, lowStockAlerts)
  }

  const product = productRaw as unknown as Pick<ProductRow, 'raw_materials'>
  const rawMaterials: RawMaterialBOM[] = Array.isArray(product.raw_materials)
    ? (product.raw_materials as unknown[]).filter(
        (m): m is RawMaterialBOM =>
          m !== null &&
          typeof m === 'object' &&
          typeof (m as Record<string, unknown>).material_id === 'string' &&
          typeof (m as Record<string, unknown>).qty_per_unit === 'number'
      )
    : []

  // 3. Deduct raw materials (all produced units consume material, including rejected).
  for (const bom of rawMaterials) {
    const consumed = quantityProduced * bom.qty_per_unit

    const { data: invRaw, error: invFetchErr } = await adminClient
      .from('inventory')
      .select('id, current_quantity, reorder_level, item_name')
      .eq('id', bom.material_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single()

    if (invFetchErr || !invRaw) {
      captureWithContext(invFetchErr ?? new Error('inventory item not found'), {
        action: 'runPostBatchEffects/raw_material_fetch',
        inventory_id: bom.material_id,
        org_id: orgId,
      })
      continue
    }

    const inv = invRaw as unknown as Pick<InventoryRow, 'id' | 'current_quantity' | 'reorder_level' | 'item_name'>
    const newQty = inv.current_quantity - consumed

    const { error: invUpdateErr } = await adminClient
      .from('inventory')
      .update({ current_quantity: newQty })
      .eq('id', inv.id)
      .eq('organization_id', orgId)

    if (invUpdateErr) {
      captureWithContext(invUpdateErr, {
        action: 'runPostBatchEffects/raw_material_update',
        inventory_id: inv.id,
        org_id: orgId,
      })
      continue
    }

    const { error: movErr } = await adminClient.from('inventory_movements').insert({
      organization_id: orgId,
      inventory_id: inv.id,
      movement_type: 'deduction',
      quantity: -consumed,
      reason: 'production',
      reference_type: 'production_batch',
      reference_id: batchId,
      balance_after: newQty,
      created_by: loggedBy,
    })
    if (movErr) {
      captureWithContext(movErr, {
        action: 'runPostBatchEffects/raw_material_movement',
        inventory_id: inv.id,
        org_id: orgId,
      })
    }

    if (newQty <= inv.reorder_level) {
      lowStockAlerts.push({
        inventory_id: inv.id,
        item_name: inv.item_name,
        current_quantity: newQty,
        reorder_level: inv.reorder_level,
      })
    }
  }

  // 4. Add finished goods (only QC-passed units enter stock).
  if (goodUnits > 0) {
    const { data: fgRaw, error: fgFetchErr } = await adminClient
      .from('inventory')
      .select('id, current_quantity, reorder_level, item_name')
      .eq('product_id', productId)
      .eq('organization_id', orgId)
      .eq('item_type', 'finished_good')
      .is('deleted_at', null)
      .maybeSingle()

    if (fgFetchErr) {
      captureWithContext(fgFetchErr, {
        action: 'runPostBatchEffects/finished_good_fetch',
        product_id: productId,
        org_id: orgId,
      })
    } else if (fgRaw) {
      const fg = fgRaw as unknown as Pick<InventoryRow, 'id' | 'current_quantity' | 'reorder_level' | 'item_name'>
      const newQty = fg.current_quantity + goodUnits

      const { error: fgUpdateErr } = await adminClient
        .from('inventory')
        .update({ current_quantity: newQty })
        .eq('id', fg.id)
        .eq('organization_id', orgId)

      if (fgUpdateErr) {
        captureWithContext(fgUpdateErr, {
          action: 'runPostBatchEffects/finished_good_update',
          product_id: productId,
          org_id: orgId,
        })
      } else {
        const { error: fgMovErr } = await adminClient.from('inventory_movements').insert({
          organization_id: orgId,
          inventory_id: fg.id,
          movement_type: 'addition',
          quantity: goodUnits,
          reason: 'production',
          reference_type: 'production_batch',
          reference_id: batchId,
          balance_after: newQty,
          created_by: loggedBy,
        })
        if (fgMovErr) {
          captureWithContext(fgMovErr, {
            action: 'runPostBatchEffects/finished_good_movement',
            product_id: productId,
            org_id: orgId,
          })
        }

        if (newQty <= fg.reorder_level) {
          lowStockAlerts.push({
            inventory_id: fg.id,
            item_name: fg.item_name,
            current_quantity: newQty,
            reorder_level: fg.reorder_level,
          })
        }
      }
    }
    // No finished_good inventory item for this product → skip.
    // The item must be set up in inventory before batches are logged.
  }

  return buildEffectsResult(orderCompleted, sumProduced, sumRejected, lowStockAlerts)
}

function buildEffectsResult(
  orderCompleted: boolean,
  sumProduced: number,
  sumRejected: number,
  lowStockAlerts: LowStockAlert[]
): PostBatchEffects {
  return {
    order_completed: orderCompleted,
    order_quantity_produced: sumProduced,
    order_quantity_rejected: sumRejected,
    order_rejection_rate: sumProduced > 0 ? (sumRejected / sumProduced) * 100 : 0,
    low_stock_alerts: lowStockAlerts,
  }
}

// GET /api/production
// Lists production batches. Supports filters: order_id, worker_id, date_from, date_to.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const orderId = sp.get('order_id')
  const workerId = sp.get('worker_id')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')

  const supabase = await createClient()

  let query = supabase
    .from('production_batches')
    .select(
      `*,
       orders(id, order_number, quantity, status),
       products(id, name, unit),
       users(id, full_name)`,
      { count: 'exact' }
    )
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (orderId) query = query.eq('order_id', orderId)
  if (workerId) query = query.eq('logged_by', workerId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data: batchesRaw, error, count } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/production', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to fetch production batches', code: 'DB_ERROR' }, { status: 500 })
  }

  type BatchListItem = ProductionBatchRow & {
    orders: Pick<OrderRow, 'id' | 'order_number' | 'quantity' | 'status'> | null
    products: Pick<ProductRow, 'id' | 'name' | 'unit'> | null
    users: Pick<UserRow, 'id' | 'full_name'> | null
  }
  const batches = batchesRaw as unknown as AsList<BatchListItem>

  const data = (batches ?? []).map((b) => ({
    ...b,
    yield_percentage: computeYield(b.quantity_produced, b.quantity_rejected),
  }))

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/production
// Creates a production batch. All non-viewer roles can create.
// If order_id is provided, product_id is inferred from the order when omitted.
// On success: updates order progress, deducts raw materials, adds finished goods to inventory.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = createProductionBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const {
    order_id,
    quantity_produced,
    quantity_rejected,
    defect_type,
    shift,
    notes,
    source_message_id,
  } = parsed.data
  let { product_id } = parsed.data

  const supabase = await createClient()

  // Validate order and derive product_id if not provided.
  if (order_id) {
    const { data: orderRaw } = await supabase
      .from('orders')
      .select('id, product_id, status')
      .eq('id', order_id)
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .maybeSingle()

    const order = orderRaw as unknown as AsSingle<Pick<OrderRow, 'id' | 'product_id' | 'status'>>

    if (!order) {
      return NextResponse.json({ error: 'Order not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (order.status !== 'in_production') {
      return NextResponse.json(
        { error: `Order must be in_production status (current: ${order.status})`, code: 'INVALID_ORDER_STATUS' },
        { status: 422 }
      )
    }

    product_id ??= order.product_id
  }

  if (!product_id) {
    return NextResponse.json(
      { error: 'product_id is required when order_id is not provided', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  // Verify product belongs to this org.
  const { data: productRaw } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', product_id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!productRaw) {
    return NextResponse.json({ error: 'Product not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Resolve VyaOps users.id from Supabase auth UUID for the logged_by FK.
  const { data: userRecordRaw } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_auth_id', user.id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const loggedBy: string | null = (userRecordRaw as AsSingle<Pick<UserRow, 'id'>>)?.id ?? null

  // Auto-generate batch number: simple incrementing count per org.
  const { count: batchCount } = await adminClient
    .from('production_batches')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  const batchNumber = String((batchCount ?? 0) + 1)

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('production_batches')
    .insert({
      organization_id: user.org_id,
      batch_number: batchNumber,
      order_id: order_id ?? null,
      product_id,
      quantity_produced,
      quantity_rejected,
      defect_type: defect_type ?? null,
      shift: shift ?? null,
      logged_by: loggedBy,
      source: 'web',
      source_message_id: source_message_id ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    captureWithContext(insertErr ?? new Error('insert returned null'), {
      action: 'POST /api/production',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json({ error: 'Failed to create production batch', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as ProductionBatchRow

  // Post-insert effects: order progress, inventory deduction/addition, reorder alerts.
  const effects = await runPostBatchEffects({
    batchId: created.id,
    orgId: user.org_id,
    orderId: order_id ?? null,
    productId: product_id,
    quantityProduced: quantity_produced,
    quantityRejected: quantity_rejected,
    loggedBy,
    authUserId: user.id,
  })

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'production_batch',
    entity_id: created.id,
    changes: [
      { field: 'batch_number', old_value: null, new_value: batchNumber },
      { field: 'order_id', old_value: null, new_value: order_id ?? null },
      { field: 'product_id', old_value: null, new_value: product_id },
      { field: 'quantity_produced', old_value: null, new_value: quantity_produced },
      { field: 'quantity_rejected', old_value: null, new_value: quantity_rejected },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json(
    {
      data: {
        ...created,
        yield_percentage: computeYield(quantity_produced, quantity_rejected),
      },
      order_completed: effects.order_completed,
      order_quantity_produced: effects.order_quantity_produced,
      order_quantity_rejected: effects.order_quantity_rejected,
      order_rejection_rate: effects.order_rejection_rate,
      low_stock_alerts: effects.low_stock_alerts,
    },
    { status: 201 }
  )
}
