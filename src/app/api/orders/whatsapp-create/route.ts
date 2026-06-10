import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { logAudit } from '@/lib/utils/audit'
import type { Database } from '@/types/database'

// Internal-auth endpoint for n8n to create orders from WhatsApp.
// Accepts resolved entity names (normalizedValue from fuzzy match) rather than
// UUIDs so n8n doesn't need to carry IDs through session state.
//
// Called from two n8n branches:
//   - AI auto_process: immediately after eval gate approves
//   - Guided confirm:  after user taps ✅ Confirm button (reads session first)

type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']

type AsSingle<T> = T | null

const RequestSchema = z.object({
  orgId: z.string().uuid(),
  sender: z.string().min(5),
  customerName: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().min(0).optional(), // 0 or absent → fall back to product catalog price
  deliveryDate: z.string().date().optional(),
})

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { orgId, sender, customerName, productName, quantity, unitPricePaise, deliveryDate } =
    parsed.data

  // Resolve customer by canonical name (exact match on the normalizedValue stored after fuzzy matching)
  const { data: customerRaw } = await adminClient
    .from('customers')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('name', customerName)
    .is('deleted_at', null)
    .maybeSingle()

  const customer = customerRaw as AsSingle<Pick<CustomerRow, 'id' | 'name'>>
  if (!customer) {
    return NextResponse.json(
      { error: `Customer "${customerName}" not found`, code: 'CUSTOMER_NOT_FOUND' },
      { status: 404 }
    )
  }

  // Resolve product by canonical name; also fetch unit_price_paise for price fallback
  const { data: productRaw } = await adminClient
    .from('products')
    .select('id, name, unit, unit_price_paise')
    .eq('organization_id', orgId)
    .eq('name', productName)
    .is('deleted_at', null)
    .maybeSingle()

  const product = productRaw as AsSingle<
    Pick<ProductRow, 'id' | 'name' | 'unit' | 'unit_price_paise'>
  >
  if (!product) {
    return NextResponse.json(
      { error: `Product "${productName}" not found`, code: 'PRODUCT_NOT_FOUND' },
      { status: 404 }
    )
  }

  // Use extracted price if present and positive; fall back to catalog price.
  const effectivePricePaise =
    unitPricePaise && unitPricePaise > 0
      ? unitPricePaise
      : (product.unit_price_paise ?? 0)

  if (effectivePricePaise <= 0) {
    return NextResponse.json(
      {
        error: 'No price available — please specify the unit price',
        code: 'PRICE_MISSING',
      },
      { status: 422 }
    )
  }

  const totalAmountPaise = quantity * effectivePricePaise

  // Idempotency key: same formula as POST /api/orders so web + WhatsApp duplicates collapse
  const dateHour = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const idempotencyKey = createHash('sha256')
    .update(`${orgId}:${customer.id}:${product.id}:${quantity}:${dateHour}`)
    .digest('hex')

  // Return existing order for duplicate requests within the same hour
  const { data: existingRaw } = await adminClient
    .from('orders')
    .select('*')
    .eq('organization_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle()

  const existing = existingRaw as AsSingle<OrderRow>
  if (existing) {
    return NextResponse.json({
      orderNumber: existing.order_number,
      customerName: customer.name,
      productName: product.name,
      unit: product.unit,
      quantity: existing.quantity,
      totalAmountPaise: existing.total_amount_paise,
      status: existing.status,
      orderId: existing.id,
      idempotent: true,
    })
  }

  // Generate sequential order number from DB sequence
  type SeqRpc = (
    fn: 'generate_order_number'
  ) => Promise<{ data: string | null; error: { message: string } | null }>
  const { data: orderNumber, error: seqErr } = await (
    adminClient.rpc as unknown as SeqRpc
  )('generate_order_number')

  if (seqErr || !orderNumber) {
    console.error('[whatsapp-create] generate_order_number rpc failed', seqErr)
    return NextResponse.json(
      { error: 'Failed to generate order number', code: 'SEQ_ERROR' },
      { status: 500 }
    )
  }

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('orders')
    .insert({
      organization_id: orgId,
      order_number: orderNumber,
      customer_id: customer.id,
      product_id: product.id,
      quantity,
      unit_price_paise: effectivePricePaise,
      total_amount_paise: totalAmountPaise,
      status: 'confirmed',
      delivery_date: deliveryDate ?? null,
      notes: `Created via WhatsApp`,
      source: 'whatsapp',
      idempotency_key: idempotencyKey,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    console.error('[whatsapp-create] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create order', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as OrderRow

  // Audit log: user_id is null — WhatsApp sender is captured in metadata
  void logAudit({
    organization_id: orgId,
    action: 'create',
    entity_type: 'order',
    entity_id: created.id,
    changes: [
      { field: 'order_number', old_value: null, new_value: created.order_number },
      { field: 'customer_id', old_value: null, new_value: customer.id },
      { field: 'product_id', old_value: null, new_value: product.id },
      { field: 'quantity', old_value: null, new_value: quantity },
      { field: 'unit_price_paise', old_value: null, new_value: effectivePricePaise },
      { field: 'total_amount_paise', old_value: null, new_value: totalAmountPaise },
      { field: 'status', old_value: null, new_value: 'confirmed' },
    ],
    metadata: { via_whatsapp: true, sender },
  })

  return NextResponse.json({
    orderNumber: created.order_number,
    customerName: customer.name,
    productName: product.name,
    unit: product.unit,
    quantity,
    totalAmountPaise,
    status: created.status,
    orderId: created.id,
  })
}
