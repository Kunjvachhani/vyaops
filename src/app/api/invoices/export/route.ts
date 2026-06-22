import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { buildCsvResponse } from '@/lib/utils/csv-export'
import { formatISTDate } from '@/lib/utils/date'
import { captureWithContext } from '@/lib/utils/sentry'

const EXPORT_LIMIT = 10_000
const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid'] as const

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// GET /api/invoices/export?statuses=sent,partially_paid&date_from=2026-01-01
// Exports all invoices matching the current filter state as a CSV download.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const statusParam = sp.get('statuses') ?? sp.get('status')
  const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const customerId = sp.get('customer_id')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)

  const supabase = await createClient()

  type InvoiceExportRow = {
    invoice_number: string
    status: string
    subtotal_paise: number
    tax_amount_paise: number
    total_amount_paise: number
    due_date: string
    created_at: string
    customers: { name: string } | null
  }

  let query = supabase
    .from('invoices')
    .select('invoice_number, status, subtotal_paise, tax_amount_paise, total_amount_paise, due_date, created_at, customers(name)')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .limit(EXPORT_LIMIT)

  const wantsOverdue = statuses.includes('overdue')
  const concreteStatuses = statuses.filter((s) => s !== 'overdue')
  const today = istToday()

  if (wantsOverdue && concreteStatuses.length === 0) {
    query = query.lt('due_date', today).in('status', UNPAID_STATUSES as unknown as string[])
  } else if (concreteStatuses.length === 1) {
    query = query.eq('status', concreteStatuses[0])
  } else if (concreteStatuses.length > 1) {
    query = query.in('status', concreteStatuses)
  }

  if (customerId) query = query.eq('customer_id', customerId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  if (search) query = query.ilike('invoice_number', `%${search}%`)

  const { data: invoicesRaw, error } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/invoices/export', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to export invoices', code: 'DB_ERROR' }, { status: 500 })
  }

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceExportRow[]

  const headers = ['Invoice#', 'Customer', 'Amount(₹)', 'GST(₹)', 'Total(₹)', 'Status', 'Due Date']
  const rows = invoices.map((inv) => {
    const effectiveStatus =
      (UNPAID_STATUSES as readonly string[]).includes(inv.status) && inv.due_date < today
        ? 'overdue'
        : inv.status
    return [
      inv.invoice_number,
      inv.customers?.name ?? '',
      (inv.subtotal_paise / 100).toFixed(2),
      (inv.tax_amount_paise / 100).toFixed(2),
      (inv.total_amount_paise / 100).toFixed(2),
      effectiveStatus,
      formatISTDate(new Date(inv.due_date)),
    ]
  })

  const today2 = new Date().toISOString().slice(0, 10)
  return buildCsvResponse(headers, rows, `vyaops-invoices-${today2}.csv`)
}
