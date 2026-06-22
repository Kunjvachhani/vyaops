'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateInvoiceDialog } from '@/app/(dashboard)/invoices/_components/create-invoice-dialog'
import { InvoiceDetailDialog } from '@/app/(dashboard)/invoices/_components/invoice-detail-dialog'
import { DeleteButton } from '@/components/shared/delete-button'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatISTDate, formatIST } from '@/lib/utils/date'
import type { Json } from '@/types/database'

type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'completed'
  | 'dispatched'
  | 'cancelled'

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  dispatched: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_TIMELINE: OrderStatus[] = [
  'draft',
  'confirmed',
  'in_production',
  'completed',
  'dispatched',
]

interface OrderDetail {
  id: string
  order_number: string
  status: string
  quantity: number
  unit_price_paise: number
  total_amount_paise: number
  delivery_date: string | null
  notes: string | null
  source: string
  created_at: string
  updated_at: string
  customers: {
    id: string
    name: string
    company_name: string | null
    phone: string | null
    email: string | null
  } | null
  products: {
    id: string
    name: string
    unit: string
    unit_price_paise: number
  } | null
}

interface AuditEntry {
  id: string
  action: string
  changed_by: string | null
  changed_by_source: string
  old_values: Json | null
  new_values: Json | null
  created_at: string
}

interface OrderDetailDialogProps {
  orderId: string | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  canDelete?: boolean
}

