import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { cancelSubscription } from '@/lib/billing/razorpay'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'

const CancelSchema = z.object({
  cancelAtCycleEnd: z.boolean().default(true),
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
    body = {}
  }

  const parsed = CancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { cancelAtCycleEnd } = parsed.data

  const { data: org, error } = await adminClient
    .from('organizations')
    .select('razorpay_subscription_id, billing_status')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (!org.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No active subscription', code: 'NO_SUBSCRIPTION' }, { status: 409 })
  }

  if (org.billing_status === 'cancelled') {
    return NextResponse.json({ error: 'Subscription already cancelled', code: 'ALREADY_CANCELLED' }, { status: 409 })
  }

  try {
    await cancelSubscription(org.razorpay_subscription_id, cancelAtCycleEnd)

    if (!cancelAtCycleEnd) {
      await adminClient
        .from('organizations')
        .update({ billing_status: 'cancelled' })
        .eq('id', user.org_id)

      await logAudit({
        organization_id: user.org_id,
        user_id: user.id,
        action: 'update',
        entity_type: 'organization',
        entity_id: user.org_id,
        changes: [
          { field: 'billing_status', old_value: org.billing_status, new_value: 'cancelled' },
        ],
      })
    }

    return NextResponse.json({
      cancelled: true,
      cancelAtCycleEnd,
      message: cancelAtCycleEnd
        ? 'Subscription will cancel at the end of the current billing cycle.'
        : 'Subscription cancelled immediately.',
    })
  } catch (err) {
    captureWithContext(err instanceof Error ? err : new Error(String(err)), {
      action: 'POST /api/billing/cancel',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to cancel subscription', code: 'RAZORPAY_ERROR' },
      { status: 502 }
    )
  }
}
