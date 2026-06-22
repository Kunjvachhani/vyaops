import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { FeatureGateCard } from '@/components/dashboard/feature-gate-card'
import { ProductionClient } from './_components/production-client'
import type { EnrichedOrder, SummaryData } from './_components/production-client'

type OrderRow = {
  id: string
  order_number: string
  status: string
  quantity: number
  quantity_produced: number
  delivery_date: string | null
  customers: { id: string; name: string; company_name: string | null } | null
  products: { id: string; name: string; unit: string } | null
}

type BatchSummaryRow = {
  quantity_produced: number
  quantity_rejected: number
}

type RecentBatchRow = {
  order_id: string | null
  quantity_produced: number
}

type UserRow = {
  id: string
  full_name: string
}

// IST start-of-day expressed as a UTC Date (IST = UTC+5:30)
function istDayBoundary(daysAgo = 0): Date {
  const IST_MS = 5.5 * 60 * 60 * 1000
  const nowIstMs = Date.now() + IST_MS
  const startTodayIstMs = nowIstMs - (nowIstMs % (24 * 60 * 60 * 1000))
  return new Date(startTodayIstMs - daysAgo * 24 * 60 * 60 * 1000 - IST_MS)
}

function enrichOrder(order: OrderRow, sevenDayTotals: Map<string, number>): EnrichedOrder {
  const qtyRemaining = Math.max(0, order.quantity - order.quantity_produced)
  const totalLast7 = sevenDayTotals.get(order.id) ?? 0
  const dailyOutput = totalLast7 > 0 ? totalLast7 / 7 : null

  let projectedFinish: string | null = null
  let isAtRisk = false

  if (dailyOutput !== null && qtyRemaining > 0) {
    const daysNeeded = Math.ceil(qtyRemaining / dailyOutput)
    const projDate = new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000)
    projectedFinish = projDate.toISOString().split('T')[0]
    if (order.delivery_date) {
      isAtRisk = projectedFinish > order.delivery_date
    }
  }

  return {
    ...order,
    qty_remaining: qtyRemaining,
    daily_output: dailyOutput,
    projected_finish: projectedFinish,
    is_at_risk: isAtRisk,
  }
}

export default async function ProductionPage() {
  const t = await getTranslations('pages.production')

  const user = await getCurrentUser()

  let orgTier: Tier = 'tier_1'
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', user.org_id)
      .is('deleted_at', null)
      .single()
    const row = data as { tier: string } | null
    if (row?.tier) orgTier = row.tier as Tier
  }

  const canAccess = hasAccess(orgTier, 'production')

  if (!canAccess || !user) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <FeatureGateCard featureName={t('title')} requiredTier="tier_2" />
      </div>
    )
  }

  const supabase = await createClient()
  const startOfToday = istDayBoundary(0)
  const startOfWeek = istDayBoundary(6) // rolling 7-day window

  const [ordersRes, recentBatchesRes, todayBatchesRes, weekBatchesRes, usersRes] =
    await Promise.all([
      // Active orders: in_production + confirmed, sorted by delivery_date (nulls last)
      supabase
        .from('orders')
        .select(
          'id, order_number, status, quantity, quantity_produced, delivery_date, customers(id, name, company_name), products(id, name, unit)'
        )
        .eq('organization_id', user.org_id)
        .in('status', ['in_production', 'confirmed'])
        .is('deleted_at', null)
        .order('delivery_date', { ascending: true, nullsFirst: false }),

      // Last 7 days of batches for pace calculation
      supabase
        .from('production_batches')
        .select('order_id, quantity_produced')
        .eq('organization_id', user.org_id)
        .gte('created_at', startOfWeek.toISOString())
        .is('deleted_at', null),

      // Today's batches for summary
      supabase
        .from('production_batches')
        .select('quantity_produced, quantity_rejected')
        .eq('organization_id', user.org_id)
        .gte('created_at', startOfToday.toISOString())
        .is('deleted_at', null),

      // This week's batches for weekly total
      supabase
        .from('production_batches')
        .select('quantity_produced, quantity_rejected')
        .eq('organization_id', user.org_id)
        .gte('created_at', startOfWeek.toISOString())
        .is('deleted_at', null),

      // Users list for worker filter and dialog
      supabase
        .from('users')
        .select('id, full_name')
        .eq('organization_id', user.org_id)
        .is('deleted_at', null)
        .order('full_name'),
    ])

  // Build 7-day production totals per order
  const sevenDayTotals = new Map<string, number>()
  for (const b of (recentBatchesRes.data ?? []) as RecentBatchRow[]) {
    if (!b.order_id) continue
    sevenDayTotals.set(b.order_id, (sevenDayTotals.get(b.order_id) ?? 0) + b.quantity_produced)
  }

  const orders = ((ordersRes.data ?? []) as unknown as OrderRow[]).map((o) =>
    enrichOrder(o, sevenDayTotals)
  )

  const todayBatches = (todayBatchesRes.data ?? []) as BatchSummaryRow[]
  const weekBatches = (weekBatchesRes.data ?? []) as BatchSummaryRow[]

  const todayProduced = todayBatches.reduce((s, b) => s + b.quantity_produced, 0)
  const todayRejected = todayBatches.reduce((s, b) => s + b.quantity_rejected, 0)
  const weekProduced = weekBatches.reduce((s, b) => s + b.quantity_produced, 0)
  const atRiskCount = orders.filter((o) => o.is_at_risk).length

  const summary: SummaryData = {
    today_produced: todayProduced,
    today_rejected: todayRejected,
    week_produced: weekProduced,
    at_risk_count: atRiskCount,
  }

  const workers = (usersRes.data ?? []) as UserRow[]
  const canLog = user.role !== 'viewer'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <ProductionClient
        initialOrders={orders}
        summary={summary}
        workers={workers}
        canLog={canLog}
      />
    </div>
  )
}
