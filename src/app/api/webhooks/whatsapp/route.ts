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

    if (!triggered) {
      // Silent classification: log for analytics, never respond
      console.log('[whatsapp] non-triggered message from:', maskedPhone, '— staying silent')
      return
    }

    // Triggered: extract intent + entities → route to AI processing
    console.log('[whatsapp] triggered message from:', maskedPhone, '— routing to AI', {
      org_id: org.id,
      type: msg.type,
    })
    // TODO: await routeToAI(msg, org) — model-router + eval-gate pipeline
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

  // TEMP DEBUG — log all headers
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key] = value })
  console.log('[whatsapp] incoming headers:', JSON.stringify(headers))
  console.log('[whatsapp] signature header:', request.headers.get('x-hub-signature-256'))

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    console.error('[whatsapp] HMAC-SHA256 signature verification failed — rejecting webhook')
    return new Response('Unauthorized', { status: 401 })
  }

  return new Response('', { status: 200 })
}
