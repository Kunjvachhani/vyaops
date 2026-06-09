'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { paiseToCurrency } from '@/lib/utils/currency'
import { Pencil, X } from 'lucide-react'

type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'completed'
  | 'dispatched'
  | 'cancelled'

interface OrderRecord {
  id: string
  order_number: string
  status: OrderStatus
  total_amount_paise: number
  created_at: string
  products: { id: string; name: string } | null
}

interface CustomerDetail {
  customer: {
    id: string
    name: string
    company_name: string | null
    phone: string | null
    email: string | null
    city: string | null
    state: string
    gstin: string | null
    aliases: string[]
    credit_limit_paise: number
    payment_terms_days: number
    notes: string | null
    updated_at: string
  }
  orders: OrderRecord[]
  outstanding_amount_paise: number
  orders_count: number
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  dispatched: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

interface CustomerDetailDialogProps {
  customerId: string | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function CustomerDetailDialog({
  customerId,
  onOpenChange,
  onUpdated,
}: CustomerDetailDialogProps) {
  const t = useTranslations()
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [editForm, setEditForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    gstin: '',
    aliases: '',
    credit_limit_rupees: '',
    payment_terms_days: '',
    notes: '',
  })

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${id}`)
      if (!res.ok) return
      const json = await res.json()
      setDetail(json.data)
      const c = json.data.customer
      setEditForm({
        name: c.name,
        company_name: c.company_name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        city: c.city ?? '',
        state: c.state ?? 'Gujarat',
        gstin: c.gstin ?? '',
        aliases: (c.aliases ?? []).join(', '),
        credit_limit_rupees: c.credit_limit_paise ? String(c.credit_limit_paise / 100) : '',
        payment_terms_days: String(c.payment_terms_days ?? 30),
        notes: c.notes ?? '',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (customerId) {
      setEditing(false)
      setEditError('')
      fetchDetail(customerId)
    } else {
      setDetail(null)
    }
  }, [customerId, fetchDetail])

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    setEditError('')
    try {
      const aliasArray = editForm.aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const creditLimitPaise = editForm.credit_limit_rupees
        ? Math.round(parseFloat(editForm.credit_limit_rupees) * 100)
        : 0

      const body = {
        updated_at: detail.customer.updated_at,
        name: editForm.name,
        company_name: editForm.company_name || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        city: editForm.city || null,
        state: editForm.state || 'Gujarat',
        gstin: editForm.gstin || null,
        aliases: aliasArray,
        credit_limit_paise: isNaN(creditLimitPaise) ? 0 : creditLimitPaise,
        payment_terms_days: parseInt(editForm.payment_terms_days, 10) || 30,
        notes: editForm.notes || null,
      }

      const res = await fetch(`/api/customers/${detail.customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setEditError(json.error ?? t('errors.generic'))
        return
      }

      await fetchDetail(detail.customer.id)
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  function ef(key: keyof typeof editForm) {
    return {
      value: editForm[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setEditForm((prev) => ({ ...prev, [key]: e.target.value })),
    }
  }

  const open = customerId !== null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle>
            {loading ? t('common.loading') : (detail?.customer.name ?? '')}
          </DialogTitle>
          {!loading && detail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing((e) => !e)
                setEditError('')
              }}
              className="h-8 gap-1 text-sm"
            >
              {editing ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  {t('common.cancel')}
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('common.edit')}
                </>
              )}
            </Button>
          )}
        </DialogHeader>

        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        )}

        {!loading && detail && !editing && (
          <div className="space-y-6">
            {/* Info card */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {detail.customer.company_name && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.companyName')}</span>
                  <span className="font-medium">{detail.customer.company_name}</span>
                </>
              )}
              {detail.customer.phone && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.phone')}</span>
                  <span>{detail.customer.phone}</span>
                </>
              )}
              {detail.customer.email && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.email')}</span>
                  <span>{detail.customer.email}</span>
                </>
              )}
              {(detail.customer.city || detail.customer.state) && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.columns.city')}</span>
                  <span>
                    {[detail.customer.city, detail.customer.state].filter(Boolean).join(', ')}
                  </span>
                </>
              )}
              {detail.customer.gstin && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.gstin')}</span>
                  <span className="font-mono text-xs">{detail.customer.gstin}</span>
                </>
              )}
              <>
                <span className="text-muted-foreground">{t('pages.customers.form.paymentTerms')}</span>
                <span>{detail.customer.payment_terms_days} days</span>
              </>
              {detail.customer.credit_limit_paise > 0 && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.creditLimit')}</span>
                  <span>{paiseToCurrency(detail.customer.credit_limit_paise)}</span>
                </>
              )}
              {detail.customer.aliases.length > 0 && (
                <>
                  <span className="text-muted-foreground">{t('pages.customers.form.aliases')}</span>
                  <div className="flex flex-wrap gap-1">
                    {detail.customer.aliases.map((a) => (
                      <Badge key={a} variant="secondary" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Outstanding */}
            {detail.outstanding_amount_paise > 0 && (
              <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                <span className="text-orange-700">
                  {t('pages.customers.detail.outstanding')}:{' '}
                  <strong>{paiseToCurrency(detail.outstanding_amount_paise)}</strong>
                </span>
              </div>
            )}

            {/* Recent orders */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t('pages.customers.detail.recentOrders')}</h3>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('pages.customers.detail.noOrders')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('pages.customers.detail.orderNumber')}</TableHead>
                      <TableHead className="text-xs">{t('pages.customers.detail.product')}</TableHead>
                      <TableHead className="text-xs">{t('pages.customers.detail.status')}</TableHead>
                      <TableHead className="text-right text-xs">{t('pages.customers.detail.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="py-2 text-xs font-mono">{order.order_number}</TableCell>
                        <TableCell className="py-2 text-xs">{order.products?.name ?? '—'}</TableCell>
                        <TableCell className="py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[order.status] ?? ''
                            }`}
                          >
                            {order.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs">
                          {paiseToCurrency(order.total_amount_paise)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {!loading && detail && editing && (
          <div className="space-y-4 pt-1">
            {editError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {editError}
              </p>
            )}

            <div className="space-y-1">
              <Label>{t('pages.customers.form.name')}</Label>
              <Input required {...ef('name')} />
            </div>

            <div className="space-y-1">
              <Label>{t('pages.customers.form.companyName')}</Label>
              <Input {...ef('company_name')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('pages.customers.form.phone')}</Label>
                <Input type="tel" {...ef('phone')} />
              </div>
              <div className="space-y-1">
                <Label>{t('pages.customers.form.email')}</Label>
                <Input type="email" {...ef('email')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('pages.customers.form.city')}</Label>
                <Input {...ef('city')} />
              </div>
              <div className="space-y-1">
                <Label>{t('pages.customers.form.state')}</Label>
                <Input {...ef('state')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('pages.customers.form.gstin')}</Label>
                <Input placeholder="24AABCU9603R1ZX" {...ef('gstin')} />
              </div>
              <div className="space-y-1">
                <Label>{t('pages.customers.form.aliases')}</Label>
                <Input placeholder="Alias1, Alias2" {...ef('aliases')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('pages.customers.form.creditLimit')}</Label>
                <Input type="number" min="0" step="1" {...ef('credit_limit_rupees')} />
              </div>
              <div className="space-y-1">
                <Label>{t('pages.customers.form.paymentTerms')}</Label>
                <Input type="number" min="0" max="365" {...ef('payment_terms_days')} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t('pages.customers.form.notes')}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={2}
                {...ef('notes')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false)
                  setEditError('')
                }}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('pages.customers.form.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
