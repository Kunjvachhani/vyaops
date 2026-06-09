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

interface AddCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const t = useTranslations()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    city: '',
    state: 'Gujarat',
    gstin: '',
    aliases: '',
    credit_limit_rupees: '',
    payment_terms_days: '30',
    notes: '',
  })

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
      const aliasArray = form.aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const creditLimitPaise = form.credit_limit_rupees
        ? Math.round(parseFloat(form.credit_limit_rupees) * 100)
        : 0

      const body = {
        name: form.name,
        company_name: form.company_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        city: form.city || undefined,
        state: form.state || 'Gujarat',
        gstin: form.gstin || undefined,
        aliases: aliasArray,
        credit_limit_paise: isNaN(creditLimitPaise) ? 0 : creditLimitPaise,
        payment_terms_days: parseInt(form.payment_terms_days, 10) || 30,
        notes: form.notes || undefined,
      }

      const res = await fetch('/api/customers', {
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

      // Reset and close
      setForm({
        name: '',
        company_name: '',
        phone: '',
        email: '',
        city: '',
        state: 'Gujarat',
        gstin: '',
        aliases: '',
        credit_limit_rupees: '',
        payment_terms_days: '30',
        notes: '',
      })
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
          <DialogTitle>{t('pages.customers.form.addTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="c-name">{t('pages.customers.form.name')}</Label>
            <Input id="c-name" required {...field('name')} />
            {fieldError('name') && (
              <p className="text-xs text-destructive">{fieldError('name')}</p>
            )}
          </div>

          {/* Company Name */}
          <div className="space-y-1">
            <Label htmlFor="c-company">
              {t('pages.customers.form.companyName')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Input id="c-company" {...field('company_name')} />
          </div>

          {/* Phone + Email side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="c-phone">
                {t('pages.customers.form.phone')}{' '}
                <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
              </Label>
              <Input id="c-phone" type="tel" placeholder="+91XXXXXXXXXX" {...field('phone')} />
              {fieldError('phone') && (
                <p className="text-xs text-destructive">{fieldError('phone')}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-email">
                {t('pages.customers.form.email')}{' '}
                <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
              </Label>
              <Input id="c-email" type="email" {...field('email')} />
            </div>
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="c-city">
                {t('pages.customers.form.city')}{' '}
                <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
              </Label>
              <Input id="c-city" {...field('city')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-state">{t('pages.customers.form.state')}</Label>
              <Input id="c-state" {...field('state')} />
            </div>
          </div>

          {/* GSTIN */}
          <div className="space-y-1">
            <Label htmlFor="c-gstin">
              {t('pages.customers.form.gstin')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="c-gstin"
              placeholder="24AABCU9603R1ZX"
              {...field('gstin')}
            />
            {fieldError('gstin') && (
              <p className="text-xs text-destructive">{fieldError('gstin')}</p>
            )}
          </div>

          {/* Aliases */}
          <div className="space-y-1">
            <Label htmlFor="c-aliases">
              {t('pages.customers.form.aliases')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="c-aliases"
              placeholder={t('pages.customers.form.aliasesHint')}
              {...field('aliases')}
            />
          </div>

          {/* Credit Limit + Payment Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="c-credit">{t('pages.customers.form.creditLimit')}</Label>
              <Input
                id="c-credit"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                {...field('credit_limit_rupees')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-terms">{t('pages.customers.form.paymentTerms')}</Label>
              <Input
                id="c-terms"
                type="number"
                min="0"
                max="365"
                {...field('payment_terms_days')}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="c-notes">
              {t('pages.customers.form.notes')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Textarea id="c-notes" rows={2} {...field('notes')} />
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
              {submitting ? t('pages.customers.form.adding') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
