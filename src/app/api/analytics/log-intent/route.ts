import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInternalAuth } from '@/lib/utils/internal-auth'

// Log Only branch of the n8n master handler: logs unrouted message events to
// PostHog for product analytics. Never to the DB, never with raw message content
// or full phone numbers (privacy: see CLAUDE.md security rule #8).
const RequestSchema = z.object({
  orgId: z.string().uuid(),
  chatPhone: z.string().optional(),  // replaces old 'sender' — masked before logging
  message: z.string().optional(),
  messageType: z.string(),
  intent: z.string().optional(),
  timestamp: z.string().optional(),
})

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { orgId, message, messageType, intent } = parsed.data

  // Privacy-safe properties only: no raw body, no phone. Length is a useful proxy.
  const properties = {
    organization_id: orgId,
    message_type: messageType,
    intent: intent ?? null,
    message_length: message?.length ?? 0,
  }

  if (!POSTHOG_KEY) {
    // Analytics not configured — acknowledge so the workflow node still succeeds.
    console.log('[analytics] log-intent (PostHog disabled):', properties)
    return NextResponse.json({ logged: false, reason: 'posthog_not_configured' })
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'whatsapp_message_classified',
        distinct_id: orgId, // org-level analytics — never the user's phone
        properties,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ logged: false, code: 'POSTHOG_ERROR', details: text.slice(0, 160) }, { status: 502 })
    }
    return NextResponse.json({ logged: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Analytics log failed', code: 'ANALYTICS_ERROR', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
