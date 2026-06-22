import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import { handleCustomerMessage, handleOwnerEcho } from '@/lib/whatsapp/flow-engine'

// Internal-auth endpoint called by n8n for both customer messages and owner echoes.
// n8n branches on messageType: 'customer_text' | 'owner_echo'.

const BaseCustomerSchema = z.object({
  message: z.string(),
  chatPhone: z.string().min(5),
  orgId: z.string().uuid(),
  messageId: z.string().min(1),
  customerId: z.string().uuid().nullable().optional(),
})

const RequestSchema = z.discriminatedUnion('messageType', [
  BaseCustomerSchema.extend({ messageType: z.literal('customer_text') }),
  BaseCustomerSchema.extend({ messageType: z.literal('button_reply') }),
  BaseCustomerSchema.extend({ messageType: z.literal('list_reply') }),
  z.object({
    messageType: z.literal('owner_echo'),
    message: z.string(),
    chatPhone: z.string().min(5),
    orgId: z.string().uuid(),
    messageId: z.string().min(1),
    isCommand: z.boolean().optional(),
  }),
])

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

  const data = parsed.data

  // Acknowledge immediately — processing continues via after(), which keeps the
  // serverless function alive past the response. A naked fire-and-forget promise
  // gets killed when Vercel freezes the function after responding.
  after(async () => {
    try {
      if (data.messageType === 'owner_echo') {
        await handleOwnerEcho(data.orgId, data.chatPhone, data.message, data.messageId)
      } else {
        // customer_text, button_reply, list_reply — all handled as customer messages
        const customerId = 'customerId' in data ? (data.customerId ?? null) : null
        await handleCustomerMessage(
          data.orgId,
          data.chatPhone,
          customerId,
          data.message,
          data.messageId
        )
      }
    } catch (err) {
      captureWithContext(err, {
        action: 'whatsapp/flow',
        org_id: data.orgId,
        message_type: data.messageType,
      })
    }
  })

  return NextResponse.json({ ok: true })
}
