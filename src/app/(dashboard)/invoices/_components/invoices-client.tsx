'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { captureWithContext } from '@/lib/utils/sentry'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateInvoiceDialog } from './create-invoice-dialog'
import { InvoiceDetailDialog } from './invoice-detail-dialog'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatISTDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { Search, Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react'

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'

// Filter pills (overdue is a virtual status the API translates to a date filter).
const FILTER_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
]

const STATUS_PILL_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  partially_paid: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface InvoiceListItem {
  id: string
  invoice_number: string
  status: string
  total_amount_paise: number
  paid_amount_paise: number
  due_date: string
  is_overdue: boolean
  customers: {
    id: string
    name: string
    company_name: string | null
  } | null
}

interface CustomerSuggestion {
  id: string
  name: string
  company_name: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface Summary {
  outstandingPaise: number
  overduePaise: number
  paidThisMonthPaise: number
  unpaidCount: number
}

export function InvoicesClient({ canDelete = false }: { canDelete?: boolean }) {
  const t = useTranslations('pages.invoices')
  const tc = useTranslations('common')

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<InvoiceStatus[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerSearchText, setCustomerSearchText] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  // Refs to avoid stale closures inside the debounced fetch
  const searchRef = useRef('')
  const statusesRef = useRef<InvoiceStatus[]>([])
  const customerIdRef = useRef<string | null>(null)
  const dateFromRef = useRef('')
  const dateToRef = useRef('')
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  const fetchSummary = useCallback(() => {
    fetch('/api/invoices/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data: Summary } | null) => {
        if (json) setSummary(json.data)
      })
      .catch((e: unknown) => captureWithContext(e, { action: 'invoices-client/fetch' }))
  }, [])

