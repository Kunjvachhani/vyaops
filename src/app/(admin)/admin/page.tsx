import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { adminClient } from '@/lib/supabase/admin'
import { formatIST } from '@/lib/utils/date'
import type { Database } from '@/types/database'

type AuditRow = Pick<
  Database['public']['Tables']['audit_log']['Row'],
  'id' | 'table_name' | 'record_id' | 'action' | 'changed_by_source' | 'organization_id' | 'created_at'
>

export default async function AdminPage() {
  const t = await getTranslations('admin')

  const [orgsCount, usersCount, auditRes] = await Promise.all([
    adminClient.from('organizations').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    adminClient.from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    adminClient
      .from('audit_log')
      .select('id, table_name, record_id, action, changed_by_source, organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const recentAudit = (auditRes.data ?? []) as unknown as AuditRow[]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('home.title')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{t('home.totalOrgs')}</p>
          <p className="mt-1 text-3xl font-bold">{orgsCount.count ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{t('home.totalUsers')}</p>
          <p className="mt-1 text-3xl font-bold">{usersCount.count ?? 0}</p>
        </div>
        <Link
          href="/admin/recovery"
          className="rounded-lg border border-amber-500/40 bg-zinc-900 p-5 transition-colors hover:bg-zinc-800"
        >
          <p className="text-xs uppercase tracking-wide text-amber-400">{t('home.recoveryCard')}</p>
          <p className="mt-1 text-sm text-zinc-300">{t('home.recoveryCardHint')}</p>
        </Link>
      </div>

      {/* Recent audit log */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('home.recentAudit')}</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-2">{t('home.col.time')}</th>
                <th className="px-3 py-2">{t('home.col.action')}</th>
                <th className="px-3 py-2">{t('home.col.table')}</th>
                <th className="px-3 py-2">{t('home.col.source')}</th>
                <th className="px-3 py-2">{t('home.col.org')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {recentAudit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    {t('home.noAudit')}
                  </td>
                </tr>
              ) : (
                recentAudit.map((row) => (
                  <tr key={row.id} className="text-zinc-300">
                    <td className="px-3 py-2 text-zinc-400">{formatIST(new Date(row.created_at))}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.table_name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.changed_by_source === 'platform_admin'
                            ? 'rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300'
                            : 'text-xs text-zinc-400'
                        }
                      >
                        {row.changed_by_source}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.organization_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
