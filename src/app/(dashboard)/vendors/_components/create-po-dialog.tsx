'use client'

import { useState } from 'react'
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

type FormErrors = Record<string, string[]>

interface CreatePODialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorId: string
  onSuccess: () => void
}

const EMPTY_FORM = {
  material_name: '',
  quantity: '',
  unit: 'tons',
  unit_price_rupees: '',
  expected_date: '',
  notes: '',
}

export function CreatePODialog({ open, onOpenChange, vendorId, onSuccess }: CreatePODialogProps) {
  const t = useTranslations()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    }
  }

  function fieldError(key: string) {
    return errors[key]?.[0]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError('')
    setSubmitting(true)

    try {
      const unit_price_paise = form.unit_price_rupees
        ? Math.round(parseFloat(form.unit_price_rupees) * 100)
        : undefined

      const body = {
        material_name: form.material_name,
        quantity: parseFloat(form.quantity),
        unit: form.unit || 'tons',
        unit_price_paise: unit_price_paise !== undefined && !isNaN(unit_price_paise) ? unit_price_paise : undefined,
        expected_date: form.expected_date || undefined,
        notes: form.notes || undefined,
      }

      const res = await fetch(`/api/vendors/${vendorId}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 422) {
        const json = await res.json()
        setErrors(json.details?.fieldErrors ?? {})
        return
      }

      if (!res.ok) {
        const json = await res.json()
        setServerError(json.error ?? t('errors.generic'))
        return
      }

      setForm(EMPTY_FORM)
      onOpenChange(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('pages.vendors.po.form.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="po-material">{t('pages.vendors.po.form.material')}</Label>
            <Input id="po-material" required {...field('material_name')} />
            {fieldError('material_name') && (
              <p className="text-xs text-destructive">{fieldError('material_name')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="po-qty">{t('pages.vendors.po.form.quantity')}</Label>
              <Input
                id="po-qty"
                type="number"
                min="0"
                step="any"
                required
                {...field('quantity')}
              />
              {fieldError('quantity') && (
                <p className="text-xs text-destructive">{fieldError('quantity')}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-unit">{t('pages.vendors.po.form.unit')}</Label>
              <Input id="po-unit" placeholder="tons" {...field('unit')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="po-price">
                {t('pages.vendors.po.form.unitPrice')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                id="po-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...field('unit_price_rupees')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-date">
                {t('pages.vendors.po.form.expectedDate')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input id="po-date" type="date" {...field('expected_date')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-notes">
              {t('pages.vendors.po.form.notes')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Textarea id="po-notes" rows={2} {...field('notes')} />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('pages.vendors.po.form.creating') : t('pages.vendors.po.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
