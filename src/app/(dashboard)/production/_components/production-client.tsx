'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogProductionDialog } from './log-production-dialog'
import type { InProductionOrder } from './log-production-dialog'
import { formatISTDate } from '@/lib/utils/date'
import { GripVertical, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { captureWithContext } from '@/lib/utils/sentry'

export interface EnrichedOrder {
  id: string
  order_number: string
  status: string
  quantity: number
  quantity_produced: number
  delivery_date: string | null
  qty_remaining: number
  daily_output: number | null
  projected_finish: string | null
  is_at_risk: boolean
  customers: { id: string; name: string; company_name: string | null } | null
  products: { id: string; name: string; unit: string } | null
}

export interface SummaryData {
  today_produced: number
  today_rejected: number
  week_produced: number
  at_risk_count: number
}

export interface WorkerOption {
  id: string
  full_name: string
}

interface BatchLogItem {
  id: string
  created_at: string
  quantity_produced: number
  quantity_rejected: number
  orders: { order_number: string } | null
  products: { name: string; unit: string } | null
  users: { full_name: string } | null
}

interface LogPagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface ProductionClientProps {
  initialOrders: EnrichedOrder[]
  summary: SummaryData
  workers: WorkerOption[]
  canLog: boolean
}

function formatDateCompact(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

function computeYield(produced: number, rejected: number): number {
  if (produced === 0) return 0
  return Math.max(0, ((produced - rejected) / produced) * 100)
}

export function ProductionClient({
  initialOrders,
  summary,
  workers,
  canLog,
}: ProductionClientProps) {
  const t = useTranslations('pages.production')
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'queue' | 'log'>('queue')
  const [orderedQueue, setOrderedQueue] = useState<EnrichedOrder[]>(initialOrders)
  const [logDialogOpen, setLogDialogOpen] = useState(false)

  // Sync queue when server refreshes data
  useEffect(() => {
    setOrderedQueue(initialOrders)
  }, [initialOrders])

  // Drag state
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(i: number) {
    dragIndexRef.current = i
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    setDragOverIndex(i)
  }

  function handleDrop(i: number) {
    const from = dragIndexRef.current
    if (from === null || from === i) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const next = [...orderedQueue]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    setOrderedQueue(next)
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  // Production log state
  const [logBatches, setLogBatches] = useState<BatchLogItem[]>([])
  const [logPagination, setLogPagination] = useState<LogPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  })
  const [logLoading, setLogLoading] = useState(false)
  const [logFilterOrderId, setLogFilterOrderId] = useState('')
  const [logFilterWorkerId, setLogFilterWorkerId] = useState('')
  const [logFilterDateFrom, setLogFilterDateFrom] = useState('')
  const [logFilterDateTo, setLogFilterDateTo] = useState('')

  const fetchLog = useCallback(
    async (page: number) => {
      setLogLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (logFilterOrderId) params.set('order_id', logFilterOrderId)
        if (logFilterWorkerId) params.set('worker_id', logFilterWorkerId)
        if (logFilterDateFrom) params.set('date_from', logFilterDateFrom)
        if (logFilterDateTo) params.set('date_to', logFilterDateTo + 'T23:59:59')
        const res = await fetch(`/api/production?${params}`)
        if (!res.ok) return
        const json = (await res.json()) as { data: BatchLogItem[]; pagination: LogPagination }
        setLogBatches(json.data ?? [])
        setLogPagination(json.pagination)
      } catch (err) {
        captureWithContext(err instanceof Error ? err : new Error(String(err)), {
          action: 'ProductionClient/fetchLog',
        })
      } finally {
        setLogLoading(false)
      }
    },
    [logFilterOrderId, logFilterWorkerId, logFilterDateFrom, logFilterDateTo]
  )

  // Fetch log when tab becomes active or filters change
  useEffect(() => {
    if (activeTab === 'log') {
      void fetchLog(1)
    }
  }, [activeTab, fetchLog])

  function handleLogSuccess() {
    router.refresh()
    if (activeTab === 'log') void fetchLog(logPagination.page)
  }

  const todayRejectionRate =
    summary.today_produced > 0
      ? ((summary.today_rejected / summary.today_produced) * 100).toFixed(1)
      : null

  // Orders available in the dialog: in_production status only
  const inProductionOrders: InProductionOrder[] = orderedQueue
    .filter((o) => o.status === 'in_production')
    .map((o) => ({ id: o.id, order_number: o.order_number, products: o.products }))

  // All orders for log filter (unique from queue + use order_number for display)
  const allOrdersForFilter = initialOrders

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('summary.todayProduction')}</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.today_produced > 0
                ? t('summary.pieces', { count: summary.today_produced })
                : t('summary.noData')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('summary.todayRejection')}</p>
            <p
              className={cn(
                'mt-1 text-2xl font-bold',
                todayRejectionRate !== null && parseFloat(todayRejectionRate) > 5
                  ? 'text-destructive'
                  : ''
              )}
            >
              {todayRejectionRate !== null ? `${todayRejectionRate}%` : t('summary.noData')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('summary.weeklyTotal')}</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.week_produced > 0
                ? t('summary.pieces', { count: summary.week_produced })
                : t('summary.noData')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('summary.atRisk')}</p>
            <p
              className={cn(
                'mt-1 text-2xl font-bold',
                summary.at_risk_count > 0 ? 'text-destructive' : ''
              )}
            >
              {summary.at_risk_count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Log Production button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'queue'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('tabs.queue')}
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'log'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('tabs.log')}
          </button>
        </div>
        {canLog && (
          <Button onClick={() => setLogDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('logProduction')}
          </Button>
        )}
      </div>

      {/* Priority Queue tab */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {orderedQueue.length > 0 && (
            <p className="text-xs text-muted-foreground">{t('queue.dragHint')}</p>
          )}
          <Card>
            <CardContent className="p-0">
              {orderedQueue.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('queue.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">{t('queue.columns.priority')}</TableHead>
                        <TableHead>{t('queue.columns.order')}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t('queue.columns.customer')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('queue.columns.product')}
                        </TableHead>
                        <TableHead>{t('queue.columns.remaining')}</TableHead>
                        <TableHead className="min-w-[120px]">
                          {t('queue.columns.progress')}
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t('queue.columns.deliveryDate')}
                        </TableHead>
                        <TableHead className="hidden lg:table-cell min-w-[200px]">
                          {t('queue.columns.pace')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedQueue.map((order, i) => {
                        const progressPct = Math.min(
                          100,
                          Math.round((order.quantity_produced / order.quantity) * 100)
                        )
                        const isDragOver = dragOverIndex === i

                        return (
                          <TableRow
                            key={order.id}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={(e) => handleDragOver(e, i)}
                            onDrop={() => handleDrop(i)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'cursor-grab active:cursor-grabbing',
                              isDragOver && 'bg-accent'
                            )}
                          >
                            {/* Priority # with drag handle */}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                                <span className="text-xs text-muted-foreground">{i + 1}</span>
                              </div>
                            </TableCell>

                            {/* Order # */}
                            <TableCell className="font-medium text-sm">
                              {order.order_number}
                            </TableCell>

                            {/* Customer */}
                            <TableCell className="hidden sm:table-cell text-sm">
                              {order.customers?.company_name ?? order.customers?.name ?? '—'}
                            </TableCell>

                            {/* Product */}
                            <TableCell className="hidden md:table-cell text-sm">
                              {order.products?.name ?? '—'}
                            </TableCell>

                            {/* Qty remaining */}
                            <TableCell className="text-sm">
                              {order.qty_remaining > 0 ? (
                                <span>
                                  {order.qty_remaining}{' '}
                                  <span className="text-xs text-muted-foreground">
                                    / {order.quantity} {order.products?.unit ?? ''}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-green-600 text-xs font-medium">
                                  {t('queue.complete')}
                                </span>
                              )}
                            </TableCell>

                            {/* Progress bar */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      progressPct >= 100 ? 'bg-green-500' : 'bg-primary'
                                    )}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {progressPct}%
                                </span>
                              </div>
                            </TableCell>

                            {/* Promised date */}
                            <TableCell className="hidden sm:table-cell text-sm">
                              {order.delivery_date ? (
                                formatDateCompact(order.delivery_date)
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  {t('queue.noDeliveryDate')}
                                </span>
                              )}
                            </TableCell>

                            {/* Pace warning */}
                            <TableCell className="hidden lg:table-cell">
                              <PaceCell order={order} t={t} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Production Log tab */}
      {activeTab === 'log' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('log.filters.dateFrom')}</label>
              <Input
                type="date"
                value={logFilterDateFrom}
                onChange={(e) => setLogFilterDateFrom(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('log.filters.dateTo')}</label>
              <Input
                type="date"
                value={logFilterDateTo}
                onChange={(e) => setLogFilterDateTo(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('log.filters.allOrders')}</label>
              <select
                value={logFilterOrderId}
                onChange={(e) => setLogFilterOrderId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('log.filters.allOrders')}</option>
                {allOrdersForFilter.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t('log.filters.allWorkers')}
              </label>
              <select
                value={logFilterWorkerId}
                onChange={(e) => setLogFilterWorkerId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('log.filters.allWorkers')}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {logLoading ? (
                <p className="p-6 text-sm text-muted-foreground">{t('log.loading')}</p>
              ) : logBatches.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('log.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('log.columns.date')}</TableHead>
                        <TableHead>{t('log.columns.order')}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t('log.columns.product')}
                        </TableHead>
                        <TableHead className="text-right">{t('log.columns.produced')}</TableHead>
                        <TableHead className="text-right">{t('log.columns.rejected')}</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">
                          {t('log.columns.yield')}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('log.columns.worker')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logBatches.map((batch) => {
                        const yieldPct = computeYield(
                          batch.quantity_produced,
                          batch.quantity_rejected
                        )
                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="text-sm">
                              {formatISTDate(new Date(batch.created_at))}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {batch.orders?.order_number ?? '—'}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {batch.products?.name ?? '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {batch.quantity_produced}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right text-sm tabular-nums',
                                batch.quantity_rejected > 0 ? 'text-destructive' : ''
                              )}
                            >
                              {batch.quantity_rejected}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums">
                              {yieldPct.toFixed(1)}%
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {batch.users?.full_name ?? '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {logPagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                disabled={logPagination.page <= 1 || logLoading}
                onClick={() => void fetchLog(logPagination.page - 1)}
              >
                {t('log.prev')}
              </Button>
              <span>
                {t('log.pageInfo', {
                  page: logPagination.page,
                  pages: logPagination.pages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={logPagination.page >= logPagination.pages || logLoading}
                onClick={() => void fetchLog(logPagination.page + 1)}
              >
                {t('log.next')}
              </Button>
            </div>
          )}
        </div>
      )}

      <LogProductionDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        orders={inProductionOrders}
        onSuccess={handleLogSuccess}
      />
    </div>
  )
}

// Extracted to keep the table row readable
function PaceCell({
  order,
  t,
}: {
  order: EnrichedOrder
  t: ReturnType<typeof useTranslations<'pages.production'>>
}) {
  if (order.qty_remaining === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t('queue.complete')}
      </span>
    )
  }
  if (!order.delivery_date) {
    return <span className="text-xs text-muted-foreground">{t('queue.noDeliveryDate')}</span>
  }
  if (order.daily_output === null || order.projected_finish === null) {
    return <span className="text-xs text-muted-foreground">{t('queue.noPaceData')}</span>
  }
  if (order.is_at_risk) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Promised {formatDateCompact(order.delivery_date)} — at current pace:{' '}
        {formatDateCompact(order.projected_finish)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      Promised {formatDateCompact(order.delivery_date)} — {t('queue.onTrack')}
    </span>
  )
}
