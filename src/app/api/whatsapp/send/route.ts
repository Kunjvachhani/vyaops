import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { sendRawMessage } from '@/lib/whatsapp/meta-cloud-api'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import type { MessageType } from '@/types/whatsapp'

// n8n hands us a fully-built Meta message body. We resolve the org from the
// recipient phone (for outbound logging) and forward it to the Graph API.
const RequestSchema = z
  .object({
    to: z.string().min(5),
    type: z.enum(['text', 'interactive', 'template', 'image', 'document']),
  })
  .passthrough()

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

  const { to, ...message } = parsed.data

  try {
    const { data: org } = await adminClient
      .from('organizations')
      .select('id')
      .eq('whatsapp_phone', to)
      .is('deleted_at', null)
      .single()

    // Unknown recipient → still attempt the send, but we can't attribute the log.
    const orgId = org?.id ?? '00000000-0000-0000-0000-000000000000'

    const result = await sendRawMessage(to, message as { type: MessageType; [k: string]: unknown }, orgId)

    if (!result.success) {
      return NextResponse.json({ error: result.error, code: 'META_SEND_FAILED' }, { status: 502 })
    }
    return NextResponse.json({ sent: true, messageId: result.messageId })
  } catch (error) {
    return NextResponse.json(
      { error: 'Send failed', code: 'SEND_ERROR', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
