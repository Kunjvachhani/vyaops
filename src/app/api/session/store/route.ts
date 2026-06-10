import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import type { Json } from '@/types/database'

// Persists guided-flow state for a conversation, keyed by (orgId, sender).
// Supports two modes:
//   - Single key: { key, value } — merges one field into existing session state
//   - Bulk:       { state }      — merges an entire object into existing session state
//
// Both modes accept an optional ttl_seconds override (default: 3600 = 1 hour).
// The order-confirm flow uses ttl_seconds: 600 (10 min) for faster expiry.

const ScalarValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const RequestSchema = z
  .object({
    orgId: z.string().uuid(),
    sender: z.string().min(5),
    key: z.string().min(1).max(64).optional(),
    value: ScalarValueSchema.optional(),
    state: z.record(ScalarValueSchema).optional(),
    ttl_seconds: z.number().int().positive().max(3600).optional(),
  })
  .refine(
    (d) => (d.key !== undefined && d.value !== undefined) || d.state !== undefined,
    { message: 'Provide either (key + value) or state for bulk update' }
  )

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

  const { orgId, sender, key, value, state: bulkState, ttl_seconds } = parsed.data
  const ttlMs = (ttl_seconds ?? 3600) * 1000

  try {
    const { data: existing } = await adminClient
      .from('whatsapp_sessions')
      .select('state')
      .eq('organization_id', orgId)
      .eq('sender_phone', sender)
      .maybeSingle()

    const currentState = (existing?.state as Record<string, Json> | null) ?? {}

    const nextState: Record<string, Json> = bulkState
      ? { ...currentState, ...(bulkState as Record<string, Json>) }
      : { ...currentState, [key!]: value as Json }

    const { error } = await adminClient
      .from('whatsapp_sessions')
      .upsert(
        {
          organization_id: orgId,
          sender_phone: sender,
          state: nextState as Json,
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        },
        { onConflict: 'organization_id,sender_phone' }
      )

    if (error) {
      return NextResponse.json({ error: error.message, code: 'SESSION_WRITE_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ stored: true, state: nextState })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Session store failed',
        code: 'SESSION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}
