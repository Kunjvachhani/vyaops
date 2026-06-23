import type { Browser } from 'puppeteer-core'
import { paiseToInvoiceAmount } from './currency'
import { formatISTDate } from './date'

export type POVendor = {
  name: string
  companyName?: string | null
  address?: string | null
  phone?: string | null
  gstin?: string | null
  email?: string | null
}

export type POBuyer = {
  name: string
  companyName?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  gstin?: string | null
  phone?: string | null
}

export type POData = {
  poNumber: string
  poDate: Date
  expectedDate?: Date | null
  vendor: POVendor
  buyer: POBuyer
  materialName: string
  quantity: number
  unit: string
  unitPricePaise?: number | null
  totalAmountPaise?: number | null
  paymentTermsDays?: number | null
  notes?: string | null
  logoUrl?: string | null
}

function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildPOHtml(po: POData): string {
  const { buyer, vendor } = po

  const logo = po.logoUrl
    ? `<img class="logo" src="${esc(po.logoUrl)}" alt="Logo" />`
    : `<div class="logo logo-placeholder">${esc(buyer.companyName || buyer.name).slice(0, 2).toUpperCase()}</div>`

  const buyerLocation = [buyer.city, buyer.state].filter(Boolean).join(', ')

  const itemRow =
    po.unitPricePaise != null
      ? `<tr>
          <td>${esc(po.materialName)}</td>
          <td class="num">${po.quantity} ${esc(po.unit)}</td>
          <td class="num">${paiseToInvoiceAmount(po.unitPricePaise)}</td>
          <td class="num">${po.totalAmountPaise != null ? paiseToInvoiceAmount(po.totalAmountPaise) : '-'}</td>
        </tr>`
      : `<tr>
          <td>${esc(po.materialName)}</td>
          <td class="num">${po.quantity} ${esc(po.unit)}</td>
          <td class="num">-</td>
          <td class="num">-</td>
        </tr>`

  const totalBlock =
    po.totalAmountPaise != null
      ? `<div class="totals">
          <table class="totals-table">
            <tr class="grand">
              <td>Total</td>
              <td class="num">${paiseToInvoiceAmount(po.totalAmountPaise)}</td>
            </tr>
          </table>
        </div>`
      : ''

  const paymentBlock =
    po.paymentTermsDays != null
      ? `<div class="footer-block">
          <div class="footer-title">Payment Terms</div>
          <div>Net ${po.paymentTermsDays} days</div>
        </div>`
      : ''

  const notesBlock = po.notes
    ? `<div class="footer-block">
        <div class="footer-title">Notes</div>
        <div class="terms">${esc(po.notes)}</div>
      </div>`
    : ''

  const footer =
    paymentBlock || notesBlock ? `<div class="footer">${paymentBlock}${notesBlock}</div>` : ''

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
  .buyer-block { display: flex; gap: 14px; align-items: flex-start; }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .logo-placeholder {
    display: flex; align-items: center; justify-content: center;
    background: #1a1a1a; color: #fff; font-weight: 700; font-size: 20px;
    border-radius: 8px; width: 56px; height: 56px; flex-shrink: 0;
  }
  .company-name { font-size: 18px; font-weight: 700; }
  .buyer-meta { font-size: 11px; color: #444; }
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
  table.items tbody td {
    padding: 8px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px;
  }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  table.totals-table { width: 300px; border-collapse: collapse; }
  table.totals-table td { padding: 5px 10px; font-size: 11px; }
  table.totals-table tr.grand td {
    border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 13px;
    padding-top: 8px;
  }
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
  .signature .line {
    margin-top: 36px; border-top: 1px solid #888; width: 180px; margin-left: auto;
  }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="buyer-block">
        ${logo}
        <div>
          <div class="company-name">${esc(buyer.companyName || buyer.name)}</div>
          <div class="buyer-meta">
            ${buyer.address ? `<div>${esc(buyer.address)}</div>` : ''}
            ${buyerLocation ? `<div>${esc(buyerLocation)}</div>` : ''}
            ${buyer.gstin ? `<div>GSTIN: ${esc(buyer.gstin)}</div>` : ''}
            ${buyer.phone ? `<div>Ph: ${esc(buyer.phone)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="doc-title">
        <h1>PURCHASE ORDER</h1>
        <div class="doc-meta">
          <div><strong>PO #:</strong> ${esc(po.poNumber)}</div>
          <div><strong>Date:</strong> ${formatISTDate(po.poDate)}</div>
          ${po.expectedDate ? `<div><strong>Delivery By:</strong> ${formatISTDate(po.expectedDate)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">From (Buyer)</div>
        <div class="party-name">${esc(buyer.companyName || buyer.name)}</div>
        ${buyer.address ? `<div>${esc(buyer.address)}</div>` : ''}
        ${buyerLocation ? `<div>${esc(buyerLocation)}</div>` : ''}
        ${buyer.gstin ? `<div><strong>GSTIN:</strong> ${esc(buyer.gstin)}</div>` : ''}
        ${buyer.phone ? `<div><strong>Ph:</strong> ${esc(buyer.phone)}</div>` : ''}
      </div>
      <div class="party" style="text-align:right">
        <div class="party-label">To (Vendor)</div>
        <div class="party-name">${esc(vendor.companyName || vendor.name)}</div>
        ${vendor.address ? `<div>${esc(vendor.address)}</div>` : ''}
        ${vendor.gstin ? `<div><strong>GSTIN:</strong> ${esc(vendor.gstin)}</div>` : ''}
        ${vendor.phone ? `<div><strong>Ph:</strong> ${esc(vendor.phone)}</div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Material</th>
          <th class="num">Quantity</th>
          <th class="num">Unit Price</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRow}
      </tbody>
    </table>

    ${totalBlock}

    ${footer}

    <div class="signature">
      <div>For ${esc(buyer.companyName || buyer.name)}</div>
      <div class="line"></div>
      <div>Authorised Signatory</div>
    </div>
  </div>
</body>
</html>`
}

function isServerless(): boolean {
  return !!process.env.VERCEL_ENV || !!process.env.AWS_LAMBDA_FUNCTION_NAME
}

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

export async function generatePOPdf(po: POData): Promise<Buffer> {
  const html = buildPOHtml(po)
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
