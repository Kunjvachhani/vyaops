import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import { paiseToCurrency } from '@/lib/utils/currency'
import type { Database } from '@/types/database'

type OrderRow = Database['public']['Tables']['orders']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type AsList<T> = T[] | null

// Invoice statuses that still owe money — i.e. can be overdue.
const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid', 'overdue'] as const

// Today's date in IST as YYYY-MM-DD — the boundary for "yesterday" and overdue.
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// YYYY-MM-DD shifted by whole days (negative = earlier).
function shiftDate(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

// Human label for the summary header, e.g. "18 Jun 2026" (IST).
function dateLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// GET /api/orders/daily-summary
// Internal-only (n8n daily-order-summary workflow). For EVERY org it computes the
// morning briefing — yesterday's orders (count + value), today's in-production
// orders (count), and overdue invoices (count + total) — and returns STRUCTURED
// data (one item per org) plus the owner's phone and language. The n8n workflow
// maps these fields into the Meta-approved `daily_morning_summary` template
// variables. Only orgs that (a) have an owner phone on file, (b) have opted in
// (whatsapp_proactive_enabled), and (c) have at least one data point are returned,
// so the workflow never sends an empty summary. All date math is in IST.
//
// Tier gating: daily_summaries is tier_1 (all orgs). No tier filter needed.
// When building compliance-reminder, filter for tier_3 only (features.ts).
// When building low-stock-alert, filter for tier_2+ (features.ts).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const today = istToday()
  const yesterday = shiftDate(today, -1)
  // Half-open IST window for "yesterday": [yesterday 00:00 IST, today 00:00 IST).
  // created_at is timestamptz, so an offset-qualified bound compares correctly.
  const yesterdayStart = `${yesterday}T00:00:00+05:30`
  const todayStart = `${today}T00:00:00+05:30`

  // Five batched queries across ALL orgs — grouped in memory below — rather than
  // N queries per org.
  const [orgsRes, ownersRes, yOrdersRes, prodRes, overdueRes] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id, name, language_preference, whatsapp_proactive_enabled')
      .eq('whatsapp_proactive_enabled', true)
      .is('deleted_at', null),
    adminClient
      .from('users')
      .select('organization_id, phone')
      .eq('role', 'owner')
      .eq('is_active', true)
      .is('deleted_at', null),
    adminClient
      .from('orders')
      .select('organization_id, total_amount_paise')
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart)
      .is('deleted_at', null),
    adminClient
      .from('orders')
      .select('organization_id')
      .eq('status', 'in_production')
      .is('deleted_at', null),
    adminClient
      .from('invoices')
      .select('organization_id, total_amount_paise')
      .in('status', UNPAID_STATUSES as unknown as string[])
      .lt('due_date', today)
      .is('deleted_at', null),
  ])

  const firstError =
    orgsRes.error || ownersRes.error || yOrdersRes.error || prodRes.error || overdueRes.error
  if (firstError) {
    captureWithContext(firstError, { action: 'GET /api/orders/daily-summary' })
    return NextResponse.json(
      { error: 'Failed to build daily summaries', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const orgs =
    (orgsRes.data as unknown as AsList<
      Pick<OrganizationRow, 'id' | 'name' | 'language_preference'>
    >) ?? []
  const owners =
    (ownersRes.data as unknown as AsList<Pick<UserRow, 'organization_id' | 'phone'>>) ?? []
  const yOrders =
    (yOrdersRes.data as unknown as AsList<Pick<OrderRow, 'organization_id' | 'total_amount_paise'>>) ??
    []
  const prodRows =
    (prodRes.data as unknown as AsList<Pick<OrderRow, 'organization_id'>>) ?? []
  const overdue =
    (overdueRes.data as unknown as AsList<
      Pick<InvoiceRow, 'organization_id' | 'total_amount_paise'>
    >) ?? []

  // First owner phone wins (one owner per org by design); blank phones ignored.
  const ownerPhone = new Map<string, string>()
  for (const o of owners) {
    const phone = o.phone?.trim()
    if (phone && !ownerPhone.has(o.organization_id)) ownerPhone.set(o.organization_id, phone)
  }

  const yOrderCount = new Map<string, number>()
  const yOrderValue = new Map<string, number>()
  for (const o of yOrders) {
    yOrderCount.set(o.organization_id, (yOrderCount.get(o.organization_id) ?? 0) + 1)
    yOrderValue.set(
      o.organization_id,
      (yOrderValue.get(o.organization_id) ?? 0) + (o.total_amount_paise ?? 0)
    )
  }

  const productionCount = new Map<string, number>()
  for (const o of prodRows) {
    productionCount.set(o.organization_id, (productionCount.get(o.organization_id) ?? 0) + 1)
  }

  const overdueCount = new Map<string, number>()
  const overdueValue = new Map<string, number>()
  for (const inv of overdue) {
    overdueCount.set(inv.organization_id, (overdueCount.get(inv.organization_id) ?? 0) + 1)
    overdueValue.set(
      inv.organization_id,
      (overdueValue.get(inv.organization_id) ?? 0) + (inv.total_amount_paise ?? 0)
    )
  }

  const label = dateLabel(today)
  let skippedNoOwner = 0
  let skippedNoData = 0

  const summaries = orgs
    .map((org) => {
      const phone = ownerPhone.get(org.id)
      if (!phone) {
        skippedNoOwner += 1
        return null
      }

      const ordersCount = yOrderCount.get(org.id) ?? 0
      const ordersValuePaise = yOrderValue.get(org.id) ?? 0
      const prodCount = productionCount.get(org.id) ?? 0
      const ovCount = overdueCount.get(org.id) ?? 0
      const ovValuePaise = overdueValue.get(org.id) ?? 0

      const hasData = ordersCount > 0 || prodCount > 0 || ovCount > 0
      if (!hasData) {
        skippedNoData += 1
        return null
      }

      // Locale-aware template selection happens in the n8n workflow; default any
      // unexpected value to 'en' so the workflow never picks a missing template.
      const locale: 'en' | 'gu' | 'hi' =
        org.language_preference === 'gu' || org.language_preference === 'hi'
          ? org.language_preference
          : 'en'

      // Structured data only — the n8n workflow maps these into the
      // daily_morning_summary template's six body variables ({{1}}–{{6}}).
      return {
        organization_id: org.id,
        owner_phone: phone,
        language_preference: locale,
        has_data: true,
        summary_date: today,
        date_label: label,
        yesterday_order_count: ordersCount,
        yesterday_value_formatted: paiseToCurrency(ordersValuePaise),
        production_count: prodCount,
        overdue_count: ovCount,
        overdue_total_formatted: paiseToCurrency(ovValuePaise),
        // Raw paise kept for analytics/debugging:
        yesterday_value_paise: ordersValuePaise,
        overdue_total_paise: ovValuePaise,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({
    summaries,
    meta: {
      as_of: today,
      total_orgs: orgs.length,
      eligible: summaries.length,
      skipped_no_owner: skippedNoOwner,
      skipped_no_data: skippedNoData,
    },
  })
}
