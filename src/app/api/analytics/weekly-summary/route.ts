import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import { paiseToCurrency } from '@/lib/utils/currency'
import type { Database } from '@/types/database'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

type AsList<T> = T[] | null

// Minutes saved per WhatsApp-sourced event (mirrors rupees-saved.ts constants).
const MINUTES_PER_ORDER = 15
const MINUTES_PER_BATCH = 10
const HOURLY_VALUE_PAISE = 20_000 // ₹200/hour in paise

// IST date helpers.
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function shiftDate(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

// "16 Jun" (no year for the start, year appended to end for compactness).
function shortDateLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  })
}

function yearLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  })
}

// "16–22 Jun 2026"
function weekRangeLabel(startYmd: string, endYmd: string): string {
  return `${shortDateLabel(startYmd)}–${shortDateLabel(endYmd)} ${yearLabel(endYmd)}`
}

// GET /api/analytics/weekly-summary
// Internal-only (n8n weekly-summary workflow, fires Sunday 9 AM IST). Returns a
// weekly business digest for every tier_2+ org with proactive WhatsApp enabled:
//   - Orders: count + total value (last 7 days)
//   - Production: total pieces produced + yield % (last 7 days)
//   - Collections: invoices paid this week (paid_date in window)
//   - ₹ Saved: time savings only (WhatsApp orders + batches × fixed rates)
//   - Top customer: name + weekly order value (formatted string)
//
// Savings uses time-savings-only as a lightweight weekly proxy (the full
// multi-factor calculation requires per-org historical baselines, which are
// expensive to compute across all orgs in one run; the monthly dashboard uses
// the full engine). This is clearly labelled in the template copy.
//
// Feature gate: tier_2+ (production + inventory + rupee_saved are all tier_2).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const today = istToday()
  const weekStartYmd = shiftDate(today, -6)
  const weekStart = `${weekStartYmd}T00:00:00+05:30`
  const weekEnd = `${today}T23:59:59+05:30`

  // Eight batched queries across all orgs — grouped in memory below.
  const [
    orgsRes,
    ownersRes,
    ordersRes,
    waOrdersRes,
    productionRes,
    waBatchesRes,
    collectionsRes,
    topCustomerOrdersRes,
  ] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id, language_preference, whatsapp_proactive_enabled, tier')
      .eq('whatsapp_proactive_enabled', true)
      .in('tier', ['tier_2', 'tier_3'])
      .is('deleted_at', null),
    adminClient
      .from('users')
      .select('organization_id, phone')
      .eq('role', 'owner')
      .eq('is_active', true)
      .is('deleted_at', null),
    // All orders this week (any source) for count + value.
    adminClient
      .from('orders')
      .select('organization_id, total_amount_paise')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .is('deleted_at', null),
    // WhatsApp-sourced orders for time-savings calculation.
    adminClient
      .from('orders')
      .select('organization_id')
      .eq('source', 'whatsapp')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .is('deleted_at', null),
    // Production batches for pieces + yield.
    adminClient
      .from('production_batches')
      .select('organization_id, quantity_produced, quantity_rejected')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .is('deleted_at', null),
    // WhatsApp-sourced batches for time-savings calculation.
    adminClient
      .from('production_batches')
      .select('organization_id')
      .eq('source', 'whatsapp')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .is('deleted_at', null),
    // Invoices paid this week (paid_date, not created_at).
    adminClient
      .from('invoices')
      .select('organization_id, total_amount_paise')
      .eq('status', 'paid')
      .gte('paid_date', weekStartYmd)
      .lte('paid_date', today)
      .is('deleted_at', null),
    // Orders with customer_id for top-customer aggregation.
    adminClient
      .from('orders')
      .select('organization_id, customer_id, total_amount_paise, customers(id, name)')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .is('deleted_at', null)
      .not('customer_id', 'is', null),
  ])

  const firstError =
    orgsRes.error ||
    ownersRes.error ||
    ordersRes.error ||
    waOrdersRes.error ||
    productionRes.error ||
    waBatchesRes.error ||
    collectionsRes.error ||
    topCustomerOrdersRes.error

  if (firstError) {
    captureWithContext(firstError, { action: 'GET /api/analytics/weekly-summary' })
    return NextResponse.json(
      { error: 'Failed to build weekly summaries', code: 'DB_ERROR' },
      { status: 500 },
    )
  }

  type OrgFields = Pick<OrganizationRow, 'id' | 'language_preference'>
  type UserFields = Pick<UserRow, 'organization_id' | 'phone'>
  type OrderFields = Pick<OrderRow, 'organization_id' | 'total_amount_paise'>
  type WaOrderFields = Pick<OrderRow, 'organization_id'>
  type BatchFields = Pick<ProductionBatchRow, 'organization_id' | 'quantity_produced' | 'quantity_rejected'>
  type WaBatchFields = Pick<ProductionBatchRow, 'organization_id'>
  type InvoiceFields = Pick<InvoiceRow, 'organization_id' | 'total_amount_paise'>
  type TopCustomerOrderFields = Pick<OrderRow, 'organization_id' | 'customer_id' | 'total_amount_paise'> & {
    customers: Pick<CustomerRow, 'id' | 'name'> | null
  }

  const orgs = (orgsRes.data as unknown as AsList<OrgFields>) ?? []
  const owners = (ownersRes.data as unknown as AsList<UserFields>) ?? []
  const orders = (ordersRes.data as unknown as AsList<OrderFields>) ?? []
  const waOrders = (waOrdersRes.data as unknown as AsList<WaOrderFields>) ?? []
  const batches = (productionRes.data as unknown as AsList<BatchFields>) ?? []
  const waBatches = (waBatchesRes.data as unknown as AsList<WaBatchFields>) ?? []
  const collections = (collectionsRes.data as unknown as AsList<InvoiceFields>) ?? []
  const topCustOrders = (topCustomerOrdersRes.data as unknown as AsList<TopCustomerOrderFields>) ?? []

  // Build lookup maps.
  const ownerPhone = new Map<string, string>()
  for (const u of owners) {
    const phone = u.phone?.trim()
    if (phone && !ownerPhone.has(u.organization_id)) ownerPhone.set(u.organization_id, phone)
  }

  const orderCount = new Map<string, number>()
  const orderValue = new Map<string, number>()
  for (const o of orders) {
    orderCount.set(o.organization_id, (orderCount.get(o.organization_id) ?? 0) + 1)
    orderValue.set(o.organization_id, (orderValue.get(o.organization_id) ?? 0) + (o.total_amount_paise ?? 0))
  }

  const waOrderCount = new Map<string, number>()
  for (const o of waOrders) {
    waOrderCount.set(o.organization_id, (waOrderCount.get(o.organization_id) ?? 0) + 1)
  }

  const batchProduced = new Map<string, number>()
  const batchRejected = new Map<string, number>()
  for (const b of batches) {
    batchProduced.set(b.organization_id, (batchProduced.get(b.organization_id) ?? 0) + b.quantity_produced)
    batchRejected.set(b.organization_id, (batchRejected.get(b.organization_id) ?? 0) + b.quantity_rejected)
  }

  const waBatchCount = new Map<string, number>()
  for (const b of waBatches) {
    waBatchCount.set(b.organization_id, (waBatchCount.get(b.organization_id) ?? 0) + 1)
  }

  const collectionValue = new Map<string, number>()
  for (const inv of collections) {
    collectionValue.set(inv.organization_id, (collectionValue.get(inv.organization_id) ?? 0) + (inv.total_amount_paise ?? 0))
  }

  // Top customer per org: aggregate order value per (org, customer), pick max.
  const custTotals = new Map<string, Map<string, { name: string; total: number }>>()
  for (const o of topCustOrders) {
    if (!o.customer_id || !o.customers?.name) continue
    if (!custTotals.has(o.organization_id)) custTotals.set(o.organization_id, new Map())
    const byOrg = custTotals.get(o.organization_id)!
    const prev = byOrg.get(o.customer_id)
    byOrg.set(o.customer_id, {
      name: o.customers.name,
      total: (prev?.total ?? 0) + (o.total_amount_paise ?? 0),
    })
  }

  const weekRange = weekRangeLabel(weekStartYmd, today)
  let skippedNoOwner = 0
  let skippedNoData = 0

  const summaries = orgs
    .map((org) => {
      const phone = ownerPhone.get(org.id)
      if (!phone) {
        skippedNoOwner += 1
        return null
      }

      const ordersThisWeek = orderCount.get(org.id) ?? 0
      const orderValuePaise = orderValue.get(org.id) ?? 0
      const waOrdersCount = waOrderCount.get(org.id) ?? 0
      const produced = batchProduced.get(org.id) ?? 0
      const rejected = batchRejected.get(org.id) ?? 0
      const waBatchesCount = waBatchCount.get(org.id) ?? 0
      const collectedPaise = collectionValue.get(org.id) ?? 0

      const hasData = ordersThisWeek > 0 || produced > 0 || collectedPaise > 0
      if (!hasData) {
        skippedNoData += 1
        return null
      }

      // Production summary string: "850 pcs (94.2% yield)" or "0 pcs" if none.
      let productionSummary: string
      if (produced > 0) {
        const yield_ = ((produced - rejected) / produced) * 100
        productionSummary = `${produced} pcs (${yield_.toFixed(1)}% yield)`
      } else {
        productionSummary = '0 pcs'
      }

      // Time-savings only (lightweight weekly proxy).
      const minutesSaved = waOrdersCount * MINUTES_PER_ORDER + waBatchesCount * MINUTES_PER_BATCH
      const hoursSaved = minutesSaved / 60
      const savedPaise = Math.round(hoursSaved * HOURLY_VALUE_PAISE)
      const rupeesSaved = savedPaise > 0 ? paiseToCurrency(savedPaise) : '₹0'

      // Top customer string: "Mehta Steel — ₹85,000" or "—" if no order data.
      let topCustomer = '—'
      const byOrg = custTotals.get(org.id)
      if (byOrg && byOrg.size > 0) {
        let maxTotal = 0
        let maxName = ''
        for (const { name, total } of byOrg.values()) {
          if (total > maxTotal) { maxTotal = total; maxName = name }
        }
        if (maxName) topCustomer = `${maxName} — ${paiseToCurrency(maxTotal)}`
      }

      const lang = org.language_preference
      const locale: 'en' | 'gu' | 'hi' =
        lang === 'gu' || lang === 'hi' ? lang : 'en'

      return {
        organization_id: org.id,
        owner_phone: phone,
        language_preference: locale,
        has_data: true,
        week_range: weekRange,
        order_count: String(ordersThisWeek),
        order_value_formatted: paiseToCurrency(orderValuePaise),
        production_summary: productionSummary,
        collections_formatted: paiseToCurrency(collectedPaise),
        rupees_saved: rupeesSaved,
        top_customer: topCustomer,
        // Raw paise for analytics/debugging:
        order_value_paise: orderValuePaise,
        collections_paise: collectedPaise,
        saved_paise: savedPaise,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({
    summaries,
    meta: {
      week_start: weekStartYmd,
      week_end: today,
      total_orgs: orgs.length,
      eligible: summaries.length,
      skipped_no_owner: skippedNoOwner,
      skipped_no_data: skippedNoData,
    },
  })
}
