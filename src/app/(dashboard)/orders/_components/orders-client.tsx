'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { NewOrderDialog } from './new-order-dialog'
import { OrderDetailDialog } from './order-detail-dialog'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatISTDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { Search, Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react'

type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'completed'
  | 'dispatched'
  | 'cancelled'

const ORDER_STATUSES: OrderStatus[] = [
  'draft',
  'confirmed',
  'in_production',
  'completed',
  'dispatched',
  'cancelled',
]

const STATUS_PILL_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  in_production: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  dispatched: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

interface OrderListItem {
  id: string
  order_number: string
  status: string
  quantity: number
  total_amount_paise: number
  created_at: string
  customers: {
    id: string
    name: string
    company_name: string | null
  } | null
  products: {
    id: string
    name: string
    unit: string
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

export function OrdersClient({ canDelete = false }: { canDelete?: boolean }) {
  const t = useTranslations('pages.orders')
  const tc = useTranslations('common')

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filter state
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerSearchText, setCustomerSearchText] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Dialog state
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Refs to track current filter values without stale closures
  const searchRef = useRef('')
  const statusesRef = useRef<OrderStatus[]>([])
  const customerIdRef = useRef<string | null>(null)
  const dateFromRef = useRef('')
  const dateToRef = useRef('')
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Core fetch — reads from refs so it's always using current values
  const doFetch = useCallback((p: number) => {
    const params = new URLSearchParams({
      page: String(p),
      limit: '20',
      sort_by: 'created_at',
      sort_dir: 'desc',
    })
    if (searchRef.current) params.set('search', searchRef.current)
    if (statusesRef.current.length > 0) params.set('statuses', statusesRef.current.join(','))
    if (customerIdRef.current) params.set('customer_id', customerIdRef.current)
    if (dateFromRef.current) params.set('date_from', dateFromRef.current)
    if (dateToRef.current) params.set('date_to', dateToRef.current)

    setLoading(true)
    fetch(`/api/orders?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data: OrderListItem[]; pagination: Pagination } | null) => {
        if (json) {
          setOrders(json.data ?? [])
          setPagination(json.pagination)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Schedule a debounced or immediate fetch
  const scheduleFetch = useCallback(
    (p: number, immediate = false) => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(() => doFetch(p), immediate ? 0 : 300)
    },
    [doFetch]
  )

  // Initial load
  useEffect(() => {
    scheduleFetch(1, true)
  }, [scheduleFetch])

  // Handler functions — update both state (for UI) and refs (for fetch)
  function handleSearchChange(v: string) {
    setSearch(v)
    searchRef.current = v
    setPage(1)
    scheduleFetch(1)
  }

  function toggleStatus(s: OrderStatus) {
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
  }

  // Customer autocomplete
  useEffect(() => {
    if (!customerSearchText || customerId) {
      setCustomerSuggestions([])
      return
    }
    if (customerTimerRef.current) clearTimeout(customerTimerRef.current)
    customerTimerRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/customers?limit=10&search=${encodeURIComponent(customerSearchText)}`
      )
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

  // Close customer dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // CSV export
  function exportCsv() {
    const headers = [
      t('columns.orderNumber'),
      t('columns.customer'),
      t('columns.product'),
      t('columns.qty'),
      t('columns.amount'),
      t('columns.status'),
      t('columns.date'),
    ]
    const rows = orders.map((o) => [
      o.order_number,
      o.customers?.name ?? '',
      o.products?.name ?? '',
      String(o.quantity),
      String(o.total_amount_paise / 100),
      o.status,
      formatISTDate(new Date(o.created_at)),
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function statusLabel(s: string): string {
    return ORDER_STATUSES.includes(s as OrderStatus) ? t(`status.${s}`) : s
  }

  function statusPillClass(s: string): string {
    return STATUS_PILL_COLORS[s as OrderStatus] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-4">
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
          <Button size="sm" className="gap-1.5" onClick={() => setNewOrderOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('newOrder')}
          </Button>
        </div>
      </div>

      {/* ── Row 2: Status pills + customer filter + date range ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
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
          {ORDER_STATUSES.map((s) => (
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

        {/* Customer filter autocomplete */}
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

        {/* Date range */}
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

      {/* ── Orders list ── */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{tc('loading')}</div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('noOrders')}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.orderNumber')}</TableHead>
                    <TableHead>{t('columns.customer')}</TableHead>
                    <TableHead>{t('columns.product')}</TableHead>
                    <TableHead className="text-right">{t('columns.qty')}</TableHead>
                    <TableHead className="text-right">{t('columns.amount')}</TableHead>
                    <TableHead>{t('columns.status')}</TableHead>
                    <TableHead>{t('columns.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{o.customers?.name ?? '—'}</div>
                        {o.customers?.company_name && (
                          <div className="text-xs text-muted-foreground">
                            {o.customers.company_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{o.products?.name ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{o.quantity}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {paiseToCurrency(o.total_amount_paise)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            statusPillClass(o.status)
                          )}
                        >
                          {statusLabel(o.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatISTDate(new Date(o.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {orders.map((o) => (
              <Card
                key={o.id}
                className="cursor-pointer active:bg-muted/50"
                onClick={() => setSelectedOrderId(o.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-xs font-medium',
                            statusPillClass(o.status)
                          )}
                        >
                          {statusLabel(o.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {o.customers?.name ?? '—'}
                      </p>
                      {o.products?.name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {o.products.name} × {o.quantity} {o.products.unit}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {paiseToCurrency(o.total_amount_paise)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatISTDate(new Date(o.created_at))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total}
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

      <NewOrderDialog
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        onSuccess={refresh}
      />

      <OrderDetailDialog
        orderId={selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        onUpdated={refresh}
        canDelete={canDelete}
      />
    </div>
  )
}
