import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import { paiseToInvoiceAmount } from '@/lib/utils/currency'
import type { Database } from '@/types/database'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

type AsList<T> = T[] | null

// Statuses that still owe money and are therefore eligible to be overdue.
// 'overdue' is included to also catch invoices explicitly marked overdue.
const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid', 'overdue'] as const

// Reminder escalation tiers keyed by how many days an invoice is past due.
// Each tier maps to a distinct Meta-approved template (see docs/whatsapp/TEMPLATES.md).
type ReminderTier = 'gentle' | 'follow_up' | 'urgent' | 'final'

function reminderTier(daysOverdue: number): {
  tier: ReminderTier
  templateName: string
} {
  if (daysOverdue <= 3) return { tier: 'gentle', templateName: 'payment_reminder_gentle' }
  if (daysOverdue <= 7) return { tier: 'follow_up', templateName: 'payment_reminder_followup' }
  if (daysOverdue <= 14) return { tier: 'urgent', templateName: 'payment_reminder_urgent' }
  return { tier: 'final', templateName: 'payment_reminder_final' }
}

// Today's date in IST as YYYY-MM-DD — the boundary for overdue comparisons.
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// The IST calendar date of an ISO timestamp, or null. Used to decide whether a
// reminder already went out "today" regardless of the stored UTC instant.
function istDateOf(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// Whole calendar days between two YYYY-MM-DD dates (later - earlier).
function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`)
  const b = Date.parse(`${later}T00:00:00Z`)
  return Math.floor((b - a) / 86_400_000)
}

// GET /api/invoices/overdue
// Internal-only (n8n payment-reminder workflow). Returns overdue, still-unpaid
// invoices ACROSS ALL ORGS, each annotated with days overdue, the reminder tier
// + template to use, and the customer phone — everything the workflow needs to
// fan out and send. Invoices already reminded today (IST) are excluded unless
// ?include_reminded=true. Invoices without a customer phone are skipped.
export async function GET(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const includeReminded = request.nextUrl.searchParams.get('include_reminded') === 'true'
  const today = istToday()

  const { data: rowsRaw, error } = await adminClient
    .from('invoices')
    .select(
      'id, organization_id, invoice_number, total_amount_paise, due_date, status, reminder_count, last_reminder_at, customers(id, name, company_name, phone)'
    )
    .in('status', UNPAID_STATUSES as unknown as string[])
    .lt('due_date', today)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (error) {
    captureWithContext(error, { action: 'GET /api/invoices/overdue' })
    return NextResponse.json(
      { error: 'Failed to fetch overdue invoices', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  type OverdueRow = Pick<
    InvoiceRow,
    | 'id'
    | 'organization_id'
    | 'invoice_number'
    | 'total_amount_paise'
    | 'due_date'
    | 'status'
    | 'reminder_count'
    | 'last_reminder_at'
  > & {
    customers: Pick<CustomerRow, 'id' | 'name' | 'company_name' | 'phone'> | null
  }

  const rows = (rowsRaw as unknown as AsList<OverdueRow>) ?? []

  let skippedNoPhone = 0
  let skippedRemindedToday = 0

  const data = rows
    .map((inv) => {
      const phone = inv.customers?.phone?.trim() ?? ''
      if (!phone) {
        skippedNoPhone += 1
        return null
      }

      const daysOverdue = daysBetween(inv.due_date, today)
      const remindedToday = istDateOf(inv.last_reminder_at) === today
      if (remindedToday && !includeReminded) {
        skippedRemindedToday += 1
        return null
      }

      const { tier, templateName } = reminderTier(daysOverdue)
      const amountDisplay = paiseToInvoiceAmount(inv.total_amount_paise)
      // Prefer company name for the salutation, fall back to contact name.
      const customerName = inv.customers?.company_name?.trim() || inv.customers?.name || 'Customer'

      return {
        id: inv.id,
        organization_id: inv.organization_id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customers?.id ?? null,
        customer_name: customerName,
        customer_phone: phone,
        total_amount_paise: inv.total_amount_paise,
        amount_display: amountDisplay,
        due_date: inv.due_date,
        days_overdue: daysOverdue,
        reminder_tier: tier,
        template_name: templateName,
        language_code: 'en',
        reminder_count: inv.reminder_count,
        last_reminder_at: inv.last_reminder_at,
        reminded_today: remindedToday,
        // Ordered to match the payment_reminder template body variables
        // {{1}} customer, {{2}} invoice number, {{3}} amount, {{4}} days overdue.
        template_params: [
          customerName,
          inv.invoice_number,
          amountDisplay,
          String(daysOverdue),
        ],
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({
    invoices: data,
    meta: {
      as_of: today,
      total_overdue: rows.length,
      eligible: data.length,
      skipped_no_phone: skippedNoPhone,
      skipped_reminded_today: skippedRemindedToday,
    },
  })
}
