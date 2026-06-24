import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { getSubscriptionStatus, RAZORPAY_PLANS } from '@/lib/billing/razorpay'
import { captureWithContext } from '@/lib/utils/sentry'

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const { data: org, error } = await adminClient
    .from('organizations')
    .select('tier, billing_status, tier_valid_until, razorpay_subscription_id, razorpay_customer_id')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const tierKey = org.tier as keyof typeof RAZORPAY_PLANS
  const planConfig = RAZORPAY_PLANS[tierKey] ?? null

  let razorpayStatus: string | null = null
  let nextChargeAt: string | null = null

  if (org.razorpay_subscription_id) {
    try {
      const sub = await getSubscriptionStatus(org.razorpay_subscription_id)
      razorpayStatus = sub.status
      if (sub.charge_at) {
        nextChargeAt = new Date(sub.charge_at * 1000).toISOString()
      }
    } catch (err) {
      captureWithContext(err instanceof Error ? err : new Error(String(err)), {
        action: 'GET /api/billing/subscription',
        org_id: user.org_id,
      })
    }
  }

  return NextResponse.json({
    tier: org.tier,
    planName: planConfig?.name ?? null,
    amountPaise: planConfig?.amountPaise ?? null,
    billingStatus: org.billing_status,
    tierValidUntil: org.tier_valid_until,
    subscriptionId: org.razorpay_subscription_id,
    razorpayStatus,
    nextChargeAt,
    availablePlans: Object.entries(RAZORPAY_PLANS).map(([key, plan]) => ({
      tier: key,
      planId: plan.planId,
      name: plan.name,
      amountPaise: plan.amountPaise,
      isCurrent: key === org.tier,
    })),
  })
}
