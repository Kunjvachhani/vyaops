import { adminClient } from '@/lib/supabase/admin'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'
import { computeGst, isIntrastate } from '@/lib/utils/gst'
import {
  generateInvoicePDF,
  type InvoiceData,
  type InvoiceLineItem,
} from '@/lib/utils/pdf-generator'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

export const INVOICE_STORAGE_BUCKET = 'invoices'
// Signed-URL lifetime for the cached PDF stored in invoices.pdf_url (7 days).
export const INVOICE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

export type RenderedInvoice = {
  buffer: Buffer
  invoiceNumber: string
  signedUrl: string | null
  customerName: string
  customerPhone: string | null
  totalAmountPaise: number
  dueDate: string
}

export class InvoiceRenderError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_FOUND' | 'DATA_INTEGRITY_ERROR' | 'PDF_GENERATION_ERROR'
  ) {
    super(message)
    this.name = 'InvoiceRenderError'
  }
}

// Deterministic cache path: keying on the invoice's updated_at means the PDF is
// only re-rendered when the invoice actually changes (new updated_at → new path).
function storagePath(orgId: string, invoiceId: string, updatedAt: string): string {
  const version = new Date(updatedAt).getTime()
  return `${orgId}/${invoiceId}-${version}.pdf`
}

/**
 * Renders (or serves the cached) tax-invoice PDF for an org-owned invoice, caches
 * it in Supabase Storage, and refreshes invoices.pdf_url with a signed URL.
 *
 * All access is org-scoped via explicit `organization_id` filters (defense in
 * depth) even though it runs on the service-role client — required for Storage.
 *
 * @returns the PDF buffer plus metadata used by callers (download, WhatsApp send).
 */
export async function renderInvoice(orgId: string, invoiceId: string): Promise<RenderedInvoice> {
  const { data: invoiceRaw, error: invoiceErr } = await adminClient
    .from('invoices')
    .select(
      `*,
       customers(id, name, company_name, address, gstin, phone, email),
       orders(id, quantity, unit_price_paise, products(id, name, unit, hsn_code))`
    )
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (invoiceErr || !invoiceRaw) {
    throw new InvoiceRenderError('Invoice not found', 'NOT_FOUND')
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
    throw new InvoiceRenderError('Invoice is missing its customer', 'DATA_INTEGRITY_ERROR')
  }

  const { data: orgRaw, error: orgErr } = await adminClient
    .from('organizations')
    .select('name, address, city, state, gstin, phone, email')
    .eq('id', orgId)
    .single()

  if (orgErr || !orgRaw) {
    throw new InvoiceRenderError('Organization not found', 'NOT_FOUND')
  }
  const org = orgRaw as Pick<
    OrganizationRow,
    'name' | 'address' | 'city' | 'state' | 'gstin' | 'phone' | 'email'
  >

  const path = storagePath(orgId, invoice.id, invoice.updated_at)

  const baseMeta = {
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customers.name,
    customerPhone: invoice.customers.phone,
    totalAmountPaise: invoice.total_amount_paise,
    dueDate: invoice.due_date,
  }

  // ----- Serve from cache if the current version already exists -----
  const { data: cached } = await adminClient.storage.from(INVOICE_STORAGE_BUCKET).download(path)
  if (cached) {
    const buffer = Buffer.from(await cached.arrayBuffer())
    // pdf_url may have expired; ensure callers always get a fresh signed URL.
    const { data: signed } = await adminClient.storage
      .from(INVOICE_STORAGE_BUCKET)
      .createSignedUrl(path, INVOICE_SIGNED_URL_TTL_SECONDS)
    return { buffer, signedUrl: signed?.signedUrl ?? invoice.pdf_url, ...baseMeta }
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

  let buffer: Buffer
  try {
    buffer = await generateInvoicePDF(invoiceData)
  } catch (err) {
    captureWithContext(err, { action: 'renderInvoice/generatePDF', org_id: orgId, invoice_id: invoiceId })
    throw new InvoiceRenderError('Failed to generate invoice PDF', 'PDF_GENERATION_ERROR')
  }

  // ----- Cache to storage + persist pdf_url (best-effort; never blocks delivery) -----
  let signedUrl: string | null = invoice.pdf_url
  const { error: uploadErr } = await adminClient.storage
    .from(INVOICE_STORAGE_BUCKET)
    .upload(path, new Uint8Array(buffer), {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadErr) {
    captureWithContext(new Error(uploadErr.message), { action: 'renderInvoice/storageUpload', org_id: orgId, invoice_id: invoiceId })
  } else {
    const { data: signed, error: signErr } = await adminClient.storage
      .from(INVOICE_STORAGE_BUCKET)
      .createSignedUrl(path, INVOICE_SIGNED_URL_TTL_SECONDS)

    if (signErr || !signed) {
      captureWithContext(new Error(signErr?.message ?? 'createSignedUrl returned null'), { action: 'renderInvoice/signedUrl', org_id: orgId, invoice_id: invoiceId })
    } else {
      signedUrl = signed.signedUrl
      const { error: updateErr } = await adminClient
        .from('invoices')
        .update({ pdf_url: signed.signedUrl })
        .eq('id', invoice.id)
        .eq('organization_id', orgId)
      if (updateErr) captureWithContext(new Error(updateErr.message), { action: 'renderInvoice/pdfUrlUpdate', org_id: orgId, invoice_id: invoiceId })
    }
  }

  return { buffer, signedUrl, ...baseMeta }
}
