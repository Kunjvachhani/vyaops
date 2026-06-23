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
import { AddVendorDialog } from './add-vendor-dialog'
import { VendorDetailDialog } from './vendor-detail-dialog'
import { Search, Building2, ChevronLeft, ChevronRight } from 'lucide-react'

interface VendorRow {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  address: string | null
  materials_supplied: string[] | null
  payment_terms_days: number
  rating: number
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export function VendorsClient({ canDelete = false }: { canDelete?: boolean }) {
  const t = useTranslations()
  const [vendors, setVendors] = useState<VendorRow[]>([])
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

  const fetchVendors = useCallback(async (searchQuery: string, currentPage: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        sort_by: 'created_at',
        sort_dir: 'desc',
      })
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/vendors?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setVendors(json.data ?? [])
      setPagination(json.pagination)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      fetchVendors(search, 1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, fetchVendors])

  useEffect(() => {
    fetchVendors(search, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function refresh() {
    fetchVendors(search, page)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('pages.vendors.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 self-start sm:self-auto">
          <Building2 className="h-4 w-4" />
          {t('pages.vendors.addVendor')}
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t('common.loading')}
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? t('common.noResults') : t('common.noData')}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.vendors.columns.name')}</TableHead>
                    <TableHead>{t('pages.vendors.columns.address')}</TableHead>
                    <TableHead>{t('pages.vendors.columns.materials')}</TableHead>
                    <TableHead>{t('pages.vendors.columns.paymentTerms')}</TableHead>
                    <TableHead>{t('pages.vendors.columns.rating')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(v.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{v.name}</div>
                        {v.company_name && (
                          <div className="text-xs text-muted-foreground">{v.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                        {v.address ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(v.materials_supplied ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(v.materials_supplied ?? []).slice(0, 3).map((m) => (
                              <Badge key={m} variant="secondary" className="text-xs">
                                {m}
                              </Badge>
                            ))}
                            {(v.materials_supplied ?? []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(v.materials_supplied ?? []).length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.payment_terms_days} {t('pages.vendors.detail.days')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {v.rating > 0 ? (
                          <span className="text-yellow-600">
                            {'★'.repeat(Math.round(v.rating))} {v.rating}/5
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {vendors.map((v) => (
              <Card
                key={v.id}
                className="cursor-pointer active:bg-muted/50"
                onClick={() => setSelectedId(v.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{v.name}</p>
                      {v.company_name && (
                        <p className="text-xs text-muted-foreground">{v.company_name}</p>
                      )}
                      {v.phone && <p className="mt-0.5 text-sm">{v.phone}</p>}
                      {v.address && (
                        <p className="text-xs text-muted-foreground">{v.address}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {v.payment_terms_days}d terms
                      </p>
                    </div>
                  </div>
                  {(v.materials_supplied ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(v.materials_supplied ?? []).slice(0, 3).map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
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

      <AddVendorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={refresh}
      />

      <VendorDetailDialog
        vendorId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onUpdated={refresh}
        canDelete={canDelete}
      />
    </div>
  )
}
