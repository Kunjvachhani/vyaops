import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { createOrder } from '@/lib/orders/create-order'
import type { Database } from '@/types/database'

// Internal-auth endpoint for n8n (legacy) to create orders from WhatsApp.
// Accepts resolved entity names rather than UUIDs so n8n doesn't need to
// carry IDs through session state. For new code, prefer createOrder() directly
// from the flow engine (which already has IDs from fuzzy-match resolution).

type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type AsSingle<T> = T | null

const RequestSchema = z.object({
  orgId: z.string().uuid(),
  sender: z.string().min(5),
  customerName: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().min(0).optional(),
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

  // Resolve customer by canonical name
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

  // Resolve product by canonical name
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

  const effectivePricePaise =
    unitPricePaise && unitPricePaise > 0
      ? unitPricePaise
      : (product.unit_price_paise ?? 0)

  if (effectivePricePaise <= 0) {
    return NextResponse.json(
      { error: 'No price available — please specify the unit price', code: 'PRICE_MISSING' },
      { status: 422 }
    )
  }

  try {
    const result = await createOrder({
      orgId,
      customerId: customer.id,
      productId: product.id,
      quantity,
      unitPricePaise: effectivePricePaise,
      deliveryDate: deliveryDate ?? null,
      source: 'whatsapp',
      auditMetadata: { via_whatsapp: true, sender },
    })

    return NextResponse.json({
      orderNumber: result.orderNumber,
      customerName: result.customerName,
      productName: result.productName,
      unit: result.unit,
      quantity: result.quantity,
      totalAmountPaise: result.totalAmountPaise,
      status: result.status,
      orderId: result.orderId,
      idempotent: result.idempotent,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp-create] createOrder failed:', msg)
    return NextResponse.json({ error: 'Failed to create order', code: 'DB_ERROR' }, { status: 500 })
  }
}
