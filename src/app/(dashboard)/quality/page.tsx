import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { FeatureGateCard } from '@/components/dashboard/feature-gate-card'
import { QualityClient } from './_components/quality-client'
import type { QualityData } from './_components/quality-client'

// Returns UTC Date representing IST midnight of the 1st day of the month, offset by monthsAgo
function istMonthStart(monthsAgo = 0): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const istNow = new Date(Date.now() + IST_OFFSET_MS)
  const y = istNow.getUTCFullYear()
  const m = istNow.getUTCMonth() - monthsAgo
  return new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS)
}

function istDayBoundary(daysAgo = 0): Date {
  const IST_MS = 5.5 * 60 * 60 * 1000
  const nowIstMs = Date.now() + IST_MS
  const startTodayIstMs = nowIstMs - (nowIstMs % (24 * 60 * 60 * 1000))
  return new Date(startTodayIstMs - daysAgo * 24 * 60 * 60 * 1000 - IST_MS)
}

function toISTDateKey(utcIso: string): string {
  // Returns YYYY-MM-DD in IST
  return new Date(utcIso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function toISTDateLabel(utcIso: string): string {
  // Returns "Jun 15" in IST
  return new Date(utcIso).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

type BatchRow = {
  created_at: string
  quantity_produced: number
  quantity_rejected: number
  defect_type: string | null
  products: { id: string; name: string; unit_price_paise: number } | null
}

export default async function QualityPage() {
  const t = await getTranslations('pages.quality')
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

  const canAccess = hasAccess(orgTier, 'quality')

  if (!canAccess || !user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        <FeatureGateCard featureName={t('title')} requiredTier="tier_2" />
      </div>
    )
  }

  const supabase = await createClient()
  const thirtyDaysAgo = istDayBoundary(29)
  const thisMonthStart = istMonthStart(0)
  const lastMonthStart = istMonthStart(1)

  const [thirtyDayRes, lastMonthRes] = await Promise.all([
    supabase
      .from('production_batches')
      .select(
        'created_at, quantity_produced, quantity_rejected, defect_type, products(id, name, unit_price_paise)'
      )
      .eq('organization_id', user.org_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),

    supabase
      .from('production_batches')
      .select('quantity_produced, quantity_rejected')
      .eq('organization_id', user.org_id)
      .gte('created_at', lastMonthStart.toISOString())
      .lt('created_at', thisMonthStart.toISOString())
      .is('deleted_at', null),
  ])

  const thirtyDayBatches = (thirtyDayRes.data ?? []) as unknown as BatchRow[]
  const lastMonthBatches = (lastMonthRes.data ?? []) as Array<{
    quantity_produced: number
    quantity_rejected: number
  }>

  // This month's batches are a subset of the 30-day window
  const thisMonthIso = thisMonthStart.toISOString()
  const thisMonthBatches = thirtyDayBatches.filter((b) => b.created_at >= thisMonthIso)

  // This month totals
  const thisMonthProduced = thisMonthBatches.reduce((s, b) => s + b.quantity_produced, 0)
  const thisMonthRejected = thisMonthBatches.reduce((s, b) => s + b.quantity_rejected, 0)
  const thisMonthRate =
    thisMonthProduced > 0
      ? parseFloat(((thisMonthRejected / thisMonthProduced) * 100).toFixed(1))
      : 0

  // Last month totals
  const lastMonthProduced = lastMonthBatches.reduce((s, b) => s + b.quantity_produced, 0)
  const lastMonthRejected = lastMonthBatches.reduce((s, b) => s + b.quantity_rejected, 0)
  const lastMonthRate =
    lastMonthProduced > 0
      ? parseFloat(((lastMonthRejected / lastMonthProduced) * 100).toFixed(1))
      : 0

  // Daily rejection rate: last 30 days
  const dayMap = new Map<string, { produced: number; rejected: number }>()
  for (const b of thirtyDayBatches) {
    const key = toISTDateKey(b.created_at)
    const entry = dayMap.get(key) ?? { produced: 0, rejected: 0 }
    entry.produced += b.quantity_produced
    entry.rejected += b.quantity_rejected
    dayMap.set(key, entry)
  }
  const trendData: QualityData['trendData'] = []
  for (let i = 29; i >= 0; i--) {
    const d = istDayBoundary(i)
    const key = toISTDateKey(d.toISOString())
    const label = toISTDateLabel(d.toISOString())
    const entry = dayMap.get(key)
    const rate =
      entry && entry.produced > 0
        ? parseFloat(((entry.rejected / entry.produced) * 100).toFixed(1))
        : 0
    trendData.push({ date: label, rate })
  }

  // Defect Pareto: last 30 days, ranked by rejected piece count
  const defectMap = new Map<string, number>()
  for (const b of thirtyDayBatches) {
    if (b.quantity_rejected > 0 && b.defect_type) {
      defectMap.set(b.defect_type, (defectMap.get(b.defect_type) ?? 0) + b.quantity_rejected)
    }
  }
  const totalDefects = Array.from(defectMap.values()).reduce((s, v) => s + v, 0)
  const defectData: QualityData['defectData'] = Array.from(defectMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      percentage:
        totalDefects > 0 ? parseFloat(((count / totalDefects) * 100).toFixed(1)) : 0,
    }))

  // Product rejection breakdown: this month
  type ProductEntry = {
    name: string
    produced: number
    rejected: number
    unitPricePaise: number
  }
  const productMap = new Map<string, ProductEntry>()
  for (const b of thisMonthBatches) {
    const key = b.products?.id ?? '__unknown__'
    const entry: ProductEntry = productMap.get(key) ?? {
      name: b.products?.name ?? 'Unknown',
      produced: 0,
      rejected: 0,
      unitPricePaise: b.products?.unit_price_paise ?? 0,
    }
    entry.produced += b.quantity_produced
    entry.rejected += b.quantity_rejected
    productMap.set(key, entry)
  }

  // Ascending by rate for bestProduct (index 0 = lowest rejection)
  const productRowsAsc = Array.from(productMap.values())
    .map((p) => ({
      name: p.name,
      produced: p.produced,
      rejected: p.rejected,
      rate: p.produced > 0 ? parseFloat(((p.rejected / p.produced) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.rate - b.rate)

  const bestProduct = productRowsAsc.length > 0 ? productRowsAsc[0] : null

  // Table displays worst first (descending rate)
  const productData = [...productRowsAsc].reverse()

  // Avg unit price per unique product (not per batch) for ₹ savings
  let totalUnitPricePaise = 0
  let productPriceCount = 0
  for (const p of productMap.values()) {
    if (p.unitPricePaise > 0) {
      totalUnitPricePaise += p.unitPricePaise
      productPriceCount++
    }
  }
  const avgUnitPricePaise = productPriceCount > 0 ? totalUnitPricePaise / productPriceCount : 0

  const rateImprovement = lastMonthRate - thisMonthRate
  const savedPaise =
    rateImprovement > 0 && avgUnitPricePaise > 0 && thisMonthProduced > 0
      ? Math.round((rateImprovement / 100) * thisMonthProduced * avgUnitPricePaise)
      : 0

  const qualityData: QualityData = {
    thisMonthRate,
    lastMonthRate,
    thisMonthProduced,
    bestProduct,
    savedPaise,
    trendData,
    defectData,
    productData,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <QualityClient data={qualityData} />
    </div>
  )
}
