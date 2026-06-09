'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Check } from 'lucide-react'

interface CustomerOption {
  id: string
  name: string
  company_name: string | null
}

interface ProductOption {
  id: string
  name: string
  unit: string
  unit_price_paise: number
  code: string | null
}

interface NewOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
  const t = useTranslations('pages.orders')
  const tc = useTranslations('common')

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Step 2: product + quantity
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [unitPriceRupees, setUnitPriceRupees] = useState('')

  // Step 3: notes + delivery date
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')

  const customerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCustomers = useCallback(async (q: string) => {
    setLoadingCustomers(true)
    try {
      const params = new URLSearchParams({ limit: '20', sort_by: 'name', sort_dir: 'asc' })
      if (q) params.set('search', q)
      const res = await fetch(`/api/customers?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setCustomers(json.data ?? [])
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  const fetchProducts = useCallback(async (q: string) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (q) params.set('search', q)
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setProducts(json.data ?? [])
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  // Load customers when dialog opens or search changes
  useEffect(() => {
    if (!open || step !== 1) return
    if (customerTimerRef.current) clearTimeout(customerTimerRef.current)
    customerTimerRef.current = setTimeout(() => fetchCustomers(customerSearch), customerSearch ? 300 : 0)
    return () => { if (customerTimerRef.current) clearTimeout(customerTimerRef.current) }
  }, [open, step, customerSearch, fetchCustomers])

  // Load products when entering step 2 or search changes
  useEffect(() => {
    if (step !== 2) return
    if (productTimerRef.current) clearTimeout(productTimerRef.current)
    productTimerRef.current = setTimeout(() => fetchProducts(productSearch), productSearch ? 300 : 0)
    return () => { if (productTimerRef.current) clearTimeout(productTimerRef.current) }
  }, [step, productSearch, fetchProducts])

  function reset() {
    setStep(1)
    setError('')
    setCustomerSearch('')
    setSelectedCustomer(null)
    setProductSearch('')
    setSelectedProduct(null)
    setQuantity('1')
    setUnitPriceRupees('')
    setDeliveryDate('')
    setNotes('')
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  const qty = parseInt(quantity, 10)
  const pricePaise = Math.round(parseFloat(unitPriceRupees || '0') * 100)
  const totalPaise = !isNaN(qty) && !isNaN(pricePaise) && qty > 0 && pricePaise > 0
    ? qty * pricePaise
    : 0

  const step2Valid = !!selectedProduct && qty > 0 && pricePaise > 0

  async function handleSubmit() {
    if (!selectedCustomer || !selectedProduct) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          product_id: selectedProduct.id,
          quantity: qty,
          unit_price_paise: pricePaise,
          delivery_date: deliveryDate || undefined,
          notes: notes.trim() || undefined,
          status: 'confirmed',
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError((json.error as string | undefined) ?? tc('error'))
        return
      }
      reset()
      onOpenChange(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const stepTitles = [
    t('newOrderDialog.step1Title'),
    t('newOrderDialog.step2Title'),
    t('newOrderDialog.step3Title'),
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t('newOrderDialog.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {stepTitles[step - 1]}{' '}
            <span className="text-xs">
              ({t('newOrderDialog.step', { step })})
            </span>
          </p>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
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

        {/* ── Step 1: Select customer ── */}
        {step === 1 && (
          <div className="space-y-3">
            <Input
              placeholder={t('newOrderDialog.searchCustomer')}
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {loadingCustomers ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{tc('loading')}</p>
              ) : customers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('newOrderDialog.noCustomers')}
                </p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`flex w-full min-h-[44px] items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                      selectedCustomer?.id === c.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <div>
                      <span className="font-medium">{c.name}</span>
                      {c.company_name && (
                        <span className="ml-2 text-xs text-muted-foreground">{c.company_name}</span>
                      )}
                    </div>
                    {selectedCustomer?.id === c.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Select product + quantity ── */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              placeholder={t('newOrderDialog.searchProduct')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {loadingProducts ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{tc('loading')}</p>
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('newOrderDialog.noProducts')}
                </p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full min-h-[44px] items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                      selectedProduct?.id === p.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      setSelectedProduct(p)
                      setUnitPriceRupees(String(p.unit_price_paise / 100))
                    }}
                  >
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.code && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{p.code}</span>
                      )}
                      <span className="ml-1.5 text-xs text-muted-foreground">({p.unit})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {paiseToCurrency(p.unit_price_paise)}
                      </span>
                      {selectedProduct?.id === p.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedProduct && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="od-qty">
                      {t('newOrderDialog.quantity')} ({selectedProduct.unit})
                    </Label>
                    <Input
                      id="od-qty"
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="od-price">{t('newOrderDialog.unitPrice')}</Label>
                    <Input
                      id="od-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={unitPriceRupees}
                      onChange={(e) => setUnitPriceRupees(e.target.value)}
                    />
                  </div>
                </div>
                {totalPaise > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{t('newOrderDialog.lineTotal')}</span>
                    <span className="font-semibold">{paiseToCurrency(totalPaise)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Review & notes ── */}
        {step === 3 && selectedCustomer && selectedProduct && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 text-sm space-y-3">
              <p className="font-semibold">{t('newOrderDialog.orderSummary')}</p>
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">{t('newOrderDialog.customer')}</span>
                <span className="font-medium">{selectedCustomer.name}</span>
                <span className="text-muted-foreground">{t('newOrderDialog.product')}</span>
                <span>{selectedProduct.name}</span>
                <span className="text-muted-foreground">{t('newOrderDialog.quantity')}</span>
                <span>{qty} {selectedProduct.unit}</span>
                <span className="text-muted-foreground">{t('newOrderDialog.unitPrice')}</span>
                <span>{paiseToCurrency(pricePaise)}</span>
                <span className="text-muted-foreground font-medium">{t('newOrderDialog.lineTotal')}</span>
                <span className="font-bold text-base">{paiseToCurrency(totalPaise)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="od-ddate">
                {t('newOrderDialog.deliveryDate')}{' '}
                <span className="text-xs text-muted-foreground">({tc('optional')})</span>
              </Label>
              <Input
                id="od-ddate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="od-notes">
                {t('newOrderDialog.notes')}{' '}
                <span className="text-xs text-muted-foreground">({tc('optional')})</span>
              </Label>
              <Textarea
                id="od-notes"
                placeholder={t('newOrderDialog.notesPlaceholder')}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? handleOpenChange(false) : setStep((s) => s - 1))}
            disabled={submitting}
          >
            {step === 1 ? tc('cancel') : tc('back')}
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !selectedCustomer) ||
                (step === 2 && !step2Valid)
              }
            >
              {tc('next')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedCustomer || !selectedProduct}
            >
              {submitting ? t('newOrderDialog.creating') : t('newOrderDialog.confirmOrder')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
