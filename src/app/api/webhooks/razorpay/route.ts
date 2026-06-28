import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyRazorpayWebhook, TIER_FROM_PLAN_ID } from '@/lib/billing/razorpay'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Json } from '@/types/database'

type RzpEntity = {
  id: string
  plan_id?: string
  status?: string
  current_end?: number | null
  charge_at?: number | null
  subscription_id?: string
}

type WebhookEvent = {
  event: string
  contains: string[]
  payload: {
    subscription?: { entity: RzpEntity }
    payment?: { entity: RzpEntity }
  }
  created_at?: number
}

function extractEntityId(event: WebhookEvent): string {
  if (event.payload.subscription) return event.payload.subscription.entity.id
  if (event.payload.payment) return event.payload.payment.entity.id
  return 'unknown'
}

async function findOrgBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('organizations')
    .select('id')
    .eq('razorpay_subscription_id', subscriptionId)
    .is('deleted_at', null)
    .single()
  return data?.id ?? null
}

async function handleSubscriptionAuthenticated(
  subscriptionEntity: RzpEntity,
  orgId: string
): Promise<void> {
  const tier = TIER_FROM_PLAN_ID[subscriptionEntity.plan_id ?? '']
  if (!tier) return

  const { data: org } = await adminClient
    .from('organizations')
    .select('tier, billing_status')
    .eq('id', orgId)
    .single()

  await adminClient
    .from('organizations')
    .update({
      tier,
      billing_status: 'active',
      // A real payment reclaims any manual comp — see migration 20260628000003.
      tier_source: 'billing',
    })
    .eq('id', orgId)

  await logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'organization',
    entity_id: orgId,
    changes: [
      { field: 'tier', old_value: org?.tier ?? null, new_value: tier },
      { field: 'billing_status', old_value: org?.billing_status ?? null, new_value: 'active' },
    ],
  })
}

async function handleSubscriptionCharged(
  subscriptionEntity: RzpEntity,
  orgId: string
): Promise<void> {
  const tier = TIER_FROM_PLAN_ID[subscriptionEntity.plan_id ?? '']
  const tierValidUntil = subscriptionEntity.current_end
    ? new Date(subscriptionEntity.current_end * 1000).toISOString()
    : null

  const { data: org } = await adminClient
    .from('organizations')
    .select('tier, billing_status, tier_valid_until')
    .eq('id', orgId)
    .single()

  await adminClient
    .from('organizations')
    .update({
      billing_status: 'active',
      ...(tier ? { tier, tier_source: 'billing' } : {}),
      ...(tierValidUntil ? { tier_valid_until: tierValidUntil } : {}),
    })
    .eq('id', orgId)

  const changes = [
    { field: 'billing_status', old_value: org?.billing_status ?? null, new_value: 'active' },
  ]
  if (tier && org?.tier !== tier)
    changes.push({ field: 'tier', old_value: org?.tier ?? null, new_value: tier })
  if (tierValidUntil)
    changes.push({ field: 'tier_valid_until', old_value: org?.tier_valid_until ?? null, new_value: tierValidUntil })

  await logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'organization',
    entity_id: orgId,
    changes,
  })
}

async function handleSubscriptionHalted(orgId: string): Promise<void> {
  const graceUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: org } = await adminClient
    .from('organizations')
    .select('billing_status, tier_valid_until')
    .eq('id', orgId)
    .single()

  await adminClient
    .from('organizations')
    .update({ billing_status: 'grace_period', tier_valid_until: graceUntil })
    .eq('id', orgId)

  await logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'organization',
    entity_id: orgId,
    changes: [
      { field: 'billing_status', old_value: org?.billing_status ?? null, new_value: 'grace_period' },
      { field: 'tier_valid_until', old_value: org?.tier_valid_until ?? null, new_value: graceUntil },
    ],
  })
}

async function handleSubscriptionCancelled(orgId: string): Promise<void> {
  const { data: org } = await adminClient
    .from('organizations')
    .select('billing_status')
    .eq('id', orgId)
    .single()

  await adminClient
    .from('organizations')
    .update({ billing_status: 'cancelled' })
    .eq('id', orgId)

  await logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'organization',
    entity_id: orgId,
    changes: [
      { field: 'billing_status', old_value: org?.billing_status ?? null, new_value: 'cancelled' },
    ],
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  const signature = request.headers.get('x-razorpay-signature') ?? ''
  if (!verifyRazorpayWebhook(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature', code: 'INVALID_SIG' }, { status: 401 })
  }

  let event: WebhookEvent
  try {
    event = JSON.parse(rawBody) as WebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const entityId = extractEntityId(event)
  const eventKey = `${event.event}:${entityId}`

  const { data: existingEvent } = await adminClient
    .from('billing_events')
    .select('id, processed')
    .eq('razorpay_event_id', eventKey)
    .maybeSingle()

  if (existingEvent?.processed) {
    return NextResponse.json({ received: true, status: 'already_processed' })
  }

  const subscriptionId =
    event.payload.subscription?.entity.id ??
    event.payload.payment?.entity.subscription_id

  const orgId = subscriptionId ? await findOrgBySubscriptionId(subscriptionId) : null

  if (!existingEvent && orgId) {
    await adminClient.from('billing_events').insert({
      organization_id: orgId,
      event_type: event.event,
      razorpay_event_id: eventKey,
      payload: JSON.parse(rawBody) as Json,
      processed: false,
    })
  }

  try {
    if (orgId) {
      switch (event.event) {
        case 'subscription.authenticated':
        case 'subscription.activated': {
          const entity = event.payload.subscription?.entity
          if (entity) await handleSubscriptionAuthenticated(entity, orgId)
          break
        }
        case 'subscription.charged': {
          const entity = event.payload.subscription?.entity
          if (entity) await handleSubscriptionCharged(entity, orgId)
          break
        }
        case 'subscription.halted':
          await handleSubscriptionHalted(orgId)
          break
        case 'subscription.cancelled':
        case 'subscription.completed':
          await handleSubscriptionCancelled(orgId)
          break
        case 'payment.failed':
          // Payment failure logged via billing_event; owner notification handled by n8n workflow
          break
        default:
          break
      }

      await adminClient
        .from('billing_events')
        .update({ processed: true })
        .eq('razorpay_event_id', eventKey)
    } else {
      captureWithContext(new Error(`No org found for Razorpay event`), {
        action: 'webhooks/razorpay',
        event_type: event.event,
        subscription_id: subscriptionId ?? 'unknown',
      })
    }
  } catch (err) {
    captureWithContext(err instanceof Error ? err : new Error(String(err)), {
      action: 'webhooks/razorpay/handle',
      event_type: event.event,
      org_id: orgId ?? undefined,
    })
  }

  return NextResponse.json({ received: true })
}