export function OrderDetailDialog({ orderId, onOpenChange, onUpdated, canDelete = false }: OrderDetailDialogProps) {
  const t = useTranslations('pages.orders')
  const tc = useTranslations('common')

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [actionError, setActionError] = useState('')
  const [revertTarget, setRevertTarget] = useState<OrderStatus | null>(null)

  // Invoice linkage: id of an existing (non-cancelled) invoice for this order, if any.
  const [existingInvoiceId, setExistingInvoiceId] = useState<string | null>(null)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null)

  const fetchOrder = useCallback(async (id: string) => {
    setLoading(true)
    setActionError('')
    try {
      const [orderRes, auditRes, invoiceRes] = await Promise.all([
        fetch(`/api/orders/${id}`),
        fetch(`/api/orders/${id}/audit`),
        // Lightweight check: does this order already have a (non-cancelled) invoice?
        fetch(`/api/invoices?order_id=${id}&limit=1`),
      ])
      if (orderRes.ok) {
        const json = await orderRes.json()
        setOrder(json.data as OrderDetail)
      }
      if (auditRes.ok) {
        const json = await auditRes.json()
        setAudit((json.data as AuditEntry[]) ?? [])
      }
      if (invoiceRes.ok) {
        const json = await invoiceRes.json()
        const live = ((json.data as { id: string; status: string }[]) ?? []).find(
          (inv) => inv.status !== 'cancelled'
        )
        setExistingInvoiceId(live?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId)
    } else {
      setOrder(null)
      setAudit([])
      setActionError('')
      setExistingInvoiceId(null)
    }
  }, [orderId, fetchOrder])

  async function updateStatus(newStatus: OrderStatus) {
    if (!order) return
    setUpdating(true)
    setActionError('')
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: order.updated_at, status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json()
        setActionError((json.error as string | undefined) ?? tc('error'))
        return
      }
      await fetchOrder(order.id)
      onUpdated()
    } finally {
      setUpdating(false)
    }
  }

  function statusBadgeClass(s: string) {
    return STATUS_COLORS[s as OrderStatus] ?? 'bg-gray-100 text-gray-700'
  }

  function statusLabel(s: string) {
    const valid: OrderStatus[] = ['draft', 'confirmed', 'in_production', 'completed', 'dispatched', 'cancelled']
    return valid.includes(s as OrderStatus) ? t(`status.${s}`) : s
  }

  const currentStatusIdx = STATUS_TIMELINE.indexOf(order?.status as OrderStatus)

  const open = orderId !== null

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {loading ? '…' : (order?.order_number ?? '')}
          </DialogTitle>
          {!loading && order && (
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}
            >
              {statusLabel(order.status)}
            </span>
          )}
        </DialogHeader>

        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        )}

        {!loading && order && (
          <div className="space-y-6 pb-2">
            {actionError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}

            {/* ── Order Info ── */}
            <div className="rounded-md border p-4">
              <p className="mb-3 text-sm font-semibold">{t('detail.orderInfo')}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">{t('detail.customer')}</span>
                <span className="font-medium">
                  {order.customers?.name ?? '—'}
                  {order.customers?.company_name && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {order.customers.company_name}
                    </span>
                  )}
                </span>

                <span className="text-muted-foreground">{t('detail.date')}</span>
                <span>{formatISTDate(new Date(order.created_at))}</span>

                {order.delivery_date && (
                  <>
                    <span className="text-muted-foreground">{t('detail.deliveryDate')}</span>
                    <span>{formatISTDate(new Date(order.delivery_date))}</span>
                  </>
                )}

                <span className="text-muted-foreground">{t('detail.source')}</span>
                <span className="capitalize">{order.source}</span>

                {order.notes && (
                  <>
                    <span className="text-muted-foreground">{t('detail.notes')}</span>
                    <span className="text-xs leading-relaxed">{order.notes}</span>
                  </>
                )}
              </div>
            </div>

            {/* ── Line Items ── */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('detail.lineItems')}</p>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('detail.product')}</TableHead>
                      <TableHead className="text-right text-xs">{t('detail.qty')}</TableHead>
                      <TableHead className="text-right text-xs">{t('detail.unitPrice')}</TableHead>
                      <TableHead className="text-right text-xs">{t('detail.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-sm">
                        {order.products?.name ?? '—'}
                        {order.products?.unit && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({order.products.unit})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">{order.quantity}</TableCell>
                      <TableCell className="text-right text-sm">
                        {paiseToCurrency(order.unit_price_paise)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {paiseToCurrency(order.total_amount_paise)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ── Status Timeline ── */}
            {order.status !== 'cancelled' && (
              <div>
                <p className="mb-3 text-sm font-semibold">{t('detail.timeline')}</p>
                <div className="flex items-start">
                  {STATUS_TIMELINE.map((s, idx) => {
                    const isActive = idx <= currentStatusIdx
                    const isCurrent = order.status === s
                    const isLast = idx === STATUS_TIMELINE.length - 1
                    return (
                      <div key={s} className="flex flex-1 last:flex-none items-start">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-3 w-3 rounded-full border-2 transition-colors ${
                              isCurrent
                                ? 'border-primary bg-primary'
                                : isActive
                                ? 'border-primary bg-primary/20'
                                : 'border-muted-foreground/30 bg-background'
                            }`}
                          />
                          <span
                            className={`mt-1.5 max-w-[52px] text-center text-[10px] leading-tight ${
                              isCurrent
                                ? 'font-semibold text-primary'
                                : isActive
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {t(`status.${s}`)}
                          </span>
                        </div>
                        {!isLast && (
                          <div
                            className={`mx-1 mt-[5px] h-0.5 flex-1 transition-colors ${
                              idx < currentStatusIdx ? 'bg-primary/50' : 'bg-muted'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap gap-2">
              {order.status === 'draft' && (
                <Button size="sm" onClick={() => updateStatus('confirmed')} disabled={updating}>
                  {updating ? t('detail.updating') : t('detail.confirmOrder')}
                </Button>
              )}
              {order.status === 'confirmed' && (
                <>
                  <Button size="sm" onClick={() => updateStatus('in_production')} disabled={updating}>
                    {updating ? t('detail.updating') : t('detail.startProduction')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRevertTarget('draft')} disabled={updating}>
                    {t('detail.revertTo', { status: statusLabel('draft') })}
                  </Button>
                </>
              )}
              {order.status === 'in_production' && (
                <>
                  <Button size="sm" onClick={() => updateStatus('completed')} disabled={updating}>
                    {updating ? t('detail.updating') : t('detail.markComplete')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRevertTarget('confirmed')} disabled={updating}>
                    {t('detail.revertTo', { status: statusLabel('confirmed') })}
                  </Button>
                </>
              )}
              {order.status === 'completed' && (
                <>
                  {existingInvoiceId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewInvoiceId(existingInvoiceId)}
                    >
                      {t('detail.viewInvoice')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateInvoiceOpen(true)}
                    >
                      {t('detail.generateInvoice')}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => updateStatus('dispatched')} disabled={updating}>
                    {updating ? t('detail.updating') : t('detail.markDispatched')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRevertTarget('in_production')} disabled={updating}>
                    {t('detail.revertTo', { status: statusLabel('in_production') })}
                  </Button>
                </>
              )}
              {canDelete && (
                <DeleteButton
                  endpoint={`/api/orders/${order.id}`}
                  table="orders"
                  id={order.id}
                  label={order.order_number}
                  onChange={() => {
                    onOpenChange(false)
                    onUpdated()
                  }}
                />
              )}
            </div>

            {/* ── Backward-status warning dialog ── */}
            <Dialog open={revertTarget !== null} onOpenChange={(v) => { if (!v) setRevertTarget(null) }}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>{t('detail.backwardStatusTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('detail.backwardStatusDesc', { status: revertTarget ? statusLabel(revertTarget) : '' })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRevertTarget(null)} autoFocus>
                    {tc('cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={updating}
                    onClick={async () => {
                      if (!revertTarget) return
                      const target = revertTarget
                      setRevertTarget(null)
                      await updateStatus(target)
                    }}
                  >
                    {t('detail.backwardStatusConfirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ── Audit Trail ── */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('detail.auditTrail')}</p>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noAudit')}</p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {audit.map((entry) => {
                    const newVals =
                      entry.new_values && typeof entry.new_values === 'object' && !Array.isArray(entry.new_values)
                        ? (entry.new_values as Record<string, unknown>)
                        : null
                    return (
                      <div key={entry.id} className="flex items-start gap-2 text-xs">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium capitalize">
                              {entry.action.toLowerCase().replace('_', ' ')}
                            </span>
                            <span className="text-muted-foreground">
                              {t('detail.by')} {entry.changed_by_source}
                            </span>
                          </div>
                          {typeof newVals?.status === 'string' && (
                            <div className="text-muted-foreground">
                              → {newVals.status}
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            {formatIST(new Date(entry.created_at))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

      {/* Generate an invoice for this order (pre-selected, skips the order picker). */}
      <CreateInvoiceDialog
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
        presetOrderId={order?.id ?? null}
        onSuccess={() => {
          if (order) fetchOrder(order.id)
          onUpdated()
        }}
      />

      {/* View the existing invoice for this order. */}
      <InvoiceDetailDialog
        invoiceId={viewInvoiceId}
        onOpenChange={(o) => !o && setViewInvoiceId(null)}
        onUpdated={() => {
          if (order) fetchOrder(order.id)
          onUpdated()
        }}
      />
    </>
  )
}
