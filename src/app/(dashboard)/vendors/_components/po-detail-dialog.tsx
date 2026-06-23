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
import { paiseToCurrency } from '@/lib/utils/currency'
import { FileDown, CheckCircle } from 'lucide-react'

interface PORow {
  id: string
  vendor_id: string
  po_number: string
  material_name: string
  quantity: number
  unit: string
  unit_price_paise: number | null
  total_amount_paise: number | null
  status: string
  quality_status: string
  received_quantity: number
  received_date: string | null
  expected_date: string | null
  notes: string | null
  created_at: string
  version: number
}

const OUTSTANDING_STATUSES = new Set(['draft', 'sent', 'acknowledged', 'in_transit', 'partially_received'])

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

const QUALITY_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

interface PODetailDialogProps {
  vendorId: string | null
  poId: string | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function PODetailDialog({ vendorId, poId, onOpenChange, onUpdated }: PODetailDialogProps) {
  const t = useTranslations()
  const [po, setPO] = useState<PORow | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMarkReceived, setShowMarkReceived] = useState(false)
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState('')
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [receivedQty, setReceivedQty] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [qualityStatus, setQualityStatus] = useState('approved')

  const fetchPO = useCallback(async (vid: string, pid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendors/${vid}/purchase-orders/${pid}`)
      if (!res.ok) return
      const json = await res.json()
      const row = json.data as PORow
      setPO(row)
      setReceivedQty(String(row.quantity))
      setReceivedDate(new Date().toISOString().split('T')[0])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (vendorId && poId) {
      setShowMarkReceived(false)
      setMarkError('')
      fetchPO(vendorId, poId)
    } else {
      setPO(null)
    }
  }, [vendorId, poId, fetchPO])

  async function handleMarkReceived() {
    if (!po || !vendorId) return
    setMarking(true)
    setMarkError('')
    try {
      const body = {
        version: po.version,
        status: parseFloat(receivedQty) >= po.quantity ? 'received' : 'partially_received',
        received_quantity: parseFloat(receivedQty),
        received_date: receivedDate || new Date().toISOString().split('T')[0],
        quality_status: qualityStatus,
      }

      const res = await fetch(`/api/vendors/${vendorId}/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setMarkError(json.error ?? t('errors.generic'))
        return
      }

      await fetchPO(vendorId, po.id)
      setShowMarkReceived(false)
      onUpdated()
    } finally {
      setMarking(false)
    }
  }

  async function handleDownloadPDF() {
    if (!po || !vendorId) return
    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/vendors/${vendorId}/purchase-orders/${po.id}/pdf`, {
        method: 'POST',
      })
      if (!res.ok) return

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${po.po_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPDF(false)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const open = vendorId !== null && poId !== null
  const canMarkReceived = po !== null && OUTSTANDING_STATUSES.has(po.status)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {loading
              ? t('common.loading')
              : po
              ? `${t('pages.vendors.po.detail.title')} — ${po.po_number}`
              : t('pages.vendors.po.detail.title')}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        )}

        {!loading && po && (
          <div className="space-y-5">
            {/* Status row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {po.status.replace(/_/g, ' ')}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  QUALITY_COLORS[po.quality_status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                QC: {po.quality_status}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <span className="text-muted-foreground">{t('pages.vendors.po.detail.poNumber')}</span>
              <span className="font-mono text-xs font-medium">{po.po_number}</span>

              <span className="text-muted-foreground">{t('pages.vendors.po.detail.poDate')}</span>
              <span>{formatDate(po.created_at)}</span>

              <span className="text-muted-foreground">{t('pages.vendors.po.detail.expectedDate')}</span>
              <span>{formatDate(po.expected_date)}</span>

              <span className="text-muted-foreground">{t('pages.vendors.po.detail.material')}</span>
              <span className="font-medium">{po.material_name}</span>

              <span className="text-muted-foreground">{t('pages.vendors.po.detail.quantity')}</span>
              <span>
                {po.quantity} {po.unit}
              </span>

              {po.unit_price_paise !== null && (
                <>
                  <span className="text-muted-foreground">{t('pages.vendors.po.detail.unitPrice')}</span>
                  <span>{paiseToCurrency(po.unit_price_paise)}</span>
                </>
              )}

              {po.total_amount_paise !== null && (
                <>
                  <span className="text-muted-foreground">{t('pages.vendors.po.detail.totalAmount')}</span>
                  <span className="font-semibold">{paiseToCurrency(po.total_amount_paise)}</span>
                </>
              )}

              {po.received_quantity > 0 && (
                <>
                  <span className="text-muted-foreground">{t('pages.vendors.po.detail.receivedQty')}</span>
                  <span>
                    {po.received_quantity} {po.unit}
                  </span>
                </>
              )}

              {po.received_date && (
                <>
                  <span className="text-muted-foreground">{t('pages.vendors.po.detail.receivedDate')}</span>
                  <span>{formatDate(po.received_date)}</span>
                </>
              )}
            </div>

            {po.notes && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t('pages.vendors.po.detail.notes')}: </span>
                {po.notes}
              </div>
            )}

            {/* Mark received form */}
            {showMarkReceived && (
              <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">
                  {t('pages.vendors.po.detail.markTitle')}
                </p>

                {markError && (
                  <p className="text-xs text-destructive">{markError}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('pages.vendors.po.detail.receivedQty')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={receivedQty}
                      onChange={(e) => setReceivedQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('pages.vendors.po.detail.receivedDate')}</Label>
                    <Input
                      type="date"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('pages.vendors.po.detail.qualityStatus')}</Label>
                  <div className="flex gap-2">
                    {(['pending', 'approved', 'rejected'] as const).map((qs) => (
                      <button
                        key={qs}
                        type="button"
                        onClick={() => setQualityStatus(qs)}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                          qualityStatus === qs
                            ? QUALITY_COLORS[qs]
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {qs}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowMarkReceived(false)
                      setMarkError('')
                    }}
                    disabled={marking}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={handleMarkReceived} disabled={marking}>
                    {marking
                      ? t('pages.vendors.po.detail.markingReceived')
                      : t('pages.vendors.po.detail.confirm')}
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {canMarkReceived && !showMarkReceived && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => setShowMarkReceived(true)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('pages.vendors.po.detail.markReceived')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
              >
                <FileDown className="h-3.5 w-3.5" />
                {downloadingPDF ? 'Generating...' : t('pages.vendors.po.detail.downloadPDF')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
