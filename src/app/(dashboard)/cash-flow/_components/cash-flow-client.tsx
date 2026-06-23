'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ForecastChart } from './forecast-chart'
import { paiseToCurrency } from '@/lib/utils/currency'
import {
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  AlertCircle,
  Bell,
  X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  phone: string | null
}

interface Receivable {
  id: string
  invoice_number: string
  total_amount_paise: number
  paid_amount_paise: number
  outstanding_paise: number
  due_date: string
  days_overdue: number
  is_overdue: boolean
  status: string
  reminder_count: number
  last_reminder_at: string | null
  aging_bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus'
  customer: Customer
}

interface Payable {
  id: string
  po_number: string
  material_name: string
  total_amount_paise: number
  expected_date: string | null
  status: string
  vendor: { id: string; name: string }
}

interface ForecastPoint {
  date: string
  inflow_paise: number
  outflow_paise: number
  net_paise: number
}

interface Summary {
  total_receivables_paise: number
  total_payables_paise: number
  net_position_paise: number
  largest_outstanding: { customer_name: string; amount_paise: number } | null
}

interface CashFlowData {
  receivables: Receivable[]
  payables: Payable[]
  forecast: ForecastPoint[]
  summary: Summary
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AgingBucket = 'all' | 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

const AGING_BUCKETS: AgingBucket[] = ['all', 'current', '1_30', '31_60', '61_90', '90_plus']

function agingKey(bucket: AgingBucket): string {
  return bucket === '90_plus' ? '90plus' : bucket
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string
  value: string
  icon: React.ReactNode
  variant?: 'positive' | 'negative' | 'neutral'
}) {
  const colorClass =
    variant === 'positive'
      ? 'text-green-600'
      : variant === 'negative'
        ? 'text-red-600'
        : 'text-foreground'

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
          </div>
          <div className="text-muted-foreground mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ReminderButtonProps {
  invoice: Receivable
  onSent: (id: string) => void
}

