import { createHash } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import type { Database } from '@/types/database'

type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type AsSingle<T> = T | null

export interface CreateOrderParams {
  orgId: string
  customerId: string
  productId: string
  quantity: number
  unitPricePaise: number
  deliveryDate: string | null
  source: 'whatsapp' | 'web'
  notes?: string
  /** Audit metadata — e.g. { via_whatsapp: true, sender: 'phone' } */
  auditMetadata?: Record<string, unknown>
}

export interface CreateOrderResult {
  orderId: string
  orderNumber: string
  customerName: string
  productName: string
  unit: string
  quantity: number
  totalAmountPaise: number
  status: string
  idempotent: boolean
}

/**
 * Single source of truth for order creation. Used by both the WhatsApp flow
 * engine and the /api/orders/whatsapp-create API route. Enforces idempotency
 * via hash(org_id:customer_id:product_id:qty:date_hour) and writes the audit log.
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const {
    orgId,
    customerId,
    productId,
    quantity,
    unitPricePaise,
    deliveryDate,
    source,
    notes,
    auditMetadata,
  } = params

  // Fetch customer + product names for the response and audit
  const [{ data: customerRaw }, { data: productRaw }] = await Promise.all([
    adminClient
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('id', customerId)
      .is('deleted_at', null)
      .maybeSingle(),
    adminClient
      .from('products')
      .select('id, name, unit, unit_price_paise')
      .eq('organization_id', orgId)
      .eq('id', productId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  const customer = customerRaw as AsSingle<Pick<CustomerRow, 'id' | 'name'>>
  const product = productRaw as AsSingle<Pick<ProductRow, 'id' | 'name' | 'unit' | 'unit_price_paise'>>

  if (!customer) throw new Error(`Customer ${customerId} not found in org ${orgId}`)
  if (!product) throw new Error(`Product ${productId} not found in org ${orgId}`)

  const effectivePricePaise = unitPricePaise > 0 ? unitPricePaise : (product.unit_price_paise ?? 0)
  if (effectivePricePaise <= 0) {
    throw new Error(`No price available for product ${product.name} — specify unit price`)
  }

  const totalAmountPaise = quantity * effectivePricePaise

  // Idempotency key: same formula across web + WhatsApp so duplicates collapse
  const dateHour = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const idempotencyKey = createHash('sha256')
    .update(`${orgId}:${customerId}:${productId}:${quantity}:${dateHour}`)
    .digest('hex')

  const { data: existingRaw } = await adminClient
    .from('orders')
    .select('*')
    .eq('organization_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle()

  const existing = existingRaw as AsSingle<OrderRow>
  if (existing) {
    return {
      orderId: existing.id,
      orderNumber: existing.order_number,
      customerName: customer.name,
      productName: product.name,
      unit: product.unit,
      quantity: existing.quantity,
      totalAmountPaise: existing.total_amount_paise,
      status: existing.status,
      idempotent: true,
    }
  }

  // Generate sequential order number via DB sequence RPC
  type SeqRpc = (
    fn: 'generate_order_number'
  ) => Promise<{ data: string | null; error: { message: string } | null }>

  const { data: orderNumber, error: seqErr } = await (
    adminClient.rpc as unknown as SeqRpc
  )('generate_order_number')

  if (seqErr || !orderNumber) {
    throw new Error(`generate_order_number rpc failed: ${seqErr?.message ?? 'null result'}`)
  }

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('orders')
    .insert({
      organization_id: orgId,
      order_number: orderNumber,
      customer_id: customerId,
      product_id: productId,
      quantity,
      unit_price_paise: effectivePricePaise,
      total_amount_paise: totalAmountPaise,
      status: 'confirmed',
      delivery_date: deliveryDate ?? null,
      notes: notes ?? `Created via ${source}`,
      source,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    throw new Error(`Order insert failed: ${insertErr?.message ?? 'null result'}`)
  }

  const created = createdRaw as unknown as OrderRow

  void logAudit({
    organization_id: orgId,
    action: 'create',
    entity_type: 'order',
    entity_id: created.id,
    changes: [
      { field: 'order_number', old_value: null, new_value: created.order_number },
      { field: 'customer_id', old_value: null, new_value: customerId },
      { field: 'product_id', old_value: null, new_value: productId },
      { field: 'quantity', old_value: null, new_value: quantity },
      { field: 'unit_price_paise', old_value: null, new_value: effectivePricePaise },
      { field: 'total_amount_paise', old_value: null, new_value: totalAmountPaise },
      { field: 'status', old_value: null, new_value: 'confirmed' },
      ...(deliveryDate ? [{ field: 'delivery_date', old_value: null, new_value: deliveryDate }] : []),
    ],
    metadata: auditMetadata ?? {},
  })

  return {
    orderId: created.id,
    orderNumber: created.order_number,
    customerName: customer.name,
    productName: product.name,
    unit: product.unit,
    quantity,
    totalAmountPaise,
    status: created.status,
    idempotent: false,
  }
}
