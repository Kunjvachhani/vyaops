import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { paiseToCurrency } from '@/lib/utils/currency'
import type { Database } from '@/types/database'
import {
  ShoppingCart,
  Percent,
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

type OrderRow = Database['public']['Tables']['orders']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']
type InventoryRow = Database['public']['Tables']['inventory']['Row']

// Invoice states that still owe money.
const OUTSTANDING_STATUSES = ['sent', 'partially_paid', 'overdue'] as const

function monthBounds(offset: number): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end =
    offset === 0
      ? now
      : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Yield % = good pieces / total produced. Returns null when nothing was produced.
function batchYield(batches: Pick<ProductionBatchRow, 'quantity_produced' | 'quantity_rejected'>[]): number | null {
  const produced = batches.reduce((s, b) => s + b.quantity_produced, 0)
  if (produced === 0) return null
  const rejected = batches.reduce((s, b) => s + b.quantity_rejected, 0)
  return ((produced - rejected) / produced) * 100
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  alert,
  trend,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  alert?: boolean
  trend?: { up: boolean; text: string } | null
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div className={alert ? 'text-red-600' : 'text-muted-foreground'}>{icon}</div>
        </div>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${alert ? 'text-red-600' : ''}`}>
          {value}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                trend.up ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export async function MetricCards() {
  const t = await getTranslations('pages.dashboard.metrics')
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const orgId = user.org_id
  const thisMonth = monthBounds(0)
  const lastMonth = monthBounds(-1)

  const [ordersRes, batchesRes, lastBatchesRes, invoicesRes, inventoryRes] =
    await Promise.all([
      supabase
        .from('orders')
        .select('total_amount_paise')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('created_at', thisMonth.start)
        .lte('created_at', thisMonth.end),
      supabase
        .from('production_batches')
        .select('quantity_produced, quantity_rejected')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('created_at', thisMonth.start)
        .lte('created_at', thisMonth.end),
      supabase
        .from('production_batches')
        .select('quantity_produced, quantity_rejected')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('created_at', lastMonth.start)
        .lte('created_at', lastMonth.end),
      supabase
        .from('invoices')
        .select('total_amount_paise, paid_amount_paise')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .in('status', OUTSTANDING_STATUSES as unknown as string[]),
      supabase
        .from('inventory')
        .select('current_quantity, reorder_level')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

  const orders = (ordersRes.data ?? []) as Pick<OrderRow, 'total_amount_paise'>[]
  const orderCount = orders.length
  const orderValuePaise = orders.reduce((s, o) => s + (o.total_amount_paise ?? 0), 0)

  const thisYield = batchYield(
    (batchesRes.data ?? []) as Pick<ProductionBatchRow, 'quantity_produced' | 'quantity_rejected'>[],
  )
  const lastYield = batchYield(
    (lastBatchesRes.data ?? []) as Pick<ProductionBatchRow, 'quantity_produced' | 'quantity_rejected'>[],
  )
  let yieldTrend: { up: boolean; text: string } | null = null
  if (thisYield !== null && lastYield !== null) {
    const diff = thisYield - lastYield
    yieldTrend = {
      up: diff >= 0,
      text: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp`,
    }
  }

  const invoices = (invoicesRes.data ?? []) as Pick<
    InvoiceRow,
    'total_amount_paise' | 'paid_amount_paise'
  >[]
  const outstandingPaise = invoices.reduce(
    (s, inv) => s + Math.max(0, (inv.total_amount_paise ?? 0) - (inv.paid_amount_paise ?? 0)),
    0,
  )

  const inventory = (inventoryRes.data ?? []) as Pick<
    InventoryRow,
    'current_quantity' | 'reorder_level'
  >[]
  const lowStockCount = inventory.filter(
    (i) => i.current_quantity <= i.reorder_level,
  ).length

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label={t('ordersThisMonth')}
        value={String(orderCount)}
        sub={paiseToCurrency(orderValuePaise)}
        icon={<ShoppingCart className="h-5 w-5" />}
      />
      <MetricCard
        label={t('productionYield')}
        value={thisYield === null ? t('noData') : `${thisYield.toFixed(1)}%`}
        icon={<Percent className="h-5 w-5" />}
        trend={yieldTrend}
      />
      <MetricCard
        label={t('outstandingReceivables')}
        value={paiseToCurrency(outstandingPaise)}
        icon={<Wallet className="h-5 w-5" />}
      />
      <MetricCard
        label={t('lowStockAlerts')}
        value={String(lowStockCount)}
        sub={lowStockCount > 0 ? t('items') : undefined}
        icon={<AlertTriangle className="h-5 w-5" />}
        alert={lowStockCount > 0}
      />
    </div>
  )
}
