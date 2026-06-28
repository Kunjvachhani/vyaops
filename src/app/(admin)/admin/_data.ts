import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { RAZORPAY_PLANS, type TierKey } from '@/lib/billing/razorpay'
import type { Database } from '@/types/database'

// Cross-org platform-admin metrics. Everything here runs with the service-role
// client (no RLS) because the platform-admin plane is not org-scoped. NEVER import
// this module into a tenant route.

type OrgRow = Pick<
  Database['public']['Tables']['organizations']['Row'],
  | 'id'
  | 'name'
  | 'tier'
  | 'billing_status'
  | 'created_at'
  | 'razorpay_subscription_id'
  | 'total_saved_paise'
  | 'tier_source'
>
type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'organization_id' | 'full_name' | 'role' | 'last_login_at'
>
type OrderRow = Pick<Database['public']['Tables']['orders']['Row'], 'organization_id'>
type BillingEventRow = Pick<Database['public']['Tables']['billing_events']['Row'], 'organization_id'>
type AiUsageRow = Pick<
  Database['public']['Tables']['ai_usage']['Row'],
  'provider' | 'total_tokens' | 'latency_ms' | 'success'
>

// Estimated blended USD cost per 1M tokens, by provider. Rough — for an internal cost
// signal only, not billing. DeepSeek per CLAUDE.md ($0.435/M); OpenRouter/Qwen approx.
const USD_PER_MILLION_TOKENS: Record<string, number> = {
  deepseek: 0.435,
  openrouter: 0.9,
}

export type CustomerRow = {
  orgId: string
  name: string
  ownerName: string
  tier: string
  tierSource: string
  billingStatus: string
  createdAt: string
  lastActive: string | null
  ordersCount: number
  savedPaise: number
}

export type TierBreakdown = {
  tier: TierKey
  activeSubscriptions: number
  mrrPaise: number
}

export type AiProviderUsage = {
  provider: string
  calls: number
  totalTokens: number
  estCostUsd: number
}

export type AdminMetrics = {
  customers: CustomerRow[]
  totals: {
    orgs: number
    users: number
  }
  systemHealth: {
    whatsappMessagesToday: number
    activeByTier: TierBreakdown[]
    ai: {
      callsToday: number
      avgLatencyMs: number
      errorRate: number // 0..1
      byProvider: AiProviderUsage[]
      totalCostUsd: number
    }
  }
  revenue: {
    mrrPaise: number
    byTier: TierBreakdown[]
    churnThisMonth: number
    churnedOrgNames: string[]
  }
}

// Start of the current IST calendar day as a UTC Date (IST = UTC+5:30, no DST).
function istDayStartUtc(): Date {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  ist.setUTCHours(0, 0, 0, 0)
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000)
}

// Start of the current IST calendar month as a UTC Date.
function istMonthStartUtc(): Date {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const monthStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0, 0)
  return new Date(monthStart - 5.5 * 60 * 60 * 1000)
}

// MRR / active-subscription test. An org counts toward recurring revenue ONLY when it
// holds a Razorpay subscription AND billing_status is exactly 'active':
//   - The subscription id is required because billing_status defaults to 'active' on
//     signup, so the flag alone is NOT proof of payment.
//   - grace_period is deliberately EXCLUDED: it means the renewal charge failed and is
//     being retried (Razorpay halted → grace). That cycle's revenue is not recognised, so
//     counting it would overstate MRR. (Access-gating still grants grace_period via
//     billingAllowsPaidAccess — that is a separate concern from recognised revenue.)
function hasActiveSubscription(org: OrgRow): boolean {
  return !!org.razorpay_subscription_id && org.billing_status === 'active'
}