function ReminderButton({ invoice, onSent }: ReminderButtonProps) {
  const t = useTranslations('pages.cashFlow')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleClick() {
    setSending(true)
    setToast(null)
    try {
      const res = await fetch('/api/cash-flow/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      if (res.ok) {
        setToast({ type: 'success', msg: t('reminder.success') })
        onSent(invoice.id)
      } else {
        const json = await res.json() as { code?: string }
        if (json.code === 'NO_CUSTOMER_PHONE') {
          setToast({ type: 'error', msg: t('reminder.noPhone') })
        } else {
          setToast({ type: 'error', msg: t('reminder.error') })
        }
      }
    } catch {
      setToast({ type: 'error', msg: t('reminder.error') })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={sending || !invoice.customer.phone}
        onClick={handleClick}
        className="h-7 text-xs"
      >
        <Bell className="mr-1.5 h-3 w-3" />
        {sending ? t('actions.sending') : t('actions.sendReminder')}
      </Button>
      {toast && (
        <span
          className={`text-xs ${toast.type === 'success' ? 'text-green-600' : 'text-red-500'}`}
        >
          {toast.msg}
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const t = useTranslations('pages.cashFlow.status')

  if (isOverdue) {
    return <Badge variant="destructive" className="text-xs">{t('overdue')}</Badge>
  }
  if (status === 'partially_paid') {
    return <Badge variant="secondary" className="text-xs">{t('partially_paid')}</Badge>
  }
  if (status === 'sent') {
    return <Badge variant="outline" className="text-xs">{t('sent')}</Badge>
  }
  return <Badge variant="secondary" className="text-xs">{t('draft')}</Badge>
}

// ─── Receivables Tab ──────────────────────────────────────────────────────────

function ReceivablesTab({ receivables }: { receivables: Receivable[] }) {
  const t = useTranslations('pages.cashFlow')
  const [activeBucket, setActiveBucket] = useState<AgingBucket>('all')
  const [customerFilter, setCustomerFilter] = useState<string | null>(null)
  const [reminderSentIds, setReminderSentIds] = useState<Set<string>>(new Set())

  const filtered = receivables.filter((r) => {
    if (customerFilter && r.customer.id !== customerFilter) return false
    if (activeBucket === 'all') return true
    return r.aging_bucket === activeBucket
  })

  const bucketTotal = filtered.reduce((s, r) => s + r.outstanding_paise, 0)

  function handleCustomerClick(customerId: string) {
    setCustomerFilter((prev) => (prev === customerId ? null : customerId))
  }

  function handleReminderSent(id: string) {
    setReminderSentIds((prev) => new Set(prev).add(id))
  }

  // Count per bucket for badges
  const bucketCounts: Record<AgingBucket, number> = {
    all: receivables.length,
    current: 0,
    '1_30': 0,
    '31_60': 0,
    '61_90': 0,
    '90_plus': 0,
  }
  for (const r of receivables) {
    bucketCounts[r.aging_bucket]++
  }

  return (
    <div className="space-y-4">
      {/* Aging bucket tabs */}
      <div className="flex flex-wrap gap-2">
        {AGING_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            onClick={() => { setActiveBucket(bucket); setCustomerFilter(null) }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeBucket === bucket
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t(`aging.${agingKey(bucket)}`)}
            {bucketCounts[bucket] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeBucket === bucket ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-foreground'
              }`}>
                {bucketCounts[bucket]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Customer filter chip */}
      {customerFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {receivables.find((r) => r.customer.id === customerFilter)?.customer.name ?? customerFilter}
            <button onClick={() => setCustomerFilter(null)} className="ml-0.5 hover:text-blue-600">
              <X className="h-3 w-3" />
            </button>
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCustomerFilter(null)}>
            {t('actions.showAll')}
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('aging.noData')}</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">{t('table.customer')}</TableHead>
                <TableHead className="text-xs">{t('table.invoiceNo')}</TableHead>
                <TableHead className="text-right text-xs">{t('table.amount')}</TableHead>
                <TableHead className="text-xs">{t('table.dueDate')}</TableHead>
                <TableHead className="text-right text-xs">{t('table.daysOverdue')}</TableHead>
                <TableHead className="text-xs">{t('table.status')}</TableHead>
                <TableHead className="text-right text-xs">{t('table.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className={`${r.is_overdue ? 'bg-red-50/40 dark:bg-red-950/20' : ''} ${
                    reminderSentIds.has(r.id) ? 'opacity-60' : ''
                  }`}
                >
                  <TableCell className="font-medium text-sm">
                    <button
                      onClick={() => handleCustomerClick(r.customer.id)}
                      className="text-left hover:text-primary hover:underline transition-colors"
                    >
                      {r.customer.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {r.invoice_number}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {paiseToCurrency(r.outstanding_paise)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.due_date)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {r.is_overdue ? (
                      <span className="text-red-600 font-medium">{r.days_overdue}d</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} isOverdue={r.is_overdue} />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.is_overdue && (
                      <ReminderButton invoice={r} onSent={handleReminderSent} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Bucket total */}
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('aging.total')}
            </span>
            <span className="text-sm font-bold">{paiseToCurrency(bucketTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payables Tab ─────────────────────────────────────────────────────────────

function PayablesTab({ payables }: { payables: Payable[] }) {
  const t = useTranslations('pages.cashFlow')

  const total = payables.reduce((s, p) => s + p.total_amount_paise, 0)

  if (payables.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('table.noPayables')}</p>
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">{t('table.vendor')}</TableHead>
            <TableHead className="text-xs">{t('table.poNo')}</TableHead>
            <TableHead className="text-xs">{t('table.material')}</TableHead>
            <TableHead className="text-right text-xs">{t('table.amount')}</TableHead>
            <TableHead className="text-xs">{t('table.expectedDate')}</TableHead>
            <TableHead className="text-xs">{t('table.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payables.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium text-sm">{p.vendor.name}</TableCell>
              <TableCell className="text-sm font-mono text-muted-foreground">{p.po_number}</TableCell>
              <TableCell className="text-sm">{p.material_name}</TableCell>
              <TableCell className="text-right text-sm font-semibold">
                {p.total_amount_paise > 0 ? paiseToCurrency(p.total_amount_paise) : '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.expected_date ? formatDate(p.expected_date) : '—'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('table.total')}
        </span>
        <span className="text-sm font-bold">{paiseToCurrency(total)}</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'receivables' | 'payables' | 'forecast'

export function CashFlowClient() {
  const t = useTranslations('pages.cashFlow')
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<MainTab>('receivables')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/cash-flow')
      if (!res.ok) { setError(true); return }
      const json = await res.json() as { data: CashFlowData }
      setData(json.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {t('error')}
      </div>
    )
  }

  const { receivables, payables, forecast, summary } = data
  const netPositive = summary.net_position_paise >= 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label={t('summary.totalReceivables')}
          value={paiseToCurrency(summary.total_receivables_paise)}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="positive"
        />
        <SummaryCard
          label={t('summary.totalPayables')}
          value={paiseToCurrency(summary.total_payables_paise)}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="negative"
        />
        <SummaryCard
          label={t('summary.netPosition')}
          value={paiseToCurrency(summary.net_position_paise)}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          variant={netPositive ? 'positive' : 'negative'}
        />
        <SummaryCard
          label={t('summary.largestOutstanding')}
          value={
            summary.largest_outstanding
              ? `${summary.largest_outstanding.customer_name} — ${paiseToCurrency(summary.largest_outstanding.amount_paise)}`
              : '—'
          }
          icon={<AlertCircle className="h-5 w-5" />}
          variant="neutral"
        />
      </div>

      {/* Tab bar */}
      <div className="border-b">
        <div className="flex gap-0 -mb-px">
          {(['receivables', 'payables', 'forecast'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              }`}
            >
              {t(`tabs.${tab}`)}
              {tab === 'receivables' && receivables.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {receivables.length}
                </span>
              )}
              {tab === 'payables' && payables.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {payables.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div className="mt-4">
        {activeTab === 'receivables' && <ReceivablesTab receivables={receivables} />}
        {activeTab === 'payables' && <PayablesTab payables={payables} />}
        {activeTab === 'forecast' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('forecast.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastChart data={forecast} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
