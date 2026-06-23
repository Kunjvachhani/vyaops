import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { paiseToCurrency } from '@/lib/utils/currency'
import {
  AlertCircle,
  Factory,
  PackageX,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

const STUCK_DAYS = 3
const LIST_LIMIT = 5

function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24))
}

// Embedded to-one joins arrive as an object (or null) on the parent row.
interface OverdueInvoice {
  id: string
  invoice_number: string
  total_amount_paise: number
  paid_amount_paise: number
  due_date: string
  customers: { name: string } | null
}

interface InProductionOrder {
  id: string
  order_number: string
  created_at: string
  customers: { name: string } | null
}

interface BatchRef {
  order_id: string | null
  created_at: string
}

interface LowStockItem {
  id: string
  item_name: string
  current_quantity: number
  reorder_level: number
  unit: string
}

function ActionRow({
  primary,
  secondary,
  meta,
  href,
  cta,
}: {
  primary: string
  secondary: string
  meta: string
  href: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{meta}</span>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
          {cta}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 px-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  )
}

export async function ActionItems() {
  const t = await getTranslations('pages.dashboard.actions')
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const orgId = user.org_id
  const today = istToday()
  const now = new Date()

  const [overdueRes, ordersRes, inventoryRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_amount_paise, paid_amount_paise, due_date, customers(name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['sent', 'partially_paid', 'overdue'])
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(LIST_LIMIT),
    supabase
      .from('orders')
      .select('id, order_number, created_at, customers(name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'in_production'),
    supabase
      .from('inventory')
      .select('id, item_name, current_quantity, reorder_level, unit')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('item_name', { ascending: true }),
  ])

  const overdue = (overdueRes.data as unknown as OverdueInvoice[] | null) ?? []
  const inProduction = (ordersRes.data as unknown as InProductionOrder[] | null) ?? []
  const inventory = (inventoryRes.data as unknown as LowStockItem[] | null) ?? []

  // Stuck = in_production with no batch logged in the last STUCK_DAYS days.
  let stuck: { order: InProductionOrder; daysSince: number }[] = []
  if (inProduction.length > 0) {
    const orderIds = inProduction.map((o) => o.id)
    const { data: batchRaw } = await supabase
      .from('production_batches')
      .select('order_id, created_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('order_id', orderIds)
    const batches = (batchRaw as BatchRef[] | null) ?? []

    const latestByOrder = new Map<string, string>()
    for (const b of batches) {
      if (!b.order_id) continue
      const prev = latestByOrder.get(b.order_id)
      if (!prev || b.created_at > prev) latestByOrder.set(b.order_id, b.created_at)
    }

    stuck = inProduction
      .map((order) => {
        const last = latestByOrder.get(order.id) ?? order.created_at
        return { order, daysSince: daysBetween(last, now) }
      })
      .filter((x) => x.daysSince >= STUCK_DAYS)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, LIST_LIMIT)
  }

  const lowStock = inventory
    .filter((i) => i.current_quantity <= i.reorder_level)
    .slice(0, LIST_LIMIT)

  const isEmpty = overdue.length === 0 && stuck.length === 0 && lowStock.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isEmpty && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {t('empty')}
          </div>
        )}

        {overdue.length > 0 && (
          <Section
            icon={<AlertCircle className="h-4 w-4 text-red-600" />}
            title={t('overdueInvoices')}
          >
            {overdue.map((inv) => (
              <ActionRow
                key={inv.id}
                primary={inv.customers?.name ?? t('unknownCustomer')}
                secondary={`#${inv.invoice_number}`}
                meta={paiseToCurrency(
                  Math.max(0, inv.total_amount_paise - inv.paid_amount_paise),
                )}
                href="/cash-flow"
                cta={t('sendReminder')}
              />
            ))}
          </Section>
        )}

        {stuck.length > 0 && (
          <Section
            icon={<Factory className="h-4 w-4 text-amber-600" />}
            title={t('stuckOrders')}
          >
            {stuck.map(({ order, daysSince }) => (
              <ActionRow
                key={order.id}
                primary={`#${order.order_number}`}
                secondary={order.customers?.name ?? t('unknownCustomer')}
                meta={t('noBatchDays', { days: daysSince })}
                href="/production"
                cta={t('checkStatus')}
              />
            ))}
          </Section>
        )}

        {lowStock.length > 0 && (
          <Section
            icon={<PackageX className="h-4 w-4 text-red-600" />}
            title={t('lowStock')}
          >
            {lowStock.map((item) => (
              <ActionRow
                key={item.id}
                primary={item.item_name}
                secondary={t('remaining', {
                  qty: item.current_quantity,
                  unit: item.unit,
                })}
                meta={t('reorderAt', { level: item.reorder_level })}
                href="/vendors"
                cta={t('createPO')}
              />
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  )
}
