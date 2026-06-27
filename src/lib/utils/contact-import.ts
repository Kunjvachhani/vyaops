// Contact-import parsing for the onboarding wizard (Step 3).
// Server-only: pulls in exceljs + pdf-parse. Never import from a client component.
//
// Strategy: every source (CSV/TSV text, XLSX, PDF) is reduced to rows of string
// "cells", then each row is classified position-agnostically — the cell that
// looks like a phone number is the phone; the first remaining text cell is the
// name; the next is the city. This survives messy real-world files where the
// column order is not guaranteed.

import ExcelJS from 'exceljs'
import { PDFParse } from 'pdf-parse'

export type ParsedContact = { name: string; phone: string; city: string }

const MAX_ROWS = 200

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function isPhoneCell(cell: string): boolean {
  const d = digitsOnly(cell)
  return d.length >= 10 && d.length <= 13
}

function looksLikeHeader(cells: string[]): boolean {
  if (cells.some(isPhoneCell)) return false
  const joined = cells.join(' ').toLowerCase()
  return /name|phone|mobile|number|city|town|નામ|नाम|ફોન|फ़ोन|शहर|શહેર/.test(joined)
}

function classifyCells(cells: string[]): ParsedContact | null {
  const trimmed = cells.map((c) => c.trim()).filter(Boolean)
  if (trimmed.length === 0) return null

  const phoneIdx = trimmed.findIndex(isPhoneCell)
  const phone = phoneIdx >= 0 ? trimmed[phoneIdx] : ''
  const rest = trimmed.filter((_, i) => i !== phoneIdx)

  const name = rest[0] ?? ''
  const city = rest[1] ?? ''

  if (!name) return null // skip phone-only / empty rows — a customer needs a name
  return { name, phone, city }
}

function rowsToContacts(rows: string[][]): ParsedContact[] {
  const out: ParsedContact[] = []
  rows.forEach((cells, i) => {
    if (i === 0 && looksLikeHeader(cells)) return
    const contact = classifyCells(cells)
    if (contact && out.length < MAX_ROWS) out.push(contact)
  })
  return out
}

// ─── CSV / TSV / plain text ──────────────────────────────────────────────────

function splitTextRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  // Fall back to 2+ spaces as a separator (common in copy-pasted / PDF text).
  return line.split(/\s{2,}/)
}

export function parseDelimitedText(text: string): ParsedContact[] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(splitTextRow)
  return rowsToContacts(rows)
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedContact[]> {
  const workbook = new ExcelJS.Workbook()
  // exceljs expects a Node Buffer — passing a raw ArrayBuffer throws at runtime.
  // Cast to the method's exact param type to sidestep a @types/node Buffer-generic mismatch.
  const data = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0]
  await workbook.xlsx.load(data)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: string[][] = []
  sheet.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values : []
    // exceljs row.values is 1-indexed (index 0 is empty); cell may be object/number.
    const cells = values
      .slice(1)
      .map((v) => (v == null ? '' : typeof v === 'object' && 'text' in v ? String(v.text) : String(v)))
    rows.push(cells)
  })
  return rowsToContacts(rows)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function parsePdf(buffer: ArrayBuffer): Promise<ParsedContact[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return parseDelimitedText(result.text)
  } finally {
    await parser.destroy()
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function parseContacts(
  filename: string,
  mime: string,
  buffer: ArrayBuffer
): Promise<ParsedContact[]> {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || mime.includes('spreadsheetml')) {
    return parseXlsx(buffer)
  }
  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    return parsePdf(buffer)
  }
  // CSV / TSV / plain text default.
  return parseDelimitedText(new TextDecoder().decode(buffer))
}
