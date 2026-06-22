import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid']

function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// First day of the current month in IST as YYYY-MM-DD.
function istFirstOfMonth(): string {
  return `${istToday().slice(0, 7)}-01`
}

// GET /api/invoices/summary
// Aggregates for the dashboard summary cards (all amounts in paise):
//   - outstandingPaise: total still owed across unpaid invoices
//   - overduePaise: outstanding portion of invoices past their due date
//   - paidThisMonthPaise: payments recorded since the 1st of the current month
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()
  const today = istToday()

  const { data: unpaidRaw, error: unpaidErr } = await supabase
    .from('invoices')
    .select('total_amount_paise, paid_amount_paise, due_date')
    .eq('organization_id', user.org_id)
    .in('status', UNPAID_STATUSES)
    .is('deleted_at', null)

  if (unpaidErr) {
    console.error('[GET /api/invoices/summary] unpaid query', unpaidErr)
    return NextResponse.json({ error: 'Failed to load summary', code: 'DB_ERROR' }, { status: 500 })
  }

  type UnpaidRow = {
    total_amount_paise: number
    paid_amount_paise: number
    due_date: string
  }
  const unpaid = (unpaidRaw as unknown as UnpaidRow[] | null) ?? []

  let outstandingPaise = 0
  let overduePaise = 0
  for (const inv of unpaid) {
    const owed = inv.total_amount_paise - inv.paid_amount_paise
    outstandingPaise += owed
    if (inv.due_date < today) overduePaise += owed
  }

  const { data: paymentsRaw, error: payErr } = await supabase
    .from('payments')
    .select('amount_paise')
    .eq('organization_id', user.org_id)
    .gte('payment_date', istFirstOfMonth())
    .is('deleted_at', null)

  if (payErr) {
    console.error('[GET /api/invoices/summary] payments query', payErr)
    return NextResponse.json({ error: 'Failed to load summary', code: 'DB_ERROR' }, { status: 500 })
  }

  const payments = (paymentsRaw as unknown as { amount_paise: number }[] | null) ?? []
  const paidThisMonthPaise = payments.reduce((sum, p) => sum + p.amount_paise, 0)

  return NextResponse.json({
    data: {
      outstandingPaise,
      overduePaise,
      paidThisMonthPaise,
      unpaidCount: unpaid.length,
    },
  })
}
