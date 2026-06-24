import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'
import { requireTier } from '@/lib/utils/feature-gate'

function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function diffDays(dateStr: string, today: string): number {
  const d1 = new Date(`${dateStr}T00:00:00`).getTime()
  const d2 = new Date(`${today}T00:00:00`).getTime()
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))
}

type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1_30'
  if (daysOverdue <= 60) return '31_60'
  if (daysOverdue <= 90) return '61_90'
  return '90_plus'
}

type RawInvoice = {
  id: string
  invoice_number: string
  total_amount_paise: number
  paid_amount_paise: number
  due_date: string
  status: string
  reminder_count: number
  last_reminder_at: string | null
  customers: { id: string; name: string; phone: string | null } | null
}

type RawVendorOrder = {
  id: string
  po_number: string
  material_name: string
  total_amount_paise: number | null
  expected_date: string | null
  status: string
  vendors: { id: string; name: string } | null
}

// GET /api/cash-flow
// Returns receivables (unpaid invoices with aging), payables (pending vendor
// orders), a 30-day daily forecast, and summary card totals.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const gate = await requireTier('tier_2', user.org_id)
  if (gate) return gate

  const supabase = await createClient()
  const today = istToday()
  const in30Days = addDays(today, 30)

  // Unpaid invoices with customer join
  const { data: invoicesRaw, error: invoicesErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount_paise, paid_amount_paise, due_date, status, reminder_count, last_reminder_at, customers(id, name, phone)')
    .eq('organization_id', user.org_id)
    .in('status', ['draft', 'sent', 'partially_paid'])
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (invoicesErr) {
    captureWithContext(invoicesErr, { action: 'GET /api/cash-flow/invoices', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to load receivables', code: 'DB_ERROR' }, { status: 500 })
  }

  // Pending vendor orders with vendor join
  const { data: vendorOrdersRaw, error: voErr } = await supabase
    .from('vendor_orders')
    .select('id, po_number, material_name, total_amount_paise, expected_date, status, vendors(id, name)')
    .eq('organization_id', user.org_id)
    .in('status', ['pending', 'confirmed', 'partial'])
    .is('deleted_at', null)
    .order('expected_date', { ascending: true, nullsFirst: false })

  if (voErr) {
    captureWithContext(voErr, { action: 'GET /api/cash-flow/vendor_orders', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to load payables', code: 'DB_ERROR' }, { status: 500 })
  }

  const invoices = (invoicesRaw as unknown as RawInvoice[] | null) ?? []
  const vendorOrders = (vendorOrdersRaw as unknown as RawVendorOrder[] | null) ?? []

  // Build receivables with aging
  const receivables = invoices.map((inv) => {
    const outstanding = inv.total_amount_paise - inv.paid_amount_paise
    const daysOverdue = diffDays(inv.due_date, today)
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_amount_paise: inv.total_amount_paise,
      paid_amount_paise: inv.paid_amount_paise,
      outstanding_paise: outstanding,
      due_date: inv.due_date,
      days_overdue: Math.max(0, daysOverdue),
      is_overdue: daysOverdue > 0,
      status: inv.status,
      reminder_count: inv.reminder_count,
      last_reminder_at: inv.last_reminder_at,
      aging_bucket: agingBucket(daysOverdue),
      customer: inv.customers ?? { id: '', name: 'Unknown', phone: null },
    }
  })

  // Build payables
  const payables = vendorOrders.map((vo) => ({
    id: vo.id,
    po_number: vo.po_number,
    material_name: vo.material_name,
    total_amount_paise: vo.total_amount_paise ?? 0,
    expected_date: vo.expected_date,
    status: vo.status,
    vendor: vo.vendors ?? { id: '', name: 'Unknown' },
  }))

  // Build 30-day forecast — daily inflow/outflow buckets
  const forecastMap = new Map<string, { inflow: number; outflow: number }>()
  for (let i = 0; i <= 30; i++) {
    forecastMap.set(addDays(today, i), { inflow: 0, outflow: 0 })
  }

  for (const r of receivables) {
    if (r.due_date >= today && r.due_date <= in30Days) {
      const entry = forecastMap.get(r.due_date)
      if (entry) entry.inflow += r.outstanding_paise
    }
  }

  for (const p of payables) {
    if (p.expected_date && p.expected_date >= today && p.expected_date <= in30Days) {
      const entry = forecastMap.get(p.expected_date)
      if (entry) entry.outflow += p.total_amount_paise
    }
  }

  const forecast = Array.from(forecastMap.entries()).map(([date, { inflow, outflow }]) => ({
    date,
    inflow_paise: inflow,
    outflow_paise: outflow,
    net_paise: inflow - outflow,
  }))

  // Summary cards
  const totalReceivablesPaise = receivables.reduce((s, r) => s + r.outstanding_paise, 0)
  const totalPayablesPaise = payables.reduce((s, p) => s + p.total_amount_paise, 0)

  const largestOutstanding = receivables.reduce<typeof receivables[0] | null>(
    (max, r) => (r.outstanding_paise > (max?.outstanding_paise ?? 0) ? r : max),
    null
  )

  return NextResponse.json({
    data: {
      receivables,
      payables,
      forecast,
      summary: {
        total_receivables_paise: totalReceivablesPaise,
        total_payables_paise: totalPayablesPaise,
        net_position_paise: totalReceivablesPaise - totalPayablesPaise,
        largest_outstanding: largestOutstanding
          ? {
              customer_name: largestOutstanding.customer.name,
              amount_paise: largestOutstanding.outstanding_paise,
            }
          : null,
      },
    },
  })
}
