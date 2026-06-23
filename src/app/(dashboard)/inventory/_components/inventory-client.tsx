'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Package,
  AlertTriangle,
  AlertCircle,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ADJUSTMENT_REASONS } from '@/lib/validations/inventory'
import type { AdjustmentReason } from '@/lib/validations/inventory'

export interface InventoryItem {
  id: string
  item_name: string
  item_type: string
  current_quantity: number
  unit: string
  reorder_level: number
  is_low_stock: boolean
  product_id: string | null
  product_name: string | null
  last_restocked_at: string | null
  updated_at: string
}

export interface InventorySummary {
  total_items: number
  low_stock_count: number
  raw_material_count: number
  finished_good_count: number
}

type StockStatus = 'ok' | 'low' | 'critical'
type ActiveFilter = 'all' | 'low_and_critical' | 'critical'

interface Movement {
  id: string
  created_at: string
  quantity: number
  reason: string
  notes: string | null
  balance_after: number
  created_by_name: string | null
}

function getStatus(item: InventoryItem): StockStatus {
  if (item.current_quantity < item.reorder_level) return 'critical'
  if (item.current_quantity < item.reorder_level * 1.5) return 'low'
  return 'ok'
}

const STATUS_ORDER: Record<StockStatus, number> = { critical: 0, low: 1, ok: 2 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'pages.inventory'>>

function StatusBadge({ status, t }: { status: StockStatus; t: TFunc }) {
  if (status === 'critical') {
    return <Badge variant="destructive">{t('status.critical')}</Badge>
  }
  if (status === 'low') {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
        {t('status.low')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
      {t('status.ok')}
    </Badge>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  active,
  onClick,
}: {
  label: string
  value: number
  icon: React.ElementType
  variant?: 'default' | 'warning' | 'destructive'
  active?: boolean
  onClick: () => void
}) {
  return (
    <Card
      className={cn('cursor-pointer transition-colors hover:bg-muted/50', active && 'ring-2 ring-primary')}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon
          className={cn(
            'h-4 w-4',
            variant === 'warning' && 'text-yellow-600',
            variant === 'destructive' && 'text-destructive',
            variant === 'default' && 'text-muted-foreground'
          )}
        />
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            'text-2xl font-bold',
            variant === 'warning' && value > 0 && 'text-yellow-700',
            variant === 'destructive' && value > 0 && 'text-destructive'
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Movement History ─────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  vendor_receipt: 'Received from vendor',
  damaged: 'Damaged / scrapped',
  physical_count: 'Physical count correction',
  return: 'Customer return',
  other: 'Other',
}

function MovementHistory({
  movements,
  loading,
  error,
  t,
}: {
  movements: Movement[] | undefined
  loading: boolean
  error: string | undefined
  t: TFunc
}) {
  if (loading) return <p className="py-2 text-sm text-muted-foreground">{t('movements.loading')}</p>
  if (error) return <p className="py-2 text-sm text-destructive">{t('movements.error')}</p>
  if (!movements || movements.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{t('movements.noData')}</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('movements.title')}
      </p>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 text-xs">{t('movements.date')}</TableHead>
            <TableHead className="h-8 text-right text-xs">{t('movements.change')}</TableHead>
            <TableHead className="h-8 text-right text-xs">{t('movements.balance')}</TableHead>
            <TableHead className="h-8 text-xs">{t('movements.reason')}</TableHead>
            <TableHead className="h-8 text-xs">{t('movements.by')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id} className="hover:bg-transparent">
              <TableCell className="py-1.5 text-sm text-muted-foreground">
                {formatDateTime(m.created_at)}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-medium',
                    m.quantity > 0 ? 'text-green-700' : 'text-destructive'
                  )}
                >
                  {m.quantity > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono text-sm">{m.balance_after}</TableCell>
              <TableCell className="py-1.5 text-sm">
                <span className="text-muted-foreground">{REASON_LABEL[m.reason] ?? m.reason}</span>
                {m.notes && (
                  <span className="ml-1 text-xs text-muted-foreground/70">— {m.notes}</span>
                )}
              </TableCell>
              <TableCell className="py-1.5 text-sm text-muted-foreground">
                {m.created_by_name ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Adjust Dialog ────────────────────────────────────────────────────────────

function AdjustDialog({
  items,
  initialItem,
  onClose,
  onSuccess,
  t,
}: {
  items: InventoryItem[]
  initialItem: InventoryItem | null
  onClose: () => void
  onSuccess: (inventoryId: string, newQty: number) => void
  t: TFunc
}) {
  const [selectedId, setSelectedId] = useState<string>(initialItem?.id ?? '')
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<AdjustmentReason | ''>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = items.find((i) => i.id === selectedId) ?? null
  const qtyNum = parseInt(qty, 10)
  const changeQty = direction === 'add' ? qtyNum : -qtyNum
  const newQty =
    selectedItem != null && !isNaN(qtyNum) ? selectedItem.current_quantity + changeQty : null
  const willGoBelowMin =
    newQty != null && selectedItem != null && newQty < selectedItem.reorder_level

  const isValid = selectedId !== '' && reason !== '' && qty !== '' && !isNaN(qtyNum) && qtyNum > 0

  async function handleSubmit() {
    if (!isValid) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          change_quantity: changeQty,
          reason,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? 'Failed')
      }
      const json = (await res.json()) as { data: { current_quantity: number } }
      onSuccess(selectedId, json.data.current_quantity)
    } catch {
      setError(t('adjust.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('adjust.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product selector */}
          <div className="space-y-1.5">
            <Label>{t('table.item')}</Label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={initialItem != null}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t('adjust.selectProduct')}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name}
                </option>
              ))}
            </select>
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                {t('adjust.currentStock')}: {selectedItem.current_quantity} {selectedItem.unit}
              </p>
            )}
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <Label>{t('adjust.directionLabel')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === 'add' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setDirection('add')}
              >
                {t('adjust.add')}
              </Button>
              <Button
                type="button"
                variant={direction === 'remove' ? 'destructive' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setDirection('remove')}
              >
                {t('adjust.remove')}
              </Button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-qty">{t('adjust.quantityLabel')}</Label>
            <Input
              id="adj-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
            {qty !== '' && (isNaN(qtyNum) || qtyNum <= 0) && (
              <p className="text-xs text-destructive">{t('adjust.invalidQty')}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">{t('adjust.reasonLabel')}</Label>
            <select
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustmentReason)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">—</option>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`adjust.reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-notes">
              {t('adjust.notesLabel')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Textarea
              id="adj-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('adjust.notesPlaceholder')}
              maxLength={500}
            />
          </div>

          {/* Low-stock warning */}
          {willGoBelowMin && (
            <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              {t('adjust.lowStockWarning')}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('adjust.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? t('adjust.submitting') : t('adjust.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InventoryClient({
  initialItems,
  summary,
}: {
  initialItems: InventoryItem[]
  summary: InventorySummary
}) {
  const t = useTranslations('pages.inventory')

  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [movements, setMovements] = useState<Record<string, Movement[]>>({})
  const [movementsLoading, setMovementsLoading] = useState<Set<string>>(new Set())
  const [movementsError, setMovementsError] = useState<Record<string, string>>({})

  const criticalCount = useMemo(
    () => items.filter((i) => getStatus(i) === 'critical').length,
    [items]
  )
  const lowAndCriticalCount = useMemo(
    () => items.filter((i) => getStatus(i) !== 'ok').length,
    [items]
  )

  const filtered = useMemo(() => {
    let result = items

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((i) => i.item_name.toLowerCase().includes(q))
    }

    if (activeFilter === 'critical') {
      result = result.filter((i) => getStatus(i) === 'critical')
    } else if (activeFilter === 'low_and_critical') {
      result = result.filter((i) => getStatus(i) !== 'ok')
    }

    return [...result].sort((a, b) => {
      const diff = STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]
      if (diff !== 0) return diff
      return a.item_name.localeCompare(b.item_name)
    })
  }, [items, search, activeFilter])

  async function loadMovements(id: string) {
    setMovementsLoading((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/inventory/${id}`)
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as { data: Movement[] }
      setMovements((prev) => ({ ...prev, [id]: json.data }))
    } catch {
      setMovementsError((prev) => ({ ...prev, [id]: t('movements.error') }))
    } finally {
      setMovementsLoading((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        if (!movements[id]) loadMovements(id)
      }
      return next
    })
  }

  function handleAdjustOpen(item: InventoryItem | null) {
    setAdjustItem(item)
    setAdjustDialogOpen(true)
  }

  function handleAdjustSuccess(inventoryId: string, newQty: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.id !== inventoryId
          ? i
          : {
              ...i,
              current_quantity: newQty,
              is_low_stock: newQty <= i.reorder_level,
              updated_at: new Date().toISOString(),
            }
      )
    )
    // Invalidate movement cache; reload if currently expanded
    setMovements((prev) => {
      const next = { ...prev }
      delete next[inventoryId]
      return next
    })
    if (expandedIds.has(inventoryId)) loadMovements(inventoryId)
    setAdjustDialogOpen(false)
    setAdjustItem(null)
  }

  return (
    <div className="space-y-6">
      {/* Summary cards — click to filter */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={t('summary.totalItems')}
          value={summary.total_items}
          icon={Package}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <SummaryCard
          label={t('summary.lowStock')}
          value={lowAndCriticalCount}
          icon={AlertTriangle}
          variant="warning"
          active={activeFilter === 'low_and_critical'}
          onClick={() =>
            setActiveFilter((f) => (f === 'low_and_critical' ? 'all' : 'low_and_critical'))
          }
        />
        <SummaryCard
          label={t('summary.criticalStock')}
          value={criticalCount}
          icon={AlertCircle}
          variant="destructive"
          active={activeFilter === 'critical'}
          onClick={() => setActiveFilter((f) => (f === 'critical' ? 'all' : 'critical'))}
        />
      </div>

      {/* Search + global adjust button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('table.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleAdjustOpen(null)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('adjust.title')}
        </Button>
      </div>

      {/* Inventory table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>{t('table.item')}</TableHead>
              <TableHead className="text-right">{t('table.currentStock')}</TableHead>
              <TableHead className="text-right">{t('table.minimumStock')}</TableHead>
              <TableHead>{t('table.unit')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead>{t('table.lastUpdated')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {t('table.noData')}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((item) => {
              const status = getStatus(item)
              const isExpanded = expandedIds.has(item.id)

              return (
                <>
                  <TableRow
                    key={item.id}
                    className={cn(
                      'cursor-pointer',
                      status === 'critical' && 'bg-red-50/50 hover:bg-red-50',
                      status === 'low' && 'bg-yellow-50/50 hover:bg-yellow-50',
                      status === 'ok' && 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleExpand(item.id)}
                  >
                    <TableCell className="pl-4">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.current_quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {item.reorder_level}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                    <TableCell>
                      <StatusBadge status={status} t={t} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.updated_at)}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="text-right pr-4"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustOpen(item)}
                      >
                        {t('adjust.button')}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${item.id}-history`}>
                      <TableCell colSpan={8} className="bg-muted/20 px-6 py-3">
                        <MovementHistory
                          movements={movements[item.id]}
                          loading={movementsLoading.has(item.id)}
                          error={movementsError[item.id]}
                          t={t}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Adjust dialog */}
      {adjustDialogOpen && (
        <AdjustDialog
          items={items}
          initialItem={adjustItem}
          onClose={() => {
            setAdjustDialogOpen(false)
            setAdjustItem(null)
          }}
          onSuccess={handleAdjustSuccess}
          t={t}
        />
      )}
    </div>
  )
}
