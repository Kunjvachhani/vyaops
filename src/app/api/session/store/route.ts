import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import type { Json } from '@/types/database'

// Persists one piece of guided-flow state (e.g. selected_customer_id) for a
// conversation, keyed by (orgId, sender). Read-modify-write merges into the
// existing session JSON; the row is the single live session per sender.
const RequestSchema = z.object({
  orgId: z.string().uuid(),
  sender: z.string().min(5),
  key: z.string().min(1).max(64),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour

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

  const { orgId, sender, key, value } = parsed.data

  try {
    const { data: existing } = await adminClient
      .from('whatsapp_sessions')
      .select('state')
      .eq('organization_id', orgId)
      .eq('sender_phone', sender)
      .maybeSingle()

    const currentState = (existing?.state as Record<string, Json> | null) ?? {}
    const nextState: Record<string, Json> = { ...currentState, [key]: value }

    const { error } = await adminClient
      .from('whatsapp_sessions')
      .upsert(
        {
          organization_id: orgId,
          sender_phone: sender,
          state: nextState as Json,
          expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        },
        { onConflict: 'organization_id,sender_phone' }
      )

    if (error) {
      return NextResponse.json({ error: error.message, code: 'SESSION_WRITE_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ stored: true, state: nextState })
  } catch (error) {
    return NextResponse.json(
      { error: 'Session store failed', code: 'SESSION_ERROR', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
