'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Package, Boxes, Factory } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
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
}

export interface InventorySummary {
  total_items: number
  low_stock_count: number
  raw_material_count: number
  finished_good_count: number
}

type FilterTab = 'all' | 'raw_material' | 'finished_good' | 'low_stock'

type AdjustDirection = 'add' | 'remove'

interface AdjustDialogState {
  item: InventoryItem
  direction: AdjustDirection
  quantity: string
  reason: AdjustmentReason
  error: string | null
}

export function InventoryClient({
  initialItems,
  summary: initialSummary,
}: {
  initialItems: InventoryItem[]
  summary: InventorySummary
}) {
  const t = useTranslations('pages.inventory')
  const [items, setItems] = useState<InventoryItem[]>(initialItems)
  const [summary, setSummary] = useState<InventorySummary>(initialSummary)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [dialog, setDialog] = useState<AdjustDialogState | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredItems = items.filter((item) => {
    if (activeTab === 'raw_material') return item.item_type === 'raw_material'
    if (activeTab === 'finished_good') return item.item_type === 'finished_good'
    if (activeTab === 'low_stock') return item.is_low_stock
    return true
  })

  function openAdjustDialog(item: InventoryItem) {
    setDialog({
      item,
      direction: 'add',
      quantity: '',
      reason: 'vendor_receipt',
      error: null,
    })
  }

  function closeDialog() {
    setDialog(null)
  }

  function handleDirectionChange(direction: AdjustDirection) {
    if (!dialog) return
    setDialog({
      ...dialog,
      direction,
      reason: direction === 'add' ? 'vendor_receipt' : 'damaged',
      error: null,
    })
  }

  function handleSubmit() {
    if (!dialog) return

    const qty = parseFloat(dialog.quantity)
    if (!dialog.quantity || isNaN(qty) || qty <= 0) {
      setDialog({ ...dialog, error: t('adjust.invalidQty') })
      return
    }

    const changeQuantity = dialog.direction === 'add' ? qty : -qty

    startTransition(async () => {
      try {
        const res = await fetch(`/api/inventory/${dialog.item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change_quantity: changeQuantity, reason: dialog.reason }),
        })

        if (!res.ok) {
          setDialog({ ...dialog, error: t('adjust.error') })
          return
        }

        const json = (await res.json()) as { data: InventoryItem & { is_low_stock: boolean } }
        const updated = json.data

        setItems((prev) => {
          const next = prev.map((i) =>
            i.id === updated.id
              ? { ...i, current_quantity: updated.current_quantity, is_low_stock: updated.is_low_stock }
              : i
          )
          setSummary({
            total_items: next.length,
            low_stock_count: next.filter((i) => i.is_low_stock).length,
            raw_material_count: next.filter((i) => i.item_type === 'raw_material').length,
            finished_good_count: next.filter((i) => i.item_type === 'finished_good').length,
          })
          return next
        })

        closeDialog()
      } catch {
        setDialog({ ...dialog, error: t('adjust.error') })
      }
    })
  }

  const tabButtons: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: t('filters.all'), count: summary.total_items },
    { key: 'raw_material', label: t('filters.raw_material'), count: summary.raw_material_count },
    { key: 'finished_good', label: t('filters.finished_good'), count: summary.finished_good_count },
    { key: 'low_stock', label: t('filters.low_stock'), count: summary.low_stock_count },
  ]

  const addReasons: AdjustmentReason[] = ['vendor_receipt', 'return', 'other']
  const removeReasons: AdjustmentReason[] = ['damaged', 'physical_count', 'other']
  const reasonOptions = dialog?.direction === 'add' ? addReasons : removeReasons

  const willBeLowStock =
    dialog
      ? (() => {
          const qty = parseFloat(dialog.quantity)
          if (isNaN(qty) || qty <= 0) return false
          const changeQty = dialog.direction === 'add' ? qty : -qty
          return dialog.item.current_quantity + changeQty <= dialog.item.reorder_level
        })()
      : false

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4" />
              {t('summary.totalItems')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total_items}</p>
          </CardContent>
        </Card>

        <Card className={summary.low_stock_count > 0 ? 'border-destructive/60' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className={cn('h-4 w-4', summary.low_stock_count > 0 && 'text-destructive')} />
              {t('summary.lowStock')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold', summary.low_stock_count > 0 && 'text-destructive')}>
              {summary.low_stock_count}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Boxes className="h-4 w-4" />
              {t('summary.rawMaterials')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.raw_material_count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Factory className="h-4 w-4" />
              {t('summary.finishedGoods')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.finished_good_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabButtons.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                activeTab === tab.key ? 'bg-primary-foreground/20' : 'bg-background'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Inventory table */}
      <Card>
        <CardContent className="pt-0">
          {filteredItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('table.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.item')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('table.type')}</TableHead>
                  <TableHead className="text-right">{t('table.currentStock')}</TableHead>
                  <TableHead className="hidden md:table-cell text-right">{t('table.reorderLevel')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('table.lastRestocked')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        {item.product_name && (
                          <p className="text-xs text-muted-foreground">{item.product_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {item.item_type === 'raw_material'
                          ? t('itemTypes.raw_material')
                          : t('itemTypes.finished_good')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-medium tabular-nums', item.is_low_stock && 'text-destructive')}>
                        {item.current_quantity.toLocaleString('en-IN')} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground tabular-nums">
                      {item.reorder_level.toLocaleString('en-IN')} {item.unit}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {item.last_restocked_at
                        ? new Date(item.last_restocked_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {item.is_low_stock ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {t('status.lowStock')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                          {t('status.ok')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjustDialog(item)}
                      >
                        {t('adjust.button')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjustment dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adjust.title')}</DialogTitle>
            {dialog && (
              <p className="text-sm text-muted-foreground">{dialog.item.item_name}</p>
            )}
          </DialogHeader>

          {dialog && (
            <div className="space-y-4 py-2">
              {/* Direction toggle */}
              <div className="space-y-1.5">
                <Label>{t('adjust.directionLabel')}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('add')}
                    className={cn(
                      'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                      dialog.direction === 'add'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-muted'
                    )}
                  >
                    + {t('adjust.add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('remove')}
                    className={cn(
                      'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                      dialog.direction === 'remove'
                        ? 'border-destructive bg-destructive text-destructive-foreground'
                        : 'border-input bg-background hover:bg-muted'
                    )}
                  >
                    − {t('adjust.remove')}
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-qty">
                  {t('adjust.quantityLabel')} ({dialog.item.unit})
                </Label>
                <Input
                  id="adj-qty"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0"
                  value={dialog.quantity}
                  onChange={(e) => setDialog({ ...dialog, quantity: e.target.value, error: null })}
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  {t('adjust.currentStock')}: {dialog.item.current_quantity.toLocaleString('en-IN')} {dialog.item.unit}
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-reason">{t('adjust.reasonLabel')}</Label>
                <select
                  id="adj-reason"
                  value={dialog.reason}
                  onChange={(e) =>
                    setDialog({ ...dialog, reason: e.target.value as AdjustmentReason, error: null })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {reasonOptions.map((r) => (
                    <option key={r} value={r}>
                      {t(`adjust.reasons.${r}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Low stock warning */}
              {willBeLowStock && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('adjust.lowStockWarning')}
                </div>
              )}

              {/* Error */}
              {dialog.error && (
                <p className="text-sm text-destructive">{dialog.error}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {t('adjust.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? t('adjust.submitting') : t('adjust.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
