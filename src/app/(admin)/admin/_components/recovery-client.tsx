'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { formatIST } from '@/lib/utils/date'

type OrgOption = { id: string; name: string }

type DeletedRecord = Record<string, unknown> & { id: string; deleted_at: string | null }

type Props = {
  orgs: OrgOption[]
  tables: string[]
}

// Best-effort human label for a soft-deleted row across heterogeneous tables.
function recordLabel(row: DeletedRecord): string {
  const candidates = ['order_number', 'invoice_number', 'name', 'company_name', 'sku', 'title']
  for (const key of candidates) {
    const val = row[key]
    if (typeof val === 'string' && val.trim()) return val
  }
  return row.id
}

export function RecoveryClient({ orgs, tables }: Props) {
  const t = useTranslations('admin')

  const [orgId, setOrgId] = useState('')
  const [table, setTable] = useState(tables[0] ?? '')
  const [records, setRecords] = useState<DeletedRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !table) return
    setLoading(true)
    setLoaded(false)
    try {
      const res = await fetch(
        `/api/admin/deleted?table=${encodeURIComponent(table)}&org_id=${encodeURIComponent(orgId)}`
      )
      if (!res.ok) {
        toast.error(t('recovery.loadFailed'))
        setRecords([])
        return
      }
      const json = await res.json()
      setRecords((json.data?.records as DeletedRecord[]) ?? [])
      setLoaded(true)
    } catch {
      toast.error(t('recovery.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [orgId, table, t])

  async function restore(id: string) {
    setRestoringId(id)
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, org_id: orgId }),
      })
      if (!res.ok) {
        toast.error(t('recovery.restoreFailed'))
        return
      }
      toast.success(t('recovery.restored'))
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error(t('recovery.restoreFailed'))
    } finally {
      setRestoringId(null)
    }
  }

  const selectClass =
    'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none'

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          {t('recovery.org')}
          <select className={selectClass} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">{t('recovery.selectOrg')}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          {t('recovery.table')}
          <select className={selectClass} value={table} onChange={(e) => setTable(e.target.value)}>
            {tables.map((tbl) => (
              <option key={tbl} value={tbl}>
                {tbl}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={load}
          disabled={!orgId || !table || loading}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {loading ? t('recovery.loading') : t('recovery.load')}
        </button>
      </div>

      {/* Results */}
      {loaded && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-2">{t('recovery.col.record')}</th>
                <th className="px-3 py-2">{t('recovery.col.id')}</th>
                <th className="px-3 py-2">{t('recovery.col.deletedAt')}</th>
                <th className="px-3 py-2 text-right">{t('recovery.col.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    {t('recovery.empty')}
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.id} className="text-zinc-300">
                    <td className="px-3 py-2 font-medium">{recordLabel(row)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.id}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {row.deleted_at ? formatIST(new Date(row.deleted_at)) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => restore(row.id)}
                        disabled={restoringId === row.id}
                        className="rounded-md border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                      >
                        {restoringId === row.id ? t('recovery.restoring') : t('recovery.restore')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
