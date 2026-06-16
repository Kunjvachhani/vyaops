import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { computeGst, isIntrastate } from '@/lib/utils/gst'
import {
  generateInvoicePDF,
  type InvoiceData,
  type InvoiceLineItem,
} from '@/lib/utils/pdf-generator'
import { logAudit } from '@/lib/utils/audit'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

type RouteContext = { params: Promise<{ id: string }> }

const STORAGE_BUCKET = 'invoices'
// Signed-URL lifetime for the cached PDF stored in invoices.pdf_url (7 days).
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

// Deterministic cache path: keying on the invoice's updated_at means the PDF is
// only re-rendered when the invoice actually changes (new updated_at → new path).
function storagePath(orgId: string, invoiceId: string, updatedAt: string): string {
  const version = new Date(updatedAt).getTime()
  return `${orgId}/${invoiceId}-${version}.pdf`
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function pdfResponse(buffer: Buffer, invoiceNumber: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}

// POST /api/invoices/[id]/pdf
// Generates (or serves the cached) tax-invoice PDF for an invoice the caller's
// org owns. Caches the rendered PDF in Supabase Storage, re-rendering only when
// the invoice has changed since the last render.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  // Fetch invoice + related order, customer, product. Org-scoped (defense in depth).
  const supabase = await createClient()
  const { data: invoiceRaw, error: invoiceErr } = await supabase
    .from('invoices')
    .select(
      `*,
       customers(id, name, company_name, address, gstin, phone, email),
       orders(id, quantity, unit_price_paise, products(id, name, unit, hsn_code))`
    )
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (invoiceErr || !invoiceRaw) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  type InvoiceWithRelations = InvoiceRow & {
    customers: Pick<
      CustomerRow,
      'id' | 'name' | 'company_name' | 'address' | 'gstin' | 'phone' | 'email'
    > | null
    orders:
      | (Pick<OrderRow, 'id' | 'quantity' | 'unit_price_paise'> & {
          products: Pick<ProductRow, 'id' | 'name' | 'unit' | 'hsn_code'> | null
        })
      | null
  }
  const invoice = invoiceRaw as unknown as InvoiceWithRelations

  if (!invoice.customers) {
    return NextResponse.json(
      { error: 'Invoice is missing its customer', code: 'DATA_INTEGRITY_ERROR' },
      { status: 422 }
    )
  }

  // Fetch the issuing organization (seller).
  const { data: orgRaw, error: orgErr } = await supabase
    .from('organizations')
    .select('name, address, city, state, gstin, phone, email')
    .eq('id', user.org_id)
    .single()

  if (orgErr || !orgRaw) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  const org = orgRaw as Pick<
    OrganizationRow,
    'name' | 'address' | 'city' | 'state' | 'gstin' | 'phone' | 'email'
  >

  // ----- Serve from cache if the current version already exists -----
  const path = storagePath(user.org_id, invoice.id, invoice.updated_at)
  const { data: cached } = await adminClient.storage.from(STORAGE_BUCKET).download(path)
  if (cached) {
    const buffer = Buffer.from(await cached.arrayBuffer())
    return pdfResponse(buffer, invoice.invoice_number)
  }

  // ----- Build invoice data from stored values -----
  const order = invoice.orders
  const product = order?.products

  const lineItem: InvoiceLineItem = {
    productName: product?.name ?? 'Item',
    hsnCode: product?.hsn_code ?? null,
    quantity: order?.quantity ?? 1,
    unit: product?.unit ?? 'pieces',
    unitPricePaise: order?.unit_price_paise ?? invoice.subtotal_paise,
    amountPaise: invoice.subtotal_paise,
  }

  const intrastate = isIntrastate(org.gstin, invoice.customers.gstin)
  const gst = computeGst(invoice.subtotal_paise, invoice.tax_rate, intrastate)

  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.created_at),
    dueDate: new Date(invoice.due_date),
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
      name: invoice.customers.name,
      companyName: invoice.customers.company_name,
      address: invoice.customers.address,
      gstin: invoice.customers.gstin,
      phone: invoice.customers.phone,
      email: invoice.customers.email,
    },
    lineItems: [lineItem],
    subtotalPaise: invoice.subtotal_paise,
    gst,
    totalPaise: invoice.total_amount_paise,
    notes: invoice.notes,
  }

  // ----- Render -----
  let buffer: Buffer
  try {
    buffer = await generateInvoicePDF(invoiceData)
  } catch (err) {
    console.error('[POST /api/invoices/[id]/pdf] render failed', err)
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', code: 'PDF_GENERATION_ERROR' },
      { status: 500 }
    )
  }

  // ----- Cache to storage + persist pdf_url (best-effort; never blocks delivery) -----
  const { error: uploadErr } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, new Uint8Array(buffer), {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadErr) {
    console.error('[POST /api/invoices/[id]/pdf] storage upload failed', uploadErr)
  } else {
    // Private bucket → mint a signed URL for pdf_url (used for display / WhatsApp send).
    const { data: signed, error: signErr } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (signErr || !signed) {
      console.error('[POST /api/invoices/[id]/pdf] signed url failed', signErr)
    } else {
      const { error: updateErr } = await adminClient
        .from('invoices')
        .update({ pdf_url: signed.signedUrl })
        .eq('id', invoice.id)
        .eq('organization_id', user.org_id)

      if (updateErr) {
        console.error('[POST /api/invoices/[id]/pdf] pdf_url update failed', updateErr)
      } else {
        void logAudit({
          organization_id: user.org_id,
          user_id: user.id,
          action: 'update',
          entity_type: 'invoice',
          entity_id: invoice.id,
          changes: [{ field: 'pdf_url', old_value: invoice.pdf_url, new_value: signed.signedUrl }],
          ip_address: getIp(req),
        })
      }
    }
  }

  return pdfResponse(buffer, invoice.invoice_number)
}
