import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { adminClient } from '@/lib/supabase/admin'
import { paiseToCurrency } from '@/lib/utils/currency'
import { formatIST, formatISTDate } from '@/lib/utils/date'
import type { Database } from '@/types/database'

// Read-only cross-org drill-down for platform admins. Deliberately NOT session
// impersonation — every read uses the service-role client server-side, so there is no
// token juggling and no RLS bypass on the tenant's own session. Gated by the (admin)
// layout's getPlatformAdmin() check.
export const dynamic = 'force-dynamic'

type OrgRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'full_name' | 'role' | 'email' | 'last_login_at'
>
type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_number' | 'status' | 'total_amount_paise' | 'created_at'
>
type InvoiceRow = Pick<
  Database['public']['Tables']['invoices']['Row'],
  'id' | 'invoice_number' | 'status' | 'total_amount_paise' | 'created_at'
>
type BillingEventRow = Pick<
  Database['public']['Tables']['billing_events']['Row'],
  'id' | 'event_type' | 'created_at' | 'processed'
>

function tierLabel(tier: string): string {
  return tier === 'tier_1' ? 'T1' : tier === 'tier_2' ? 'T2' : tier === 'tier_3' ? 'T3' : tier
}

async function countFor(table: 'orders' | 'invoices' | 'customers' | 'vendors' | 'production_batches', orgId: string): Promise<number> {
  const { count } = await adminClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
  return count ?? 0
}

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('admin')

  const { data: orgRaw } = await adminClient
    .from('organizations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const org = orgRaw as OrgRow | null
  if (!org) notFound()

  const [
    usersRes,
    ordersRes,
    invoicesRes,
    billingRes,
    ordersCount,
    invoicesCount,
    customersCount,
    vendorsCount,
    batchesCount,
  ] = await Promise.all([
    adminClient
      .from('users')
      .select('id, full_name, role, email, last_login_at')
      .eq('organization_id', id)
      .is('deleted_at', null)
      .order('role', { ascending: true }),
    adminClient
      .from('orders')
      .select('id, order_number, status, total_amount_paise, created_at')
      .eq('organization_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    adminClient
      .from('invoices')
      .select('id, invoice_number, status, total_amount_paise, created_at')
      .eq('organization_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    adminClient
      .from('billing_events')
      .select('id, event_type, created_at, processed')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    countFor('orders', id),
    countFor('invoices', id),
    countFor('customers', id),
    countFor('vendors', id),
    countFor('production_batches', id),
  ])

  const users = (usersRes.data ?? []) as UserRow[]
  const orders = (ordersRes.data ?? []) as OrderRow[]
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const billingEvents = (billingRes.data ?? []) as BillingEventRow[]

  const field = (label: string, value: string) => (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-200">{value || '—'}</dd>
    </div>
  )

  const countCard = (label: string, value: number) => (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-xs text-amber-400 hover:text-amber-300">
          ← {t('orgDetail.back')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {tierLabel(org.tier)}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {org.billing_status}
          </span>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {countCard(t('orgDetail.orders'), ordersCount)}
        {countCard(t('orgDetail.invoices'), invoicesCount)}
        {countCard(t('orgDetail.customers'), customersCount)}
        {countCard(t('orgDetail.vendors'), vendorsCount)}
        {countCard(t('orgDetail.batches'), batchesCount)}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{t('orgDetail.saved')}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {paiseToCurrency(org.total_saved_paise ?? 0)}
          </p>
        </div>
      </div>

      {/* Profile + billing */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">{t('orgDetail.profile')}</h2>
          <dl className="grid grid-cols-2 gap-3">
            {field(t('orgDetail.gstin'), org.gstin ?? '')}
            {field(t('orgDetail.location'), [org.city, org.state].filter(Boolean).join(', '))}
            {field(t('orgDetail.phone'), org.phone)}
            {field(t('orgDetail.email'), org.email ?? '')}
            {field(t('orgDetail.whatsapp'), org.whatsapp_display_number ?? '')}
            {field(t('orgDetail.industry'), org.industry_config)}
            {field(t('orgDetail.created'), formatISTDate(new Date(org.created_at)))}
            {field(t('orgDetail.onboarding'), org.onboarding_status)}
          </dl>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">{t('orgDetail.billing')}</h2>
          <dl className="grid grid-cols-2 gap-3">
            {field(t('orgDetail.subId'), org.razorpay_subscription_id ?? '')}
            {field(t('orgDetail.custId'), org.razorpay_customer_id ?? '')}
            {field(
              t('orgDetail.validUntil'),
              org.tier_valid_until ? formatISTDate(new Date(org.tier_valid_until)) : ''
            )}
            {field(t('orgDetail.billingStatus'), org.billing_status)}
            {field(t('orgDetail.tierSource'), org.tier_source)}
          </dl>
          <h3 className="mb-2 mt-4 text-xs uppercase tracking-wide text-zinc-500">
            {t('orgDetail.recentBilling')}
          </h3>
          {billingEvents.length === 0 ? (
            <p className="text-xs text-zinc-500">{t('orgDetail.noBilling')}</p>
          ) : (
            <ul className="space-y-1 text-xs text-zinc-400">
              {billingEvents.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span className="font-mono">{e.event_type}</span>
                  <span className="text-zinc-500">{formatIST(new Date(e.created_at))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Team */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('orgDetail.team')}</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-2">{t('orgDetail.col.name')}</th>
                <th className="px-3 py-2">{t('orgDetail.col.role')}</th>
                <th className="px-3 py-2">{t('orgDetail.col.email')}</th>
                <th className="px-3 py-2">{t('orgDetail.col.lastActive')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    {t('orgDetail.noTeam')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="text-zinc-300">
                    <td className="px-3 py-2">{u.full_name}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2 text-zinc-400">{u.email ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {u.last_login_at ? formatIST(new Date(u.last_login_at)) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent orders + invoices */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('orgDetail.recentOrders')}</h2>
          <RecentTable
            rows={orders.map((o) => ({
              id: o.id,
              ref: o.order_number,
              status: o.status,
              amount: o.total_amount_paise,
              date: o.created_at,
            }))}
            emptyLabel={t('orgDetail.noOrders')}
            refLabel={t('orgDetail.col.orderNo')}
          />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('orgDetail.recentInvoices')}</h2>
          <RecentTable
            rows={invoices.map((i) => ({
              id: i.id,
              ref: i.invoice_number,
              status: i.status,
              amount: i.total_amount_paise,
              date: i.created_at,
            }))}
            emptyLabel={t('orgDetail.noInvoices')}
            refLabel={t('orgDetail.col.invoiceNo')}
          />
        </div>
      </section>
    </div>
  )
}

type RecentRow = { id: string; ref: string; status: string; amount: number; date: string }

function RecentTable({
  rows,
  emptyLabel,
  refLabel,
}: {
  rows: RecentRow[]
  emptyLabel: string
  refLabel: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-3 py-2">{refLabel}</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-950">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="text-zinc-300">
                <td className="px-3 py-2 font-mono text-xs">{r.ref}</td>
                <td className="px-3 py-2 text-zinc-400">{r.status}</td>
                <td className="px-3 py-2 text-right tabular-nums">{paiseToCurrency(r.amount)}</td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {formatISTDate(new Date(r.date))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
