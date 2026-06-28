import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { adminClient } from '@/lib/supabase/admin'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatIST } from '@/lib/utils/date'
import type { Database } from '@/types/database'
import { getAdminMetrics, type TierBreakdown } from './_data'
import { OverviewClient } from './_components/overview-client'

type AuditRow = Pick<
  Database['public']['Tables']['audit_log']['Row'],
  'id' | 'table_name' | 'record_id' | 'action' | 'changed_by_source' | 'organization_id' | 'created_at'
>

// Avoid caching cross-org operational metrics — platform admins need live numbers.
export const dynamic = 'force-dynamic'

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

export default async function AdminPage() {
  const t = await getTranslations('admin')

  const [metrics, auditRes] = await Promise.all([
    getAdminMetrics(),
    adminClient
      .from('audit_log')
      .select('id, table_name, record_id, action, changed_by_source, organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const recentAudit = (auditRes.data ?? []) as unknown as AuditRow[]
  const { totals, systemHealth, revenue, customers } = metrics
  const sentryUrl = process.env.SENTRY_DASHBOARD_URL || 'https://sentry.io'

  const statCard = (label: string, value: string) => (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  )

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{t('home.title')}</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCard(t('home.totalOrgs'), String(totals.orgs))}
        {statCard(t('home.totalUsers'), String(totals.users))}
        {statCard(t('revenue.mrr'), paiseToCurrency(revenue.mrrPaise))}
        <Link
          href="/admin/recovery"
          className="rounded-lg border border-amber-500/40 bg-zinc-900 p-5 transition-colors hover:bg-zinc-800"
        >
          <p className="text-xs uppercase tracking-wide text-amber-400">{t('home.recoveryCard')}</p>
          <p className="mt-1 text-sm text-zinc-300">{t('home.recoveryCardHint')}</p>
        </Link>
      </div>

      {/* Revenue */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('revenue.title')}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t('revenue.mrr')}</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {paiseToCurrency(revenue.mrrPaise)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{t('revenue.mrrHint')}</p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 lg:col-span-1">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-400">{t('revenue.byTier')}</p>
            <TierTable rows={revenue.byTier} />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t('revenue.churn')}</p>
            <p className="mt-1 text-3xl font-bold text-rose-400">{revenue.churnThisMonth}</p>
            <p className="mt-1 text-xs text-zinc-500">{t('revenue.churnHint')}</p>
            {revenue.churnedOrgNames.length > 0 && (
              <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                {revenue.churnedOrgNames.join(', ')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* System health */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('health.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCard(t('health.whatsappToday'), String(systemHealth.whatsappMessagesToday))}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t('health.aiToday')}</p>
            <p className="mt-1 text-3xl font-bold">{systemHealth.ai.callsToday}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {t('health.aiCallsHint', {
                latency: systemHealth.ai.avgLatencyMs,
                error: (systemHealth.ai.errorRate * 100).toFixed(1),
              })}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t('health.activeSubs')}</p>
            <p className="mt-1 text-3xl font-bold">
              {systemHealth.activeByTier.reduce((s, r) => s + r.activeSubscriptions, 0)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {systemHealth.activeByTier
                .map((r) => `${tierLabel(r.tier)}: ${r.activeSubscriptions}`)
                .join('  ')}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t('health.apiUsage')}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              ${systemHealth.ai.totalCostUsd.toFixed(2)}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
              {systemHealth.ai.byProvider.length === 0 ? (
                <p>{t('health.apiUsageNone')}</p>
              ) : (
                systemHealth.ai.byProvider.map((p) => (
                  <p key={p.provider}>
                    {p.provider}: {p.totalTokens.toLocaleString('en-IN')} tok · $
                    {p.estCostUsd.toFixed(2)}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t('health.costNote')}</p>
      </section>

      {/* Customer overview */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('overview.title')}</h2>
          <a
            href={sentryUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            {t('overview.openSentry')} ↗
          </a>
        </div>
        <OverviewClient rows={customers} />
      </section>

      {/* Recent audit log */}
      <section>
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
      </section>
    </div>
  )
}

function TierTable({ rows }: { rows: TierBreakdown[] }) {
  return (
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-zinc-800">
        {rows.map((r) => (
          <tr key={r.tier} className="text-zinc-300">
            <td className="py-1.5">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{tierLabel(r.tier)}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums text-zinc-400">{r.activeSubscriptions}×</td>
            <td className="py-1.5 text-right tabular-nums text-emerald-400">
              {paiseToCurrency(r.mrrPaise)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
