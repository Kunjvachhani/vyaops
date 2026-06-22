'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddCustomerDialog } from './add-customer-dialog'
import { CustomerDetailDialog } from './customer-detail-dialog'
import { paiseToCurrency } from '@/lib/utils/currency'
import { Search, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'

interface CustomerRow {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  city: string | null
  state: string
  outstanding_amount_paise: number
  last_order_date: string | null
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export function CustomersClient({ canDelete = false }: { canDelete?: boolean }) {
  const t = useTranslations()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCustomers = useCallback(
    async (searchQuery: string, currentPage: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: '20',
          sort_by: 'created_at',
          sort_dir: 'desc',
        })
        if (searchQuery) params.set('search', searchQuery)

        const res = await fetch(`/api/customers?${params}`)
        if (!res.ok) return
        const json = await res.json()
        setCustomers(json.data ?? [])
        setPagination(json.pagination)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      fetchCustomers(search, 1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, fetchCustomers])

  useEffect(() => {
    fetchCustomers(search, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  }

  function refresh() {
    fetchCustomers(search, page)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('pages.customers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 self-start sm:self-auto">
          <UserPlus className="h-4 w-4" />
          {t('pages.customers.addCustomer')}
        </Button>
      </div>

      {/* Desktop table / Mobile cards */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t('common.loading')}
        </div>
      ) : customers.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? t('common.noResults') : t('common.noData')}
        </div>
      ) : (
        <>
          {/* Desktop table (hidden on small screens) */}
          <div className="hidden sm:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.customers.columns.name')}</TableHead>
                    <TableHead>{t('pages.customers.columns.city')}</TableHead>
                    <TableHead>{t('pages.customers.columns.phone')}</TableHead>
                    <TableHead className="text-right">
                      {t('pages.customers.columns.outstanding')}
                    </TableHead>
                    <TableHead>{t('pages.customers.columns.lastOrder')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        {c.company_name && (
                          <div className="text-xs text-muted-foreground">{c.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.city ? `${c.city}, ${c.state}` : (c.state || '—')}
                      </TableCell>
                      <TableCell className="text-sm">{c.phone ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">
                        {c.outstanding_amount_paise > 0 ? (
                          <span className="font-medium text-orange-600">
                            {paiseToCurrency(c.outstanding_amount_paise)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(c.last_order_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {customers.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer active:bg-muted/50"
                onClick={() => setSelectedId(c.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      {c.company_name && (
                        <p className="text-xs text-muted-foreground">{c.company_name}</p>
                      )}
                      {c.phone && <p className="mt-0.5 text-sm">{c.phone}</p>}
                      {(c.city || c.state) && (
                        <p className="text-xs text-muted-foreground">
                          {[c.city, c.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {c.outstanding_amount_paise > 0 && (
                        <Badge variant="outline" className="border-orange-300 text-orange-600">
                          {paiseToCurrency(c.outstanding_amount_paise)}
                        </Badge>
                      )}
                      {c.last_order_date && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(c.last_order_date)}
                        </p>
                      )}
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
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={refresh}
      />

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customerId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onUpdated={refresh}
        canDelete={canDelete}
      />
    </div>
  )
}
