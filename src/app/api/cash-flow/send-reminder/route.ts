import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-cloud-api'
import { PAYMENT_REMINDER_TEMPLATES, templateNameForLocale, metaLanguageCode } from '@/lib/whatsapp/templates'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { paiseToInvoiceAmount } from '@/lib/utils/currency'
import { formatISTDate } from '@/lib/utils/date'
import type { Database } from '@/types/database'
import type { TemplateComponent } from '@/types/whatsapp'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type OrgRow = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'language_preference'>

const BodySchema = z.object({
  invoice_id: z.string().uuid(),
})

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function reminderTier(count: number): keyof typeof PAYMENT_REMINDER_TEMPLATES {
  if (count === 0) return 'GENTLE'
  if (count === 1) return 'FOLLOWUP'
  if (count === 2) return 'URGENT'
  return 'FINAL'
}

// POST /api/cash-flow/send-reminder
// Owner-triggered WhatsApp payment reminder from the cash flow dashboard.
// Selects the escalation tier automatically from invoice.reminder_count, then
// stamps last_reminder_at / reminder_count so the cron de-duplicates correctly.
// Requires owner or manager role.
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
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { invoice_id } = parsed.data

  // Load invoice + customer in one query scoped to the caller's org
  const { data: rowRaw, error: fetchErr } = await adminClient
    .from('invoices')
    .select('id, organization_id, invoice_number, total_amount_paise, paid_amount_paise, due_date, reminder_count, status, customers(id, name, phone)')
    .eq('id', invoice_id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchErr) {
    captureWithContext(fetchErr, { action: 'POST /api/cash-flow/send-reminder/fetch', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to load invoice', code: 'DB_ERROR' }, { status: 500 })
  }

  type RawRow = InvoiceRow & { customers: Pick<CustomerRow, 'id' | 'name' | 'phone'> | null }
  const row = rowRaw as unknown as RawRow | null

  if (!row) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const customerPhone = row.customers?.phone ?? null
  if (!customerPhone) {
    return NextResponse.json({ error: 'Customer has no WhatsApp number on file', code: 'NO_CUSTOMER_PHONE' }, { status: 422 })
  }

  // Load org language preference for template localisation
  const { data: orgRaw } = await adminClient
    .from('organizations')
    .select('id, language_preference')
    .eq('id', user.org_id)
    .maybeSingle()

  const org = orgRaw as unknown as OrgRow | null
  const locale = (org?.language_preference as 'en' | 'gu' | 'hi' | null) ?? 'en'

  const tier = reminderTier(row.reminder_count)
  const baseTemplateName = PAYMENT_REMINDER_TEMPLATES[tier]
  const templateName = templateNameForLocale(baseTemplateName, locale)
  const langCode = metaLanguageCode(locale)

  const outstanding = row.total_amount_paise - row.paid_amount_paise
  const components: TemplateComponent[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: row.customers?.name ?? '' },
        { type: 'text', text: row.invoice_number },
        { type: 'text', text: paiseToInvoiceAmount(outstanding) },
        { type: 'text', text: formatISTDate(new Date(row.due_date)) },
      ],
    },
  ]

  const result = await sendTemplateMessage(customerPhone, templateName, langCode, components, user.org_id)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'WhatsApp send failed', code: 'WHATSAPP_SEND_FAILED' },
      { status: 502 }
    )
  }

  // Stamp last_reminder_at and bump reminder_count
  const now = new Date().toISOString()
  const nextCount = row.reminder_count + 1

  const { error: updateErr } = await adminClient
    .from('invoices')
    .update({ last_reminder_at: now, reminder_count: nextCount })
    .eq('id', invoice_id)
    .eq('organization_id', user.org_id)

  if (updateErr) {
    captureWithContext(updateErr, { action: 'POST /api/cash-flow/send-reminder/update', org_id: user.org_id, user_role: user.role })
    // Reminder was sent; only bookkeeping failed. Return success with warning.
    return NextResponse.json({ sent: true, messageId: result.messageId, warning: 'STATE_UPDATE_FAILED' })
  }

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'invoice',
    entity_id: invoice_id,
    changes: [
      { field: 'reminder_count', old_value: row.reminder_count, new_value: nextCount },
      { field: 'last_reminder_at', old_value: row.last_reminder_at ?? null, new_value: now },
    ],
    metadata: { reminder_tier: tier.toLowerCase(), source: 'cash_flow_dashboard' },
    ip_address: getIp(req),
  })

  return NextResponse.json({ sent: true, messageId: result.messageId, reminder_count: nextCount })
}
