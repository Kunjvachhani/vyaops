import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { computeGst, isIntrastate } from '@/lib/utils/gst'
import {
  generateInvoicePDF,
  type InvoiceData,
  type InvoiceLineItem,
} from '@/lib/utils/pdf-generator'
import { createInvoiceSchema } from '@/lib/validations/invoice'

type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

type AsSingle<T> = T | null

// POST /api/invoices/preview
// Renders a non-persisted "DRAFT" PDF from a completed order plus the owner's
// in-progress adjustments (tax rate, subtotal override, due date, notes) so the
// owner can preview before saving. Nothing is written to the DB or storage.
// Requires: owner or manager role.
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

  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  const { orderId, taxRate, dueDate, subtotalPaise: subtotalOverride, notes } = parsed.data

  const supabase = await createClient()
  const { data: orderRaw } = await supabase
    .from('orders')
    .select(
      'id, quantity, unit_price_paise, total_amount_paise, customers(name, company_name, address, gstin, phone, email), products(name, unit, hsn_code)'
    )
    .eq('id', orderId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  type OrderWithRelations = Pick<
    OrderRow,
    'id' | 'quantity' | 'unit_price_paise' | 'total_amount_paise'
  > & {
    customers: Pick<
      CustomerRow,
      'name' | 'company_name' | 'address' | 'gstin' | 'phone' | 'email'
    > | null
    products: Pick<ProductRow, 'name' | 'unit' | 'hsn_code'> | null
  }
  const order = orderRaw as unknown as AsSingle<OrderWithRelations>
  if (!order || !order.customers) {
    return NextResponse.json({ error: 'Order not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('name, address, city, state, gstin, phone, email')
    .eq('id', user.org_id)
    .single()
  const org = orgRaw as AsSingle<
    Pick<OrganizationRow, 'name' | 'address' | 'city' | 'state' | 'gstin' | 'phone' | 'email'>
  >
  if (!org) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const subtotalPaise = subtotalOverride ?? order.total_amount_paise
  const gst = computeGst(subtotalPaise, taxRate, isIntrastate(org.gstin, order.customers.gstin))

  const lineItem: InvoiceLineItem = {
    productName: order.products?.name ?? 'Item',
    hsnCode: order.products?.hsn_code ?? null,
    quantity: order.quantity,
    unit: order.products?.unit ?? 'pieces',
    unitPricePaise: order.unit_price_paise,
    amountPaise: subtotalPaise,
  }

  const invoiceData: InvoiceData = {
    invoiceNumber: 'DRAFT',
    invoiceDate: new Date(),
    dueDate: new Date(dueDate),
    seller: {
      name: org.name,
      companyName: org.name,
      address: org.address,
      city: org.city,
      state: org.state,
      gstin: org.gstin,
      phone: org.phone,
      email: org.email,
    },
    buyer: {
      name: order.customers.name,
      companyName: order.customers.company_name,
      address: order.customers.address,
      gstin: order.customers.gstin,
      phone: order.customers.phone,
      email: order.customers.email,
    },
    lineItems: [lineItem],
    subtotalPaise,
    gst,
    totalPaise: subtotalPaise + gst.totalTaxPaise,
    notes: notes ?? null,
  }

  let buffer: Buffer
  try {
    buffer = await generateInvoicePDF(invoiceData)
  } catch (err) {
    console.error('[POST /api/invoices/preview] render failed', err)
    return NextResponse.json(
      { error: 'Failed to generate preview', code: 'PDF_GENERATION_ERROR' },
      { status: 500 }
    )
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="invoice-preview.pdf"',
      'Cache-Control': 'private, no-store',
    },
  })
}
