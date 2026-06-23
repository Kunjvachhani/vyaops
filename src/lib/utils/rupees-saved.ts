import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type DateRange = 'this_month' | 'last_3_months' | 'all_time'

// Defaults when no historical baseline is available yet.
const INDUSTRY_AVG_REJECTION_RATE = 0.12   // 12% rejection rate for Gujarat MSMEs
const INDUSTRY_AVG_COLLECTION_DAYS = 45    // 45 days avg collection in the sector
const COST_OF_CAPITAL_ANNUAL = 0.12        // 12% per annum (MSME benchmark)
const HOURLY_VALUE_PAISE = 20_000          // ₹200/hour owner time in paise
const MINUTES_SAVED_PER_WHATSAPP_ORDER = 15   // vs phone call + manual ledger entry
const MINUTES_SAVED_PER_WHATSAPP_BATCH = 10   // vs paper docket + manual tally

// Row-type aliases used for explicit casts (Supabase v2 strict-mode inference can
// resolve selected-column sets to `never`; casting via the full Row type is safe).
type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']

export interface QualitySavingsDetail {
  baselineRejectionRate: number    // fraction e.g. 0.12
  currentRejectionRate: number
  totalProduced: number
  avgUnitCostPaise: number
  savedPaise: number
}

export interface PaymentSpeedSavingsDetail {
  baselineDays: number
  currentAvgDays: number
  dailyRevenuePaise: number
  costOfCapitalAnnual: number
  savedPaise: number
}

export interface DuplicatePreventionSavingsDetail {
  duplicatesCaught: number
  avgOrderValuePaise: number
  savedPaise: number
}

export interface TimeSavingsDetail {
  whatsappOrders: number
  whatsappBatches: number
  totalHoursSaved: number
  hourlyValuePaise: number
  savedPaise: number
}

export interface RupeesSavedBreakdown {
  quality: QualitySavingsDetail
  paymentSpeed: PaymentSpeedSavingsDetail
  duplicatePrevention: DuplicatePreventionSavingsDetail
  time: TimeSavingsDetail
  totalSavedPaise: number
  dateRange: DateRange
  periodStart: string
  periodEnd: string
}

function getDateBounds(range: DateRange): { periodStart: Date; periodEnd: Date } {
  const now = new Date()
  switch (range) {
    case 'this_month':
      return {
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        periodEnd: now,
      }
    case 'last_3_months': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { periodStart: start, periodEnd: now }
    }
    case 'all_time':
      return {
        periodStart: new Date('2020-01-01T00:00:00Z'),
        periodEnd: now,
      }
  }
}

