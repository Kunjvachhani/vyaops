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

interface AddVendorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const EMPTY_FORM = {
  name: '',
  company_name: '',
  phone: '',
  email: '',
  gstin: '',
  address: '',
  materials_supplied: '',
  payment_terms_days: '30',
  rating: '',
  notes: '',
}

export function AddVendorDialog({ open, onOpenChange, onSuccess }: AddVendorDialogProps) {
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
      const materialsArray = form.materials_supplied
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const body = {
        name: form.name,
        company_name: form.company_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gstin: form.gstin || undefined,
        address: form.address || undefined,
        materials_supplied: materialsArray,
        payment_terms_days: parseInt(form.payment_terms_days, 10) || 30,
        rating: form.rating ? parseFloat(form.rating) : undefined,
        notes: form.notes || undefined,
      }

      const res = await fetch('/api/vendors', {
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('pages.vendors.form.addTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="v-name">{t('pages.vendors.form.name')}</Label>
            <Input id="v-name" required {...field('name')} />
            {fieldError('name') && (
              <p className="text-xs text-destructive">{fieldError('name')}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-company">
              {t('pages.vendors.form.companyName')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input id="v-company" {...field('company_name')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="v-phone">
                {t('pages.vendors.form.phone')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input id="v-phone" type="tel" placeholder="+91XXXXXXXXXX" {...field('phone')} />
              {fieldError('phone') && (
                <p className="text-xs text-destructive">{fieldError('phone')}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-email">
                {t('pages.vendors.form.email')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input id="v-email" type="email" {...field('email')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-gstin">
              {t('pages.vendors.form.gstin')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input id="v-gstin" placeholder="24AABCU9603R1ZX" {...field('gstin')} />
            {fieldError('gstin') && (
              <p className="text-xs text-destructive">{fieldError('gstin')}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-address">
              {t('pages.vendors.form.address')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Textarea id="v-address" rows={2} {...field('address')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-materials">
              {t('pages.vendors.form.materials')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input
              id="v-materials"
              placeholder={t('pages.vendors.form.materialsHint')}
              {...field('materials_supplied')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="v-terms">{t('pages.vendors.form.paymentTerms')}</Label>
              <Input
                id="v-terms"
                type="number"
                min="0"
                max="365"
                {...field('payment_terms_days')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-rating">
                {t('pages.vendors.form.rating')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                id="v-rating"
                type="number"
                min="0"
                max="5"
                step="0.5"
                {...field('rating')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-notes">
              {t('pages.vendors.form.notes')}{' '}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Textarea id="v-notes" rows={2} {...field('notes')} />
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
              {submitting ? t('pages.vendors.form.adding') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