function planAmountPaise(tier: string): number {
  return tier in RAZORPAY_PLANS ? RAZORPAY_PLANS[tier as TierKey].amountPaise : 0
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const dayStart = istDayStartUtc().toISOString()
  const monthStart = istMonthStartUtc().toISOString()

  const [orgsRes, usersRes, ordersRes, waTodayRes, aiUsageRes, churnRes] =
    await Promise.all([
      adminClient
        .from('organizations')
        .select(
          'id, name, tier, tier_source, billing_status, created_at, razorpay_subscription_id, total_saved_paise'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      adminClient
        .from('users')
        .select('organization_id, full_name, role, last_login_at')
        .is('deleted_at', null),
      adminClient.from('orders').select('organization_id').is('deleted_at', null),
      adminClient
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart),
      adminClient
        .from('ai_usage')
        .select('provider, total_tokens, latency_ms, success')
        .gte('created_at', dayStart),
      adminClient
        .from('billing_events')
        .select('organization_id')
        .eq('event_type', 'subscription.cancelled')
        .gte('created_at', monthStart),
    ])

  const orgs = (orgsRes.data ?? []) as OrgRow[]
  const users = (usersRes.data ?? []) as UserRow[]
  const orders = (ordersRes.data ?? []) as OrderRow[]
  const aiUsage = (aiUsageRes.data ?? []) as AiUsageRow[]
  const churnEvents = (churnRes.data ?? []) as BillingEventRow[]

  // Owner name + most-recent activity per org.
  const ownerByOrg = new Map<string, string>()
  const lastActiveByOrg = new Map<string, string>()
  for (const u of users) {
    if (u.role === 'owner' && !ownerByOrg.has(u.organization_id)) {
      ownerByOrg.set(u.organization_id, u.full_name)
    }
    if (u.last_login_at) {
      const prev = lastActiveByOrg.get(u.organization_id)
      if (!prev || u.last_login_at > prev) lastActiveByOrg.set(u.organization_id, u.last_login_at)
    }
  }

  // Order counts per org.
  const ordersByOrg = new Map<string, number>()
  for (const o of orders) {
    ordersByOrg.set(o.organization_id, (ordersByOrg.get(o.organization_id) ?? 0) + 1)
  }

  const customers: CustomerRow[] = orgs.map((org) => ({
    orgId: org.id,
    name: org.name,
    ownerName: ownerByOrg.get(org.id) ?? '—',
    tier: org.tier,
    tierSource: org.tier_source,
    billingStatus: org.billing_status,
    createdAt: org.created_at,
    lastActive: lastActiveByOrg.get(org.id) ?? null,
    ordersCount: ordersByOrg.get(org.id) ?? 0,
    // Cached all-time figure from the nightly savings-snapshot cron (0 until first run).
    savedPaise: org.total_saved_paise ?? 0,
  }))

  // Revenue + active-subscription breakdown by tier (paying orgs only).
  const tierKeys = Object.keys(RAZORPAY_PLANS) as TierKey[]
  const breakdownMap = new Map<TierKey, TierBreakdown>(
    tierKeys.map((t) => [t, { tier: t, activeSubscriptions: 0, mrrPaise: 0 }])
  )
  let mrrPaise = 0
  for (const org of orgs) {
    if (!hasActiveSubscription(org)) continue
    const tier = org.tier as TierKey
    const entry = breakdownMap.get(tier)
    if (!entry) continue
    entry.activeSubscriptions += 1
    entry.mrrPaise += planAmountPaise(org.tier)
    mrrPaise += planAmountPaise(org.tier)
  }
  const byTier = tierKeys.map((t) => breakdownMap.get(t)!)

  // Churn: distinct orgs with a cancellation event this IST month.
  const churnedOrgIds = new Set(churnEvents.map((e) => e.organization_id))
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]))
  const churnedOrgNames = [...churnedOrgIds].map((id) => orgNameById.get(id) ?? id)

  // AI usage today: calls, error rate, avg latency, and tokens/cost per provider.
  const providerAgg = new Map<string, { calls: number; totalTokens: number }>()
  let latencySum = 0
  let errorCount = 0
  for (const row of aiUsage) {
    const agg = providerAgg.get(row.provider) ?? { calls: 0, totalTokens: 0 }
    agg.calls += 1
    agg.totalTokens += row.total_tokens
    providerAgg.set(row.provider, agg)
    latencySum += row.latency_ms
    if (!row.success) errorCount += 1
  }
  const callsToday = aiUsage.length
  const byProvider: AiProviderUsage[] = [...providerAgg.entries()].map(([provider, agg]) => ({
    provider,
    calls: agg.calls,
    totalTokens: agg.totalTokens,
    estCostUsd: (agg.totalTokens / 1_000_000) * (USD_PER_MILLION_TOKENS[provider] ?? 0),
  }))
  const totalCostUsd = byProvider.reduce((s, p) => s + p.estCostUsd, 0)

  return {
    customers,
    totals: { orgs: orgs.length, users: users.length },
    systemHealth: {
      whatsappMessagesToday: waTodayRes.count ?? 0,
      activeByTier: byTier,
      ai: {
        callsToday,
        avgLatencyMs: callsToday > 0 ? Math.round(latencySum / callsToday) : 0,
        errorRate: callsToday > 0 ? errorCount / callsToday : 0,
        byProvider,
        totalCostUsd,
      },
    },
    revenue: {
      mrrPaise,
      byTier,
      churnThisMonth: churnedOrgIds.size,
      churnedOrgNames,
    },
  }
}