async function calcQualitySavings(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<QualitySavingsDetail> {
  const supabase = await createClient()
  const zero: QualitySavingsDetail = {
    baselineRejectionRate: INDUSTRY_AVG_REJECTION_RATE,
    currentRejectionRate: 0,
    totalProduced: 0,
    avgUnitCostPaise: 0,
    savedPaise: 0,
  }

  const { data: rawCurrent } = await supabase
    .from('production_batches')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const currentBatches = rawCurrent as ProductionBatchRow[] | null
  if (!currentBatches || currentBatches.length === 0) return zero

  const totalProduced = currentBatches.reduce((s, r) => s + r.quantity_produced, 0)
  const totalRejected = currentBatches.reduce((s, r) => s + r.quantity_rejected, 0)
  if (totalProduced === 0) return zero

  const currentRejectionRate = totalRejected / totalProduced

  // Baseline: first calendar month of production data, or industry average when
  // the first month IS the current period (not enough history yet).
  let baselineRejectionRate = INDUSTRY_AVG_REJECTION_RATE

  const { data: rawFirst } = await supabase
    .from('production_batches')
    .select('created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const firstBatch = rawFirst as Pick<ProductionBatchRow, 'created_at'> | null
  if (firstBatch) {
    const firstDate = new Date(firstBatch.created_at)
    const baselineStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    const baselineEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0, 23, 59, 59, 999)

    if (baselineEnd < periodStart) {
      const { data: rawBaseline } = await supabase
        .from('production_batches')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('created_at', baselineStart.toISOString())
        .lte('created_at', baselineEnd.toISOString())

      const baselineBatches = rawBaseline as ProductionBatchRow[] | null
      if (baselineBatches && baselineBatches.length > 0) {
        const bProd = baselineBatches.reduce((s, r) => s + r.quantity_produced, 0)
        const bRej = baselineBatches.reduce((s, r) => s + r.quantity_rejected, 0)
        if (bProd > 0) baselineRejectionRate = bRej / bProd
      }
    }
  }

  const { data: rawProducts } = await supabase
    .from('products')
    .select('unit_price_paise')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gt('unit_price_paise', 0)

  const productsData = rawProducts as Pick<ProductRow, 'unit_price_paise'>[] | null
  if (!productsData || productsData.length === 0) {
    return { baselineRejectionRate, currentRejectionRate, totalProduced, avgUnitCostPaise: 0, savedPaise: 0 }
  }

  const avgUnitCostPaise = Math.round(
    productsData.reduce((s, p) => s + (p.unit_price_paise ?? 0), 0) / productsData.length,
  )

  const rateImprovement = baselineRejectionRate - currentRejectionRate
  const savedPaise = rateImprovement > 0
    ? Math.round(rateImprovement * totalProduced * avgUnitCostPaise)
    : 0

  return { baselineRejectionRate, currentRejectionRate, totalProduced, avgUnitCostPaise, savedPaise }
}

async function calcPaymentSpeedSavings(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PaymentSpeedSavingsDetail> {
  const supabase = await createClient()
  const zero: PaymentSpeedSavingsDetail = {
    baselineDays: INDUSTRY_AVG_COLLECTION_DAYS,
    currentAvgDays: INDUSTRY_AVG_COLLECTION_DAYS,
    dailyRevenuePaise: 0,
    costOfCapitalAnnual: COST_OF_CAPITAL_ANNUAL,
    savedPaise: 0,
  }

  const { data: rawPaid } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('status', 'paid')
    .not('paid_date', 'is', null)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const paidInvoices = rawPaid as InvoiceRow[] | null
  if (!paidInvoices || paidInvoices.length === 0) return zero

  const collectionDays = paidInvoices.map((inv) => {
    const paid = new Date(inv.paid_date as string)
    const created = new Date(inv.created_at)
    return Math.max(0, (paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  })
  const currentAvgDays = collectionDays.reduce((s, d) => s + d, 0) / collectionDays.length

  const totalRevenuePaise = paidInvoices.reduce((s, inv) => s + (inv.total_amount_paise ?? 0), 0)
  const periodDays = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  const dailyRevenuePaise = Math.round(totalRevenuePaise / periodDays)

  let baselineDays = INDUSTRY_AVG_COLLECTION_DAYS

  const { data: rawFirstInv } = await supabase
    .from('invoices')
    .select('created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('status', 'paid')
    .not('paid_date', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const firstInvoice = rawFirstInv as Pick<InvoiceRow, 'created_at'> | null
  if (firstInvoice) {
    const firstDate = new Date(firstInvoice.created_at)
    const baselineStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    const baselineEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0, 23, 59, 59, 999)

    if (baselineEnd < periodStart) {
      const { data: rawBaselineInv } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('status', 'paid')
        .not('paid_date', 'is', null)
        .gte('created_at', baselineStart.toISOString())
        .lte('created_at', baselineEnd.toISOString())

      const baselineInvoices = rawBaselineInv as InvoiceRow[] | null
      if (baselineInvoices && baselineInvoices.length > 0) {
        const baseDays = baselineInvoices.map((inv) => {
          const paid = new Date(inv.paid_date as string)
          const created = new Date(inv.created_at)
          return Math.max(0, (paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        })
        baselineDays = baseDays.reduce((s, d) => s + d, 0) / baseDays.length
      }
    }
  }

  // Interest saved = days_saved × daily_revenue × daily_capital_rate
  const daysSaved = baselineDays - currentAvgDays
  const dailyCapitalRate = COST_OF_CAPITAL_ANNUAL / 365
  const savedPaise = daysSaved > 0
    ? Math.round(daysSaved * dailyRevenuePaise * dailyCapitalRate)
    : 0

  return {
    baselineDays,
    currentAvgDays,
    dailyRevenuePaise,
    costOfCapitalAnnual: COST_OF_CAPITAL_ANNUAL,
    savedPaise,
  }
}

async function calcDuplicatePreventionSavings(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DuplicatePreventionSavingsDetail> {
  const supabase = await createClient()
  const zero: DuplicatePreventionSavingsDetail = { duplicatesCaught: 0, avgOrderValuePaise: 0, savedPaise: 0 }

  // expired + NEW_ORDER pending_orders = detections superseded by a repeat message
  // from the same customer (the idempotency guard fired).
  const { count } = await supabase
    .from('pending_orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('state', 'expired')
    .eq('intent', 'NEW_ORDER')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const duplicatesCaught = count ?? 0
  if (duplicatesCaught === 0) return zero

  const { data: rawOrders } = await supabase
    .from('orders')
    .select('total_amount_paise')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const ordersData = rawOrders as Pick<OrderRow, 'total_amount_paise'>[] | null
  if (!ordersData || ordersData.length === 0) return { duplicatesCaught, avgOrderValuePaise: 0, savedPaise: 0 }

  const avgOrderValuePaise = Math.round(
    ordersData.reduce((s, o) => s + (o.total_amount_paise ?? 0), 0) / ordersData.length,
  )

  return {
    duplicatesCaught,
    avgOrderValuePaise,
    savedPaise: duplicatesCaught * avgOrderValuePaise,
  }
}

async function calcTimeSavings(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<TimeSavingsDetail> {
  const supabase = await createClient()
  const zero: TimeSavingsDetail = {
    whatsappOrders: 0,
    whatsappBatches: 0,
    totalHoursSaved: 0,
    hourlyValuePaise: HOURLY_VALUE_PAISE,
    savedPaise: 0,
  }

  const [{ count: rawOrders }, { count: rawBatches }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('source', 'whatsapp')
      .is('deleted_at', null)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString()),
    supabase
      .from('production_batches')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('source', 'whatsapp')
      .is('deleted_at', null)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString()),
  ])

  const whatsappOrders = rawOrders ?? 0
  const whatsappBatches = rawBatches ?? 0
  if (whatsappOrders === 0 && whatsappBatches === 0) return zero

  const totalMinutesSaved =
    whatsappOrders * MINUTES_SAVED_PER_WHATSAPP_ORDER +
    whatsappBatches * MINUTES_SAVED_PER_WHATSAPP_BATCH
  const totalHoursSaved = Math.round((totalMinutesSaved / 60) * 100) / 100
  const savedPaise = Math.round(totalHoursSaved * HOURLY_VALUE_PAISE)

  return { whatsappOrders, whatsappBatches, totalHoursSaved, hourlyValuePaise: HOURLY_VALUE_PAISE, savedPaise }
}

export async function calculateRupeesSaved(
  orgId: string,
  dateRange: DateRange,
): Promise<RupeesSavedBreakdown> {
  const { periodStart, periodEnd } = getDateBounds(dateRange)

  const [quality, paymentSpeed, duplicatePrevention, time] = await Promise.all([
    calcQualitySavings(orgId, periodStart, periodEnd),
    calcPaymentSpeedSavings(orgId, periodStart, periodEnd),
    calcDuplicatePreventionSavings(orgId, periodStart, periodEnd),
    calcTimeSavings(orgId, periodStart, periodEnd),
  ])

  return {
    quality,
    paymentSpeed,
    duplicatePrevention,
    time,
    totalSavedPaise:
      quality.savedPaise +
      paymentSpeed.savedPaise +
      duplicatePrevention.savedPaise +
      time.savedPaise,
    dateRange,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  }
}