  const doFetch = useCallback((p: number) => {
    const params = new URLSearchParams({
      page: String(p),
      limit: '20',
      sort_by: 'due_date',
      sort_dir: 'asc',
    })
    if (searchRef.current) params.set('search', searchRef.current)
    if (statusesRef.current.length > 0) params.set('statuses', statusesRef.current.join(','))
    if (customerIdRef.current) params.set('customer_id', customerIdRef.current)
    if (dateFromRef.current) params.set('date_from', dateFromRef.current)
    if (dateToRef.current) params.set('date_to', dateToRef.current)

    setLoading(true)
    fetch(`/api/invoices?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data: InvoiceListItem[]; pagination: Pagination } | null) => {
        if (json) {
          setInvoices(json.data ?? [])
          setPagination(json.pagination)
        }
      })
      .catch((e: unknown) => captureWithContext(e, { action: 'invoices-client/fetch' }))
      .finally(() => setLoading(false))
  }, [])

  const scheduleFetch = useCallback(
    (p: number, immediate = false) => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(() => doFetch(p), immediate ? 0 : 300)
    },
    [doFetch]
  )

  useEffect(() => {
    scheduleFetch(1, true)
    fetchSummary()
  }, [scheduleFetch, fetchSummary])

  function handleSearchChange(v: string) {
    setSearch(v)
    searchRef.current = v
    setPage(1)
    scheduleFetch(1)
  }

  function toggleStatus(s: InvoiceStatus) {
    const next = statusesRef.current.includes(s)
      ? statusesRef.current.filter((x) => x !== s)
      : [...statusesRef.current, s]
    statusesRef.current = next
    setSelectedStatuses(next)
    setPage(1)
    scheduleFetch(1)
  }

  function clearAllStatuses() {
    statusesRef.current = []
    setSelectedStatuses([])
    setPage(1)
    scheduleFetch(1)
  }

  function handleCustomerSelect(c: CustomerSuggestion) {
    customerIdRef.current = c.id
    setCustomerId(c.id)
    setCustomerSearchText(c.name)
    setCustomerSuggestions([])
    setCustomerDropdownOpen(false)
    setPage(1)
    scheduleFetch(1)
  }

  function clearCustomer() {
    customerIdRef.current = null
    setCustomerId(null)
    setCustomerSearchText('')
    setCustomerSuggestions([])
    setPage(1)
    scheduleFetch(1)
  }

  function handleDateFromChange(v: string) {
    dateFromRef.current = v
    setDateFrom(v)
    setPage(1)
    scheduleFetch(1)
  }

  function handleDateToChange(v: string) {
    dateToRef.current = v
    setDateTo(v)
    setPage(1)
    scheduleFetch(1)
  }

  function handlePageChange(p: number) {
    setPage(p)
    scheduleFetch(p, true)
  }

  function refresh() {
    scheduleFetch(page, true)
    fetchSummary()
  }

  // Customer autocomplete
  useEffect(() => {
    if (!customerSearchText || customerId) {
      setCustomerSuggestions([])
      return
    }
    if (customerTimerRef.current) clearTimeout(customerTimerRef.current)
    customerTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/customers?limit=10&search=${encodeURIComponent(customerSearchText)}`)
      if (res.ok) {
        const json = await res.json()
        setCustomerSuggestions((json.data as CustomerSuggestion[]) ?? [])
        setCustomerDropdownOpen(true)
      }
    }, 300)
    return () => {
      if (customerTimerRef.current) clearTimeout(customerTimerRef.current)
    }
  }, [customerSearchText, customerId])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function exportCsv() {
    const params = new URLSearchParams()
    if (searchRef.current) params.set('search', searchRef.current)
    if (statusesRef.current.length > 0) params.set('statuses', statusesRef.current.join(','))
    if (customerIdRef.current) params.set('customer_id', customerIdRef.current)
    if (dateFromRef.current) params.set('date_from', dateFromRef.current)
    if (dateToRef.current) params.set('date_to', dateToRef.current)
    const a = document.createElement('a')
    a.href = `/api/invoices/export?${params}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Resolve the badge status: a virtual "overdue" overrides the stored status.
  function effectiveStatus(inv: InvoiceListItem): InvoiceStatus {
    if (inv.is_overdue) return 'overdue'
    return (FILTER_STATUSES.includes(inv.status as InvoiceStatus) ? inv.status : 'draft') as InvoiceStatus
  }

  function statusLabel(s: InvoiceStatus): string {
    return t(`status.${s}`)
  }

  function statusPillClass(s: InvoiceStatus): string {
    return STATUS_PILL_COLORS[s] ?? STATUS_PILL_COLORS.draft
  }

  return (
    <div className="space-y-4">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label={t('summary.outstanding')}
          value={summary ? paiseToCurrency(summary.outstandingPaise) : '—'}
          sub={summary ? t('summary.unpaidInvoices', { count: summary.unpaidCount }) : ''}
        />
        <SummaryCard
          label={t('summary.overdue')}
          value={summary ? paiseToCurrency(summary.overduePaise) : '—'}
          danger={!!summary && summary.overduePaise > 0}
        />
        <SummaryCard
          label={t('summary.paidThisMonth')}
          value={summary ? paiseToCurrency(summary.paidThisMonthPaise) : '—'}
          positive
        />
        <div className="hidden lg:block" />
      </div>

      {/* ── Row 1: Search + actions ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('exportCsv')}</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('newInvoice')}
          </Button>
        </div>
      </div>

      {/* ── Row 2: Status pills + customer filter + date range ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              selectedStatuses.length === 0
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            )}
            onClick={clearAllStatuses}
          >
            {t('allStatuses')}
          </button>
          {FILTER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                selectedStatuses.includes(s)
                  ? statusPillClass(s)
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
              onClick={() => toggleStatus(s)}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-border sm:block" />

        <div ref={customerDropdownRef} className="relative w-44">
          <Input
            className="h-7 text-xs"
            placeholder={`${t('columns.customer')}...`}
            value={customerSearchText}
            onChange={(e) => {
              setCustomerSearchText(e.target.value)
              if (!e.target.value) clearCustomer()
            }}
            onFocus={() => customerSuggestions.length > 0 && setCustomerDropdownOpen(true)}
          />
          {customerId && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none"
              onClick={clearCustomer}
            >
              ×
            </button>
          )}
          {customerDropdownOpen && customerSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md">
              <div className="max-h-48 overflow-y-auto divide-y">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full min-h-[36px] items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                    onClick={() => handleCustomerSelect(c)}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.company_name && (
                      <span className="truncate text-muted-foreground">{c.company_name}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Input
          type="date"
          className="h-7 w-36 text-xs"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          className="h-7 w-36 text-xs"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
        />
      </div>

      {/* ── Invoice list ── */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{tc('loading')}</div>
      ) : invoices.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('noInvoices')}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.invoiceNumber')}</TableHead>
                    <TableHead>{t('columns.customer')}</TableHead>
                    <TableHead className="text-right">{t('columns.amount')}</TableHead>
                    <TableHead>{t('columns.status')}</TableHead>
                    <TableHead>{t('columns.dueDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const st = effectiveStatus(inv)
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                      >
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{inv.customers?.name ?? '—'}</div>
                          {inv.customers?.company_name && (
                            <div className="text-xs text-muted-foreground">
                              {inv.customers.company_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {paiseToCurrency(inv.total_amount_paise)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-xs font-medium',
                              statusPillClass(st)
                            )}
                          >
                            {statusLabel(st)}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-sm',
                            inv.is_overdue ? 'font-medium text-red-600' : 'text-muted-foreground'
                          )}
                        >
                          {formatISTDate(new Date(inv.due_date))}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {invoices.map((inv) => {
              const st = effectiveStatus(inv)
              return (
                <Card
                  key={inv.id}
                  className="cursor-pointer active:bg-muted/50"
                  onClick={() => setSelectedInvoiceId(inv.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{inv.invoice_number}</span>
                          <span
                            className={cn(
                              'rounded-full border px-1.5 py-0.5 text-xs font-medium',
                              statusPillClass(st)
                            )}
                          >
                            {statusLabel(st)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">
                          {inv.customers?.name ?? '—'}
                        </p>
                        <p
                          className={cn(
                            'truncate text-xs',
                            inv.is_overdue ? 'font-medium text-red-600' : 'text-muted-foreground'
                          )}
                        >
                          {t('columns.dueDate')}: {formatISTDate(new Date(inv.due_date))}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">
                          {paiseToCurrency(inv.total_amount_paise)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === pagination.pages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={refresh} />

      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
        onUpdated={refresh}
        canDelete={canDelete}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  danger,
  positive,
}: {
  label: string
  value: string
  sub?: string
  danger?: boolean
  positive?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-lg font-bold tabular-nums',
            danger && 'text-red-600',
            positive && 'text-green-600'
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
