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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { DeleteButton } from '@/components/shared/delete-button'
import { paiseToCurrency } from '@/lib/utils/currency'
import { CreatePODialog } from './create-po-dialog'
import { PODetailDialog } from './po-detail-dialog'
import { Pencil, X, Plus } from 'lucide-react'

interface VendorRow {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  materials_supplied: string[] | null
  payment_terms_days: number
  rating: number
  notes: string | null
  updated_at: string
  version: number
}

interface PORow {
  id: string
  po_number: string
  material_name: string
  quantity: number
  unit: string
  total_amount_paise: number | null
  status: string
  expected_date: string | null
  created_at: string
}

interface VendorDetailData {
  vendor: VendorRow
  purchase_orders: PORow[]
  total_spend_paise: number
  purchase_orders_count: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  partially_received: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  paid: 'bg-purple-100 text-purple-700',
}

const OUTSTANDING_STATUSES = new Set(['draft', 'sent', 'acknowledged', 'in_transit', 'partially_received'])

interface VendorDetailDialogProps {
  vendorId: string | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  canDelete?: boolean
}

export function VendorDetailDialog({
  vendorId,
  onOpenChange,
  onUpdated,
  canDelete = false,
}: VendorDetailDialogProps) {
  const t = useTranslations()
  const [detail, setDetail] = useState<VendorDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState<{ vendorId: string; poId: string } | null>(null)

  const [editForm, setEditForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    materials_supplied: '',
    payment_terms_days: '',
    rating: '',
    notes: '',
  })

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendors/${id}`)
      if (!res.ok) return
      const json = await res.json()
      setDetail(json.data)
      const v = json.data.vendor as VendorRow
      setEditForm({
        name: v.name,
        company_name: v.company_name ?? '',
        phone: v.phone ?? '',
        email: v.email ?? '',
        gstin: v.gstin ?? '',
        address: v.address ?? '',
        materials_supplied: (v.materials_supplied ?? []).join(', '),
        payment_terms_days: String(v.payment_terms_days ?? 30),
        rating: v.rating ? String(v.rating) : '',
        notes: v.notes ?? '',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (vendorId) {
      setEditing(false)
      setEditError('')
      fetchDetail(vendorId)
    } else {
      setDetail(null)
    }
  }, [vendorId, fetchDetail])

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    setEditError('')
    try {
      const materialsArray = editForm.materials_supplied
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const body = {
        version: detail.vendor.version,
        name: editForm.name,
        company_name: editForm.company_name || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        gstin: editForm.gstin || null,
        address: editForm.address || null,
        materials_supplied: materialsArray,
        payment_terms_days: parseInt(editForm.payment_terms_days, 10) || 30,
        rating: editForm.rating ? parseFloat(editForm.rating) : 0,
        notes: editForm.notes || null,
      }

      const res = await fetch(`/api/vendors/${detail.vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setEditError(json.error ?? t('errors.generic'))
        return
      }

      await fetchDetail(detail.vendor.id)
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

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  }

  const open = vendorId !== null

  const outstandingPOs = detail?.purchase_orders.filter((po) =>
    OUTSTANDING_STATUSES.has(po.status)
  ).length ?? 0

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>
              {loading ? t('common.loading') : (detail?.vendor.name ?? '')}
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
              {/* Stats row */}
              <div className="flex flex-wrap gap-3">
                {outstandingPOs > 0 && (
                  <Badge variant="outline" className="border-orange-300 text-orange-600">
                    {outstandingPOs} {t('pages.vendors.detail.outstanding')}
                  </Badge>
                )}
                {detail.total_spend_paise > 0 && (
                  <Badge variant="outline" className="border-blue-300 text-blue-600">
                    {t('pages.vendors.detail.totalSpend')}: {paiseToCurrency(detail.total_spend_paise)}
                  </Badge>
                )}
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {detail.vendor.company_name && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.companyName')}</span>
                    <span className="font-medium">{detail.vendor.company_name}</span>
                  </>
                )}
                {detail.vendor.phone && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.phone')}</span>
                    <span>{detail.vendor.phone}</span>
                  </>
                )}
                {detail.vendor.email && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.email')}</span>
                    <span>{detail.vendor.email}</span>
                  </>
                )}
                {detail.vendor.gstin && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.gstin')}</span>
                    <span className="font-mono text-xs">{detail.vendor.gstin}</span>
                  </>
                )}
                {detail.vendor.address && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.address')}</span>
                    <span className="text-sm">{detail.vendor.address}</span>
                  </>
                )}
                <>
                  <span className="text-muted-foreground">{t('pages.vendors.form.paymentTerms')}</span>
                  <span>
                    {detail.vendor.payment_terms_days} {t('pages.vendors.detail.days')}
                  </span>
                </>
                {detail.vendor.rating > 0 && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.rating')}</span>
                    <span>{'★'.repeat(Math.round(detail.vendor.rating))} ({detail.vendor.rating}/5)</span>
                  </>
                )}
                {(detail.vendor.materials_supplied ?? []).length > 0 && (
                  <>
                    <span className="text-muted-foreground">{t('pages.vendors.form.materials')}</span>
                    <div className="flex flex-wrap gap-1">
                      {(detail.vendor.materials_supplied ?? []).map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {detail.vendor.notes && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {detail.vendor.notes}
                </div>
              )}

              {/* Purchase orders section */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t('pages.vendors.detail.purchaseOrders')}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setCreatePOOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('pages.vendors.detail.createPO')}
                  </Button>
                </div>

                {detail.purchase_orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('pages.vendors.detail.noPOs')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('pages.vendors.po.columns.poNumber')}</TableHead>
                        <TableHead className="text-xs">{t('pages.vendors.po.columns.material')}</TableHead>
                        <TableHead className="text-xs">{t('pages.vendors.po.columns.status')}</TableHead>
                        <TableHead className="text-right text-xs">{t('pages.vendors.po.columns.amount')}</TableHead>
                        <TableHead className="text-xs">{t('pages.vendors.po.columns.expectedDate')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.purchase_orders.map((po) => (
                        <TableRow
                          key={po.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setSelectedPO({ vendorId: detail.vendor.id, poId: po.id })
                          }
                        >
                          <TableCell className="py-2 font-mono text-xs">{po.po_number}</TableCell>
                          <TableCell className="py-2 text-xs">{po.material_name}</TableCell>
                          <TableCell className="py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {po.status.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs">
                            {po.total_amount_paise !== null
                              ? paiseToCurrency(po.total_amount_paise)
                              : '—'}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {formatDate(po.expected_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Danger zone */}
              {canDelete && (
                <div className="flex justify-end border-t pt-4">
                  <DeleteButton
                    endpoint={`/api/vendors/${detail.vendor.id}`}
                    table="vendors"
                    id={detail.vendor.id}
                    label={detail.vendor.name}
                    requireTypedName
                    onChange={() => {
                      onOpenChange(false)
                      onUpdated()
                    }}
                  />
                </div>
              )}
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
                <Label>{t('pages.vendors.form.name')}</Label>
                <Input required {...ef('name')} />
              </div>

              <div className="space-y-1">
                <Label>{t('pages.vendors.form.companyName')}</Label>
                <Input {...ef('company_name')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{t('pages.vendors.form.phone')}</Label>
                  <Input type="tel" {...ef('phone')} />
                </div>
                <div className="space-y-1">
                  <Label>{t('pages.vendors.form.email')}</Label>
                  <Input type="email" {...ef('email')} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('pages.vendors.form.gstin')}</Label>
                <Input placeholder="24AABCU9603R1ZX" {...ef('gstin')} />
              </div>

              <div className="space-y-1">
                <Label>{t('pages.vendors.form.address')}</Label>
                <Textarea rows={2} {...ef('address')} />
              </div>

              <div className="space-y-1">
                <Label>{t('pages.vendors.form.materials')}</Label>
                <Input placeholder={t('pages.vendors.form.materialsHint')} {...ef('materials_supplied')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{t('pages.vendors.form.paymentTerms')}</Label>
                  <Input type="number" min="0" max="365" {...ef('payment_terms_days')} />
                </div>
                <div className="space-y-1">
                  <Label>{t('pages.vendors.form.rating')}</Label>
                  <Input type="number" min="0" max="5" step="0.5" {...ef('rating')} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('pages.vendors.form.notes')}</Label>
                <Textarea rows={2} {...ef('notes')} />
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
                  {saving ? t('pages.vendors.form.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create PO sub-dialog */}
      {detail && (
        <CreatePODialog
          open={createPOOpen}
          onOpenChange={setCreatePOOpen}
          vendorId={detail.vendor.id}
          onSuccess={() => {
            fetchDetail(detail.vendor.id)
            onUpdated()
          }}
        />
      )}

      {/* PO detail sub-dialog */}
      <PODetailDialog
        vendorId={selectedPO?.vendorId ?? null}
        poId={selectedPO?.poId ?? null}
        onOpenChange={(v) => !v && setSelectedPO(null)}
        onUpdated={() => {
          if (detail) fetchDetail(detail.vendor.id)
          onUpdated()
        }}
      />
    </>
  )
}
