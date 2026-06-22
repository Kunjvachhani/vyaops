'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
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

export interface InProductionOrder {
  id: string
  order_number: string
  products: { name: string; unit: string } | null
}

interface LogProductionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: InProductionOrder[]
  onSuccess: () => void
}

const DEFECT_TYPES = [
  'sand_holes',
  'dimensional',
  'porosity',
  'shrinkage',
  'cold_shut',
  'surface_defect',
  'other',
] as const

const SHIFTS = ['shift_1', 'shift_2', 'shift_3'] as const

export function LogProductionDialog({
  open,
  onOpenChange,
  orders,
  onSuccess,
}: LogProductionDialogProps) {
  const t = useTranslations('pages.production')

  const [orderId, setOrderId] = useState('')
  const [quantityProduced, setQuantityProduced] = useState('')
  const [quantityRejected, setQuantityRejected] = useState('0')
  const [defectType, setDefectType] = useState('')
  const [shift, setShift] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setOrderId('')
    setQuantityProduced('')
    setQuantityRejected('0')
    setDefectType('')
    setShift('')
    setNotes('')
    setError('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const produced = parseInt(quantityProduced, 10)
    const rejected = parseInt(quantityRejected, 10)

    if (!orderId) {
      setError('Select an order')
      return
    }
    if (isNaN(produced) || produced < 1) {
      setError('Enter a valid quantity produced')
      return
    }
    if (isNaN(rejected) || rejected < 0) {
      setError('Rejected quantity cannot be negative')
      return
    }
    if (rejected > produced) {
      setError('Rejected cannot exceed quantity produced')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        order_id: orderId,
        quantity_produced: produced,
        quantity_rejected: rejected,
      }
      if (defectType) body.defect_type = defectType
      if (shift) body.shift = shift
      if (notes.trim()) body.notes = notes.trim()

      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        setError(json.error ?? t('logDialog.error'))
        return
      }

      handleOpenChange(false)
      toast.success(t('logDialog.success'))
      onSuccess()
    } catch {
      setError(t('logDialog.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const rejectedCount = parseInt(quantityRejected, 10)
  const showDefectType = !isNaN(rejectedCount) && rejectedCount > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('logDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="log-order">{t('logDialog.orderLabel')}</Label>
            <select
              id="log-order"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t('logDialog.orderPlaceholder')}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number}
                  {o.products ? ` — ${o.products.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="log-produced">{t('logDialog.qtyProducedLabel')}</Label>
              <Input
                id="log-produced"
                type="number"
                min="1"
                value={quantityProduced}
                onChange={(e) => setQuantityProduced(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-rejected">{t('logDialog.qtyRejectedLabel')}</Label>
              <Input
                id="log-rejected"
                type="number"
                min="0"
                value={quantityRejected}
                onChange={(e) => setQuantityRejected(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {showDefectType && (
            <div className="space-y-1.5">
              <Label htmlFor="log-defect">{t('logDialog.defectTypeLabel')}</Label>
              <select
                id="log-defect"
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('logDialog.defectTypePlaceholder')}</option>
                {DEFECT_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`defectTypes.${d}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="log-shift">{t('logDialog.shiftLabel')}</Label>
            <select
              id="log-shift"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t('logDialog.shiftPlaceholder')}</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {t(`shifts.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-notes">{t('logDialog.notesLabel')}</Label>
            <Textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('logDialog.notesPlaceholder')}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {t('logDialog.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '...' : t('logDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
