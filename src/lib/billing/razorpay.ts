import { createHmac } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'

// Plan config from docs/billing/RAZORPAY_INTEGRATION.md
export const RAZORPAY_PLANS = {
  tier_1: { planId: 'plan_tier1_monthly', amountPaise: 799900, name: 'WhatsApp Vyapar' },
  tier_2: { planId: 'plan_tier2_monthly', amountPaise: 1499900, name: 'Factory OS' },
  tier_3: { planId: 'plan_tier3_monthly', amountPaise: 2499900, name: 'Factory Pro' },
} as const

export type TierKey = keyof typeof RAZORPAY_PLANS

export const TIER_FROM_PLAN_ID: Record<string, TierKey> = {
  plan_tier1_monthly: 'tier_1',
  plan_tier2_monthly: 'tier_2',
  plan_tier3_monthly: 'tier_3',
}

export type RzpSubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired'

export type RzpSubscription = {
  id: string
  plan_id: string
  status: RzpSubscriptionStatus
  current_start: number | null
  current_end: number | null
  charge_at: number | null
  total_count: number
  paid_count: number
  remaining_count: number
  customer_id: string | null
}

type RzpCustomer = {
  id: string
  name: string
  email: string
  contact: string
}

const RAZORPAY_BASE = 'https://api.razorpay.com/v1'

function getBasicAuth(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured')
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

async function rzpFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: getBasicAuth(),
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`Razorpay ${res.status}: ${JSON.stringify(body)}`)
  }
  return res.json() as Promise<T>
}

export function verifyRazorpayWebhook(payload: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured')
  return { keyId, keySecret }
}

export async function getOrCreateRazorpayCustomer(orgId: string): Promise<string> {
  const { data: org, error } = await adminClient
    .from('organizations')
    .select('razorpay_customer_id, name, email, phone')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single()

  if (error || !org) throw new Error(`Organization not found: ${orgId}`)
  if (org.razorpay_customer_id) return org.razorpay_customer_id

  const customer = await rzpFetch<RzpCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: org.name,
      email: org.email ?? '',
      contact: org.phone,
    }),
  })

  await adminClient
    .from('organizations')
    .update({ razorpay_customer_id: customer.id })
    .eq('id', orgId)

  return customer.id
}

export async function createSubscription(orgId: string, tier: TierKey): Promise<RzpSubscription> {
  const plan = RAZORPAY_PLANS[tier]
  const customerId = await getOrCreateRazorpayCustomer(orgId)

  const subscription = await rzpFetch<RzpSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: plan.planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 120,
      customer_id: customerId,
    }),
  })

  const { data: org } = await adminClient
    .from('organizations')
    .select('razorpay_subscription_id')
    .eq('id', orgId)
    .single()

  await adminClient
    .from('organizations')
    .update({ razorpay_subscription_id: subscription.id })
    .eq('id', orgId)

  await logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'organization',
    entity_id: orgId,
    changes: [
      {
        field: 'razorpay_subscription_id',
        old_value: org?.razorpay_subscription_id ?? null,
        new_value: subscription.id,
      },
    ],
  })

  return subscription
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true
): Promise<RzpSubscription> {
  return rzpFetch<RzpSubscription>(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
  })
}

export async function getSubscriptionStatus(subscriptionId: string): Promise<RzpSubscription> {
  return rzpFetch<RzpSubscription>(`/subscriptions/${subscriptionId}`)
}
