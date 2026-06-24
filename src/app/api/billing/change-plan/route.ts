import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  createSubscription,
  cancelSubscription,
  getRazorpayCredentials,
  RAZORPAY_PLANS,
  type TierKey,
} from '@/lib/billing/razorpay'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'

const ChangePlanSchema = z.object({
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

  const parsed = ChangePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { tier: newTier } = parsed.data

  const { data: org, error } = await adminClient
    .from('organizations')
    .select('tier, billing_status, razorpay_subscription_id')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (org.tier === newTier) {
    return NextResponse.json({ error: 'Already on this plan', code: 'SAME_PLAN' }, { status: 409 })
  }

  if (!org.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No existing subscription. Use /api/billing/checkout instead.', code: 'NO_SUBSCRIPTION' }, { status: 409 })
  }

  try {
    // Cancel old subscription at cycle end to avoid double billing
    await cancelSubscription(org.razorpay_subscription_id, true)

    // Create new subscription for the new tier
    const newSubscription = await createSubscription(user.org_id, newTier as TierKey)
    const { keyId } = getRazorpayCredentials()
    const plan = RAZORPAY_PLANS[newTier as TierKey]

    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'update',
      entity_type: 'organization',
      entity_id: user.org_id,
      changes: [
        { field: 'tier', old_value: org.tier, new_value: newTier },
        {
          field: 'razorpay_subscription_id',
          old_value: org.razorpay_subscription_id,
          new_value: newSubscription.id,
        },
      ],
    })

    return NextResponse.json({
      subscriptionId: newSubscription.id,
      keyId,
      tier: newTier,
      planName: plan.name,
      amountPaise: plan.amountPaise,
      previousTier: org.tier,
      message: 'Previous subscription will end at cycle close. Authenticate the new subscription to activate.',
    })
  } catch (err) {
    captureWithContext(err instanceof Error ? err : new Error(String(err)), {
      action: 'POST /api/billing/change-plan',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to change plan', code: 'RAZORPAY_ERROR' },
      { status: 502 }
    )
  }
}
