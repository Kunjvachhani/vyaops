import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'

// Returns the current session state for a sender. Used by n8n to read
// pending order data before creating an order on user confirmation.

const RequestSchema = z.object({
  orgId: z.string().uuid(),
  sender: z.string().min(5),
})

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

  const { orgId, sender } = parsed.data

  try {
    const { data, error } = await adminClient
      .from('whatsapp_sessions')
      .select('state, expires_at')
      .eq('organization_id', orgId)
      .eq('sender_phone', sender)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message, code: 'SESSION_READ_FAILED' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ state: {}, expired: false, found: false })
    }

    const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false

    return NextResponse.json({
      state: (data.state as Record<string, unknown>) ?? {},
      expired,
      found: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Session read failed',
        code: 'SESSION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}
