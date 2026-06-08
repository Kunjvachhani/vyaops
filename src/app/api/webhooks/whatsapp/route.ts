import { after } from 'next/server'
import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import type {
  MetaWebhookPayload,
  WhatsAppInboundMessage,
  WhatsAppStatusUpdate,
} from '@/types/whatsapp'

function maskPhone(phone: string): string {
  if (phone.length < 6) return 'XXXXXX'
  return phone.slice(0, 2) + 'XXXX' + phone.slice(-4)
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_WHATSAPP_APP_SECRET
  if (!signatureHeader || !secret) return false

  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

function isTriggerMessage(msg: WhatsAppInboundMessage): boolean {
  if (msg.type === 'interactive' || msg.type === 'button') return true
  if (msg.context != null) return true
  if (msg.type === 'text' && msg.text.body.trimStart().startsWith('/')) return true
  return false
}

function extractMessageBody(msg: WhatsAppInboundMessage): string | null {
  if (msg.type === 'text') return msg.text.body
  if (msg.type === 'button') return msg.button.text
  if (msg.type === 'interactive') {
    const ia = msg.interactive
    if (ia.type === 'button_reply') return ia.button_reply.title
    if (ia.type === 'list_reply') return ia.list_reply.title
  }
  return null
}

// Maps a Meta inbound message to the n8n forward contract's messageType plus
// the selection ids the guided-flow branch parses.
type N8nMessageShape = {
  messageType: 'text' | 'button_reply' | 'list_reply'
  buttonReply?: { id: string; title: string }
  listReply?: { rowId: string; title: string }
}

function toN8nMessageShape(msg: WhatsAppInboundMessage): N8nMessageShape {
  if (msg.type === 'interactive') {
    const ia = msg.interactive
    if (ia.type === 'button_reply') {
      return { messageType: 'button_reply', buttonReply: { id: ia.button_reply.id, title: ia.button_reply.title } }
    }
    if (ia.type === 'list_reply') {
      return { messageType: 'list_reply', listReply: { rowId: ia.list_reply.id, title: ia.list_reply.title } }
    }
  }
  if (msg.type === 'button') {
    return { messageType: 'button_reply', buttonReply: { id: msg.button.payload, title: msg.button.text } }
  }
  return { messageType: 'text' }
}

// Forwards the normalized message to the n8n master handler. Fire-and-forget:
// a forwarding failure must never break inbound acknowledgement.
async function forwardToN8n(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) {
    console.warn('[whatsapp] N8N_WEBHOOK_URL not set — skipping forward')
    return
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY ?? '',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[whatsapp] failed to forward to n8n:', err instanceof Error ? err.message : String(err))
  }
}

async function processStatusUpdates(statuses: WhatsAppStatusUpdate[]): Promise<void> {
  for (const status of statuses) {
    console.log('[whatsapp] delivery status:', status.status, 'for', maskPhone(status.recipient_id))
  }
}

async function processInboundMessage(msg: WhatsAppInboundMessage): Promise<void> {
  const maskedPhone = maskPhone(msg.from)

  try {
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, tier, auto_mode_enabled')
      .eq('whatsapp_phone', msg.from)
      .is('deleted_at', null)
      .single()

    if (orgError || !org) {
      console.log('[whatsapp] no org found for sender:', maskedPhone)
      return
    }

    const triggered = isTriggerMessage(msg)
    const messageBody = extractMessageBody(msg)

    const { error: insertError } = await adminClient.from('whatsapp_messages').insert({
      message_id: msg.id,
      organization_id: org.id,
      sender_phone: msg.from,
      direction: 'inbound',
      message_type: msg.type,
      message_body: messageBody,
      was_triggered: triggered,
      was_processed: false,
    })

    if (insertError) {
      console.error('[whatsapp] failed to log message:', {
        error: insertError.message,
        org_id: org.id,
        phone: maskedPhone,
        type: msg.type,
      })
    }

    // Forward every message to the n8n master handler. n8n routes by
    // (messageType, isTriggered): guided flow, AI flow, or Branch C log-only.
    // Non-triggered messages are forwarded too (n8n logs them, sends no reply).
    const shape = toN8nMessageShape(msg)
    await forwardToN8n({
      message: messageBody ?? '',
      sender: msg.from,
      orgId: org.id,
      messageType: shape.messageType,
      isTriggered: triggered,
      ...(shape.buttonReply ? { buttonReply: shape.buttonReply } : {}),
      ...(shape.listReply ? { listReply: shape.listReply } : {}),
    })

    console.log('[whatsapp] forwarded to n8n:', maskedPhone, {
      org_id: org.id,
      type: shape.messageType,
      triggered,
    })
  } catch (err) {
    console.error('[whatsapp] unhandled error processing message:', {
      phone: maskedPhone,
      type: msg.type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function _processWebhookPayload(payload: MetaWebhookPayload): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const { value } = change

      if (value.statuses?.length) {
        await processStatusUpdates(value.statuses)
      }

      if (!value.messages?.length) continue

      for (const msg of value.messages) {
        await processInboundMessage(msg)
      }
    }
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Dualhook test pings don't carry Meta HMAC signature — let them through
  const isDualhookPing = request.headers.get('x-dualhook-event') === 'test_ping'

  if (!isDualhookPing && !verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    console.error('[whatsapp] HMAC-SHA256 signature verification failed — rejecting webhook')
    return new Response('Unauthorized', { status: 401 })
  }

  if (isDualhookPing) {
    console.log('[whatsapp] Dualhook test ping received — OK')
    return new Response('', { status: 200 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new Response('', { status: 200 })
  }

  after(async () => {
    await _processWebhookPayload(payload)
  })

  return new Response('', { status: 200 })
}
