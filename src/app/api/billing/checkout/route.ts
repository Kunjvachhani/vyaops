import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  createSubscription,
  getRazorpayCredentials,
  RAZORPAY_PLANS,
  type TierKey,
} from '@/lib/billing/razorpay'
import { captureWithContext } from '@/lib/utils/sentry'

const CheckoutSchema = z.object({
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can manage billing', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { tier } = parsed.data

  const { data: org } = await adminClient
    .from('organizations')
    .select('razorpay_subscription_id, billing_status')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (org?.razorpay_subscription_id && org.billing_status === 'active') {
    return NextResponse.json(
      { error: 'Active subscription already exists. Use change-plan to switch tiers.', code: 'SUBSCRIPTION_EXISTS' },
      { status: 409 }
    )
  }

  try {
    const subscription = await createSubscription(user.org_id, tier as TierKey)
    const { keyId } = getRazorpayCredentials()
    const plan = RAZORPAY_PLANS[tier as TierKey]

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId,
      tier,
      planName: plan.name,
      amountPaise: plan.amountPaise,
    })
  } catch (err) {
    captureWithContext(err instanceof Error ? err : new Error(String(err)), {
      action: 'POST /api/billing/checkout',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to create subscription', code: 'RAZORPAY_ERROR' },
      { status: 502 }
    )
  }
}
