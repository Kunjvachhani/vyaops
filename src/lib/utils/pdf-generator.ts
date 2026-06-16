import type { Browser } from 'puppeteer-core'
import { paiseToInvoiceAmount, paiseToWords } from './currency'
import { formatISTDate } from './date'
import type { GstBreakdown } from './gst'

// ---------------------------------------------------------------------------
// Invoice data shapes
// ---------------------------------------------------------------------------

export type InvoiceParty = {
  name: string
  companyName?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  gstin?: string | null
  phone?: string | null
  email?: string | null
}

export type InvoiceLineItem = {
  productName: string
  hsnCode?: string | null
  quantity: number
  unit: string
  unitPricePaise: number
  amountPaise: number
}

export type InvoiceBankDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  ifsc: string
}

export type InvoiceData = {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  seller: InvoiceParty
  buyer: InvoiceParty
  lineItems: InvoiceLineItem[]
  subtotalPaise: number
  gst: GstBreakdown
  totalPaise: number
  bankDetails?: InvoiceBankDetails | null
  termsAndConditions?: string | null
  logoUrl?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

// Escapes user-supplied text so it can be safely interpolated into the HTML.
function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function partyBlock(party: InvoiceParty): string {
  const lines = [
    party.companyName ? `<div class="party-name">${esc(party.companyName)}</div>` : '',
    `<div>${esc(party.name)}</div>`,
    party.address ? `<div>${esc(party.address)}</div>` : '',
    party.city || party.state
      ? `<div>${esc([party.city, party.state].filter(Boolean).join(', '))}</div>`
      : '',
    party.gstin ? `<div><strong>GSTIN:</strong> ${esc(party.gstin)}</div>` : '',
    party.phone ? `<div><strong>Ph:</strong> ${esc(party.phone)}</div>` : '',
    party.email ? `<div>${esc(party.email)}</div>` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

function lineItemsRows(items: InvoiceLineItem[]): string {
  return items
    .map(
      (item, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(item.productName)}</td>
        <td class="center">${esc(item.hsnCode) || '-'}</td>
        <td class="num">${item.quantity} ${esc(item.unit)}</td>
        <td class="num">${paiseToInvoiceAmount(item.unitPricePaise)}</td>
        <td class="num">${paiseToInvoiceAmount(item.amountPaise)}</td>
      </tr>`
    )
    .join('')
}

function taxRows(gst: GstBreakdown): string {
  if (gst.intrastate) {
    const half = gst.taxRate / 2
    return `
      <tr>
        <td class="label">CGST @ ${half}%</td>
        <td class="num">${paiseToInvoiceAmount(gst.cgstPaise)}</td>
      </tr>
      <tr>
        <td class="label">SGST @ ${half}%</td>
        <td class="num">${paiseToInvoiceAmount(gst.sgstPaise)}</td>
      </tr>`
  }
  return `
      <tr>
        <td class="label">IGST @ ${gst.taxRate}%</td>
        <td class="num">${paiseToInvoiceAmount(gst.igstPaise)}</td>
      </tr>`
}

/**
 * Builds the full A4-styled invoice HTML document as a string.
 * All amounts are formatted in the Indian system (₹1,50,000.00).
 */
export function buildInvoiceHtml(invoice: InvoiceData): string {
  const { seller, buyer, gst } = invoice

  const logo = invoice.logoUrl
    ? `<img class="logo" src="${esc(invoice.logoUrl)}" alt="Logo" />`
    : `<div class="logo logo-placeholder">${esc(seller.companyName || seller.name).slice(0, 2).toUpperCase()}</div>`

  const bank = invoice.bankDetails
    ? `
      <div class="footer-block">
        <div class="footer-title">Bank Details</div>
        <div>${esc(invoice.bankDetails.bankName)}</div>
        <div>A/c Name: ${esc(invoice.bankDetails.accountName)}</div>
        <div>A/c No: ${esc(invoice.bankDetails.accountNumber)}</div>
        <div>IFSC: ${esc(invoice.bankDetails.ifsc)}</div>
      </div>`
    : ''

  const terms = invoice.termsAndConditions
    ? `
      <div class="footer-block">
        <div class="footer-title">Terms &amp; Conditions</div>
        <div class="terms">${esc(invoice.termsAndConditions)}</div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    font-size: 12px;
    line-height: 1.5;
  }
  .page { padding: 32px 36px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 16px;
  }
  .seller { display: flex; gap: 14px; align-items: flex-start; }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .logo-placeholder {
    display: flex; align-items: center; justify-content: center;
    background: #1a1a1a; color: #fff; font-weight: 700; font-size: 20px;
    border-radius: 8px;
  }
  .company-name { font-size: 18px; font-weight: 700; }
  .seller-meta { font-size: 11px; color: #444; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 24px; letter-spacing: 2px; color: #1a1a1a; }
  .doc-meta { font-size: 11px; color: #444; margin-top: 6px; }
  .doc-meta div { margin-top: 2px; }
  .parties {
    display: flex; justify-content: space-between; gap: 24px; margin-top: 20px;
  }
  .party { width: 48%; }
  .party-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
    color: #888; margin-bottom: 4px;
  }
  .party-name { font-weight: 700; }
  table.items {
    width: 100%; border-collapse: collapse; margin-top: 22px;
  }
  table.items thead th {
    background: #1a1a1a; color: #fff; font-size: 11px; font-weight: 600;
    text-align: left; padding: 8px 10px;
  }
  table.items thead th.num { text-align: right; }
  table.items thead th.center { text-align: center; }
  table.items tbody td {
    padding: 8px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px;
  }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.center { text-align: center; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  table.totals-table { width: 300px; border-collapse: collapse; }
  table.totals-table td { padding: 5px 10px; font-size: 11px; }
  table.totals-table td.label { color: #444; }
  table.totals-table tr.grand td {
    border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 13px;
    padding-top: 8px;
  }
  .in-words {
    margin-top: 14px; padding: 10px 12px; background: #f5f5f5;
    border-radius: 6px; font-size: 11px;
  }
  .in-words strong { text-transform: uppercase; font-size: 10px; color: #888; }
  .footer {
    display: flex; justify-content: space-between; gap: 24px;
    margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5;
  }
  .footer-block { width: 48%; font-size: 10.5px; color: #444; }
  .footer-title {
    text-transform: uppercase; letter-spacing: 1px; color: #888;
    font-size: 9px; margin-bottom: 4px;
  }
  .terms { white-space: pre-wrap; }
  .signature {
    margin-top: 40px; text-align: right; font-size: 11px;
  }
  .signature .line { margin-top: 36px; border-top: 1px solid #888; width: 180px; margin-left: auto; }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="seller">
        ${logo}
        <div>
          <div class="company-name">${esc(seller.companyName || seller.name)}</div>
          <div class="seller-meta">
            ${seller.address ? `<div>${esc(seller.address)}</div>` : ''}
            ${seller.city || seller.state ? `<div>${esc([seller.city, seller.state].filter(Boolean).join(', '))}</div>` : ''}
            ${seller.gstin ? `<div>GSTIN: ${esc(seller.gstin)}</div>` : ''}
            ${seller.phone ? `<div>Ph: ${esc(seller.phone)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="doc-title">
        <h1>TAX INVOICE</h1>
        <div class="doc-meta">
          <div><strong>Invoice #:</strong> ${esc(invoice.invoiceNumber)}</div>
          <div><strong>Date:</strong> ${formatISTDate(invoice.invoiceDate)}</div>
          <div><strong>Due Date:</strong> ${formatISTDate(invoice.dueDate)}</div>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">Billed To</div>
        ${partyBlock(buyer)}
      </div>
      <div class="party" style="text-align:right">
        <div class="party-label">From</div>
        ${partyBlock(seller)}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Product</th>
          <th class="center">HSN</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsRows(invoice.lineItems)}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td class="label">Subtotal</td>
          <td class="num">${paiseToInvoiceAmount(invoice.subtotalPaise)}</td>
        </tr>
        ${taxRows(gst)}
        <tr class="grand">
          <td>Total</td>
          <td class="num">${paiseToInvoiceAmount(invoice.totalPaise)}</td>
        </tr>
      </table>
    </div>

    <div class="in-words">
      <strong>Amount in words:</strong> ${esc(paiseToWords(invoice.totalPaise))}
    </div>

    ${
      bank || terms
        ? `<div class="footer">${bank}${terms}</div>`
        : ''
    }

    <div class="signature">
      <div>For ${esc(seller.companyName || seller.name)}</div>
      <div class="line"></div>
      <div>Authorised Signatory</div>
    </div>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Puppeteer rendering
// ---------------------------------------------------------------------------

// True on Vercel / any serverless target — drives the Chromium choice below.
function isServerless(): boolean {
  return !!process.env.VERCEL_ENV || (!!process.env.AWS_LAMBDA_FUNCTION_NAME)
}

/**
 * Launches a Chromium browser appropriate to the runtime:
 *  - Serverless (Vercel): `puppeteer-core` driving `@sparticuz/chromium`'s
 *    Lambda-compatible binary.
 *  - Local / long-running Node: the full `puppeteer` package with its bundled
 *    Chromium (a devDependency).
 * Both are imported dynamically so the unused one is never loaded or bundled.
 */
async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteerCore = (await import('puppeteer-core')).default
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer = (await import('puppeteer' as any)).default
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }) as Promise<Browser>
}

/**
 * Renders the invoice to a PDF buffer (A4, print background). Works locally and
 * on Vercel serverless — see `launchBrowser()` for how Chromium is selected.
 */
export async function generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
  const html = buildInvoiceHtml(invoice)
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
