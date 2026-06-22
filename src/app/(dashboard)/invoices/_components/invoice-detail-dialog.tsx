'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatISTDate, formatIST } from '@/lib/utils/date'
import { DeleteButton } from '@/components/shared/delete-button'
import { Download, Send } from 'lucide-react'
import type { Json } from '@/types/database'

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
type PaymentMethod = 'upi' | 'bank_transfer' | 'cash' | 'cheque'

const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'bank_transfer', 'cash', 'cheque']

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

interface InvoiceDetail {
  id: string
  invoice_number: string
  status: string
  subtotal_paise: number
  tax_rate: number
  tax_amount_paise: number
  total_amount_paise: number
  paid_amount_paise: number
  due_date: string
  paid_date: string | null
  sent_via_whatsapp: boolean
  notes: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
  customers: {
    id: string
    name: string
    company_name: string | null
    phone: string | null
    gstin: string | null
  } | null
  orders: {
    id: string
    order_number: string
    quantity: number
    unit_price_paise: number
    products: { id: string; name: string; unit: string; hsn_code: string | null } | null
  } | null
}

interface PaymentRecord {
  id: string
  amount_paise: number
  payment_date: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  created_at: string
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

interface InvoiceDetailDialogProps {
  invoiceId: string | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  canDelete?: boolean
}

export function InvoiceDetailDialog({ invoiceId, onOpenChange, onUpdated, canDelete = false }: InvoiceDetailDialogProps) {
  const t = useTranslations('pages.invoices')
  const tc = useTranslations('common')

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  // Record-payment sub-dialog
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('upi')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const fetchInvoice = useCallback(async (id: string) => {
    setLoading(true)
    setActionError('')
    setNotice('')
    try {
      const [invRes, auditRes] = await Promise.all([
        fetch(`/api/invoices/${id}`),
        fetch(`/api/invoices/${id}/audit`),
      ])
      if (invRes.ok) {
        const json = await invRes.json()
        setInvoice(json.data as InvoiceDetail)
        setPayments((json.payments as PaymentRecord[]) ?? [])
      }
      if (auditRes.ok) {
        const json = await auditRes.json()
        setAudit((json.data as AuditEntry[]) ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice(invoiceId)
    } else {
      setInvoice(null)
      setPayments([])
      setAudit([])
      setActionError('')
      setNotice('')
    }
  }, [invoiceId, fetchInvoice])

  const effectiveStatus: InvoiceStatus = invoice
    ? invoice.is_overdue && invoice.status !== 'cancelled'
      ? 'overdue'
      : (invoice.status as InvoiceStatus)
    : 'draft'

  const balancePaise = invoice ? invoice.total_amount_paise - invoice.paid_amount_paise : 0
  const canPay =
    invoice && balancePaise > 0 && invoice.status !== 'cancelled' && invoice.status !== 'paid'

  async function patchInvoice(body: Record<string, unknown>): Promise<boolean> {
    if (!invoice) return false
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: invoice.updated_at, ...body }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setActionError((json?.error as string | undefined) ?? tc('error'))
        return false
      }
      await fetchInvoice(invoice.id)
      onUpdated()
      return true
    } finally {
      setBusy(false)
    }
  }

  async function markSent() {
    await patchInvoice({ status: 'sent' })
  }

  async function cancelInvoice() {
    setCancelConfirmOpen(false)
    await patchInvoice({ status: 'cancelled' })
  }

