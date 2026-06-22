'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { paiseToCurrency } from '@/lib/utils/currency'
import { Check, FileText } from 'lucide-react'

interface EligibleOrder {
  id: string
  order_number: string
  quantity: number
  unit_price_paise: number
  total_amount_paise: number
  status: string
  created_at: string
  customers: {
    id: string
    name: string
    company_name: string | null
    gstin: string | null
    payment_terms_days: number | null
  } | null
  products: { id: string; name: string; unit: string } | null
}

interface CreateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  // When set, pre-select this order and jump straight to the review step,
  // skipping the order picker (used by the order detail "Generate Invoice" button).
  presetOrderId?: string | null
}

// YYYY-MM-DD for `today + days`.
function dueDateFromTerms(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  presetOrderId,
}: CreateInvoiceDialogProps) {
  const t = useTranslations('pages.invoices')
  const tc = useTranslations('common')

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  // Step 1: order selection
  const [orders, setOrders] = useState<EligibleOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<EligibleOrder | null>(null)

  // Step 2: adjustments
  const [taxRate, setTaxRate] = useState('18')
  const [dueDate, setDueDate] = useState('')
  const [subtotalRupees, setSubtotalRupees] = useState('')
  const [notes, setNotes] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await fetch('/api/invoices/eligible-orders')
      if (!res.ok) return
      const json = await res.json()
      setOrders((json.data as EligibleOrder[]) ?? [])
    } finally {
      setLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    if (open && step === 1) fetchOrders()
  }, [open, step, fetchOrders])

  // When opened with a preset order, select it and jump straight to the review step.
  useEffect(() => {
    if (!open || !presetOrderId || selectedOrder) return
    const found = orders.find((o) => o.id === presetOrderId)
    if (found) {
      selectOrder(found)
      setStep(2)
    }
  }, [open, presetOrderId, orders, selectedOrder])

  function reset() {
    setStep(1)
    setError('')
    setOrderSearch('')
    setSelectedOrder(null)
    setTaxRate('18')
    setDueDate('')
    setSubtotalRupees('')
    setNotes('')
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  function selectOrder(o: EligibleOrder) {
    setSelectedOrder(o)
    setSubtotalRupees(String(o.total_amount_paise / 100))
    setDueDate(dueDateFromTerms(o.customers?.payment_terms_days ?? 30))
  }

  const filteredOrders = orders.filter((o) => {
    if (!orderSearch) return true
    const q = orderSearch.toLowerCase()
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.customers?.name ?? '').toLowerCase().includes(q)
    )
  })

  // Live GST math mirrors src/lib/utils/gst.ts computeGst.
  const subtotalPaise = Math.round(parseFloat(subtotalRupees || '0') * 100)
  const rate = parseFloat(taxRate || '0')
  const taxPaise =
    subtotalPaise > 0 && rate >= 0 ? Math.round((subtotalPaise * rate) / 100) : 0
  const totalPaise = subtotalPaise + taxPaise

  const step2Valid = subtotalPaise > 0 && !!dueDate && rate >= 0 && rate <= 28

  function buildPayload() {
    if (!selectedOrder) return null
    return {
      orderId: selectedOrder.id,
      taxRate: rate,
      dueDate,
      subtotalPaise:
        subtotalPaise === selectedOrder.total_amount_paise ? undefined : subtotalPaise,
      notes: notes.trim() || undefined,
    }
  }

  async function handlePreview() {
    const payload = buildPayload()
    if (!payload) return
    setError('')
    setPreviewing(true)
    try {
      const res = await fetch('/api/invoices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError((json?.error as string | undefined) ?? tc('error'))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      // Revoke after a delay so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSubmit() {
    const payload = buildPayload()
    if (!payload) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError((json?.error as string | undefined) ?? tc('error'))
        return
      }
      reset()
      onOpenChange(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const stepTitles = [t('createDialog.step1Title'), t('createDialog.step2Title')]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {stepTitles[step - 1]}{' '}
            <span className="text-xs">({t('createDialog.step', { step })})</span>
          </p>
        </DialogHeader>

        <div className="flex gap-1">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {/* ── Step 1: select order ── */}
        {step === 1 && (
          <div className="space-y-3">
            <Input
              placeholder={t('createDialog.searchOrder')}
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
              {loadingOrders ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{tc('loading')}</p>
              ) : filteredOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('createDialog.noOrders')}
                </p>
              ) : (
                filteredOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                      selectedOrder?.id === o.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => selectOrder(o)}
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-medium">{o.order_number}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {o.customers?.name ?? '—'}
                      </span>
                      {o.products?.name && (
                        <div className="truncate text-xs text-muted-foreground">
                          {o.products.name} × {o.quantity}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium">
                        {paiseToCurrency(o.total_amount_paise)}
                      </span>
                      {selectedOrder?.id === o.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: review & adjust ── */}
        {step === 2 && selectedOrder && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-y-1.5">
                <span className="text-muted-foreground">{t('createDialog.order')}</span>
                <span className="font-mono">{selectedOrder.order_number}</span>
                <span className="text-muted-foreground">{t('createDialog.customer')}</span>
                <span>{selectedOrder.customers?.name ?? '—'}</span>
                <span className="text-muted-foreground">{t('createDialog.product')}</span>
                <span>
                  {selectedOrder.products?.name ?? '—'} × {selectedOrder.quantity}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inv-subtotal">{t('createDialog.subtotal')} (₹)</Label>
                <Input
                  id="inv-subtotal"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={subtotalRupees}
                  onChange={(e) => setSubtotalRupees(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-tax">{t('createDialog.taxRate')}</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  min="0"
                  max="28"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-due">{t('createDialog.dueDate')}</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-notes">
                {t('createDialog.notes')}{' '}
                <span className="text-xs text-muted-foreground">({tc('optional')})</span>
              </Label>
              <Textarea
                id="inv-notes"
                rows={2}
                placeholder={t('createDialog.notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="rounded-md bg-muted px-3 py-2.5 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('createDialog.subtotal')}</span>
                <span>{paiseToCurrency(subtotalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('createDialog.tax')} ({rate || 0}%)
                </span>
                <span>{paiseToCurrency(taxPaise)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>{t('createDialog.total')}</span>
                <span>{paiseToCurrency(totalPaise)}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={handlePreview}
              disabled={!step2Valid || previewing}
            >
              <FileText className="h-3.5 w-3.5" />
              {previewing ? t('createDialog.generating') : t('createDialog.previewPdf')}
            </Button>
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? handleOpenChange(false) : setStep(1))}
            disabled={submitting}
          >
            {step === 1 ? tc('cancel') : tc('back')}
          </Button>

          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)} disabled={!selectedOrder}>
              {tc('next')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting || !step2Valid}>
              {submitting ? t('createDialog.creating') : t('createDialog.create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
