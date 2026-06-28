'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatISTDate, formatIST } from '@/lib/utils/date'
import type { CustomerRow } from '../_data'

type SortKey = 'name' | 'ownerName' | 'tier' | 'createdAt' | 'lastActive' | 'ordersCount' | 'savedPaise'
type SortDir = 'asc' | 'desc'

const TIER_OPTIONS = ['tier_1', 'tier_2', 'tier_3'] as const

function tierLabel(tier: string): string {
  switch (tier) {
    case 'tier_1':
      return 'T1'
    case 'tier_2':
      return 'T2'
    case 'tier_3':
      return 'T3'
    default:
      return tier
  }
}

export function OverviewClient({ rows }: { rows: CustomerRow[] }) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? rows.filter(
          (r) => r.name.toLowerCase().includes(q) || r.ownerName.toLowerCase().includes(q)
        )
      : rows

    const sorted = [...base].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'ordersCount':
        case 'savedPaise':
          cmp = a[sortKey] - b[sortKey]
          break
        case 'lastActive': {
          const av = a.lastActive ?? ''
          const bv = b.lastActive ?? ''
          cmp = av < bv ? -1 : av > bv ? 1 : 0
          break
        }
        default: {
          const av = String(a[sortKey] ?? '')
          const bv = String(b[sortKey] ?? '')
          cmp = av.localeCompare(bv)
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'createdAt' || key === 'lastActive' ? 'desc' : 'asc')
    }
  }

  async function changeTier(orgId: string, tier: string) {
    setSavingOrgId(orgId)
    try {
      const res = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, tier }),
      })
      if (!res.ok) {
        toast.error(t('overview.tierChangeFailed'))
        return
      }
      toast.success(t('overview.tierChanged'))
      startTransition(() => router.refresh())
    } catch {
      toast.error(t('overview.tierChangeFailed'))
    } finally {
      setSavingOrgId(null)
    }
  }

  const headers: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: 'name', label: t('overview.col.org') },
    { key: 'ownerName', label: t('overview.col.owner') },
    { key: 'tier', label: t('overview.col.tier') },
    { key: 'createdAt', label: t('overview.col.created') },
    { key: 'lastActive', label: t('overview.col.lastActive') },
    { key: 'ordersCount', label: t('overview.col.orders'), numeric: true },
    { key: 'savedPaise', label: t('overview.col.saved'), numeric: true },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('overview.searchPlaceholder')}
          className="w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <span className="shrink-0 text-xs text-zinc-500">
          {t('overview.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`px-3 py-2 ${h.numeric ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(h.key)}
                    className="inline-flex items-center gap-1 hover:text-zinc-100"
                  >
                    {h.label}
                    {sortKey === h.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right">{t('overview.col.setTier')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="px-3 py-6 text-center text-zinc-500">
                  {t('overview.empty')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.orgId} className="text-zinc-300">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/admin/orgs/${r.orgId}`}
                      className="text-zinc-100 hover:text-amber-300 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.ownerName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      {tierLabel(r.tier)}
                    </span>
                    {r.tierSource === 'comp' && (
                      <span
                        className="ml-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-xs text-sky-300"
                        title={t('overview.compHint')}
                      >
                        {t('overview.comp')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{formatISTDate(new Date(r.createdAt))}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.lastActive ? formatIST(new Date(r.lastActive)) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.ordersCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-400">
                    {paiseToCurrency(r.savedPaise)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <select
                      value={r.tier}
                      disabled={savingOrgId === r.orgId || isPending}
                      onChange={(e) => {
                        if (e.target.value !== r.tier) changeTier(r.orgId, e.target.value)
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-40"
                    >
                      {TIER_OPTIONS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tierLabel(tier)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">{t('overview.savedNote')}</p>
    </div>
  )
}