  async function downloadPdf() {
    if (!invoice) return
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setActionError((json?.error as string | undefined) ?? tc('error'))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  async function sendWhatsapp() {
    if (!invoice) return
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-whatsapp`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setActionError((json?.error as string | undefined) ?? tc('error'))
        return
      }
      setNotice(t('messages.sendSuccess'))
      await fetchInvoice(invoice.id)
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  function openPaymentDialog() {
    setPayAmount(String(balancePaise / 100))
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayMethod('upi')
    setPayRef('')
    setPayNotes('')
    setPayOpen(true)
  }

  const payAmountPaise = Math.round(parseFloat(payAmount || '0') * 100)
  const payValid = payAmountPaise > 0 && payAmountPaise <= balancePaise && !!payDate

  async function submitPayment() {
    const ok = await patchInvoice({
      payment: {
        amountPaise: payAmountPaise,
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
      },
    })
    if (ok) {
      setPayOpen(false)
      setNotice(t('messages.paymentRecorded'))
    }
  }

  const open = invoiceId !== null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {loading ? '…' : (invoice?.invoice_number ?? '')}
          </DialogTitle>
          {!loading && invoice && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[effectiveStatus]}`}
              >
                {t(`status.${effectiveStatus}`)}
              </span>
              {invoice.sent_via_whatsapp && (
                <span className="text-xs text-green-600">{t('detail.sentViaWhatsapp')}</span>
              )}
            </div>
          )}
        </DialogHeader>

        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        )}

        {!loading && invoice && (
          <div className="space-y-6 pb-2">
            {actionError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}
            {notice && (
              <p className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-700">{notice}</p>
            )}

            {/* ── Invoice info ── */}
            <div className="rounded-md border p-4">
              <p className="mb-3 text-sm font-semibold">{t('detail.invoiceInfo')}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">{t('detail.customer')}</span>
                <span className="font-medium">
                  {invoice.customers?.name ?? '—'}
                  {invoice.customers?.company_name && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {invoice.customers.company_name}
                    </span>
                  )}
                </span>

                {invoice.orders?.order_number && (
                  <>
                    <span className="text-muted-foreground">{t('detail.order')}</span>
                    <span className="font-mono text-xs">{invoice.orders.order_number}</span>
                  </>
                )}

                <span className="text-muted-foreground">{t('detail.date')}</span>
                <span>{formatISTDate(new Date(invoice.created_at))}</span>

                <span className="text-muted-foreground">{t('detail.dueDate')}</span>
                <span className={invoice.is_overdue ? 'font-medium text-red-600' : ''}>
                  {formatISTDate(new Date(invoice.due_date))}
                </span>

                {invoice.notes && (
                  <>
                    <span className="text-muted-foreground">{t('detail.notes')}</span>
                    <span className="text-xs leading-relaxed">{invoice.notes}</span>
                  </>
                )}
              </div>
            </div>

            {/* ── Line items ── */}
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
                        {invoice.orders?.products?.name ?? '—'}
                        {invoice.orders?.products?.unit && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({invoice.orders.products.unit})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {invoice.orders?.quantity ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {invoice.orders
                          ? paiseToCurrency(invoice.orders.unit_price_paise)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {paiseToCurrency(invoice.subtotal_paise)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="mt-3 flex justify-end">
                <div className="w-full max-w-[260px] space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.subtotal')}</span>
                    <span>{paiseToCurrency(invoice.subtotal_paise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('detail.tax')} ({invoice.tax_rate}%)
                    </span>
                    <span>{paiseToCurrency(invoice.tax_amount_paise)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>{t('detail.total')}</span>
                    <span>{paiseToCurrency(invoice.total_amount_paise)}</span>
                  </div>
                  {invoice.paid_amount_paise > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('detail.paid')}</span>
                      <span>− {paiseToCurrency(invoice.paid_amount_paise)}</span>
                    </div>
                  )}
                  {balancePaise > 0 && invoice.paid_amount_paise > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span>{t('detail.balance')}</span>
                      <span>{paiseToCurrency(balancePaise)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadPdf} disabled={busy}>
                <Download className="h-3.5 w-3.5" />
                {busy ? t('detail.downloading') : t('detail.downloadPdf')}
              </Button>
              {invoice.customers?.phone && invoice.status !== 'cancelled' && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={sendWhatsapp} disabled={busy}>
                  <Send className="h-3.5 w-3.5" />
                  {busy ? t('detail.sending') : t('detail.sendWhatsapp')}
                </Button>
              )}
              {canPay && (
                <Button size="sm" onClick={openPaymentDialog} disabled={busy}>
                  {t('detail.recordPayment')}
                </Button>
              )}
              {invoice.status === 'draft' && (
                <Button size="sm" variant="outline" onClick={markSent} disabled={busy}>
                  {t('detail.markSent')}
                </Button>
              )}
              {(invoice.status === 'draft' || invoice.status === 'sent') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={busy}
                >
                  {t('detail.cancelInvoice')}
                </Button>
              )}
              {/* Delete is only offered for invoices with no recorded payments
                  (the API rejects deleting paid / part-paid invoices). */}
              {canDelete && invoice.paid_amount_paise === 0 && invoice.status !== 'paid' && (
                <DeleteButton
                  endpoint={`/api/invoices/${invoice.id}`}
                  table="invoices"
                  id={invoice.id}
                  label={invoice.invoice_number}
                  onChange={() => {
                    onOpenChange(false)
                    onUpdated()
                  }}
                />
              )}
            </div>

            {/* ── Payment history ── */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('detail.paymentHistory')}</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noPayments')}</p>
              ) : (
                <div className="rounded-md border divide-y">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{paiseToCurrency(p.amount_paise)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t(`paymentDialog.methods.${p.payment_method}` as `paymentDialog.methods.${PaymentMethod}`)}
                        </span>
                        {p.reference_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t('detail.reference')}: {p.reference_number}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatISTDate(new Date(p.payment_date))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Audit trail ── */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('detail.auditTrail')}</p>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noAudit')}</p>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {audit.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize">
                            {entry.action.toLowerCase().replace('_', ' ')}
                          </span>
                          <span className="text-muted-foreground">
                            {t('detail.by')} {entry.changed_by_source}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {formatIST(new Date(entry.created_at))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Cancel-invoice confirmation dialog ── */}
        <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{t('detail.cancelInvoice')}</DialogTitle>
              <DialogDescription>
                {t('detail.cancelInvoiceHint', { number: invoice?.invoice_number ?? '' })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelConfirmOpen(false)} autoFocus>
                {tc('cancel')}
              </Button>
              <Button variant="destructive" onClick={cancelInvoice} disabled={busy}>
                {t('detail.cancelInvoice')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Record-payment sub-dialog ── */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t('paymentDialog.outstanding')}</span>
                <span className="font-semibold">{paiseToCurrency(balancePaise)}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-amount">{t('paymentDialog.amount')}</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pay-date">{t('paymentDialog.date')}</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pay-method">{t('paymentDialog.method')}</Label>
                  <select
                    id="pay-method"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`paymentDialog.methods.${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-ref">
                  {t('paymentDialog.reference')}{' '}
                  <span className="text-xs text-muted-foreground">({tc('optional')})</span>
                </Label>
                <Input
                  id="pay-ref"
                  placeholder={t('paymentDialog.referencePlaceholder')}
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-notes">
                  {t('paymentDialog.notes')}{' '}
                  <span className="text-xs text-muted-foreground">({tc('optional')})</span>
                </Label>
                <Textarea
                  id="pay-notes"
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)} disabled={busy}>
                {tc('cancel')}
              </Button>
              <Button onClick={submitPayment} disabled={busy || !payValid}>
                {busy ? t('paymentDialog.recording') : t('paymentDialog.record')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
