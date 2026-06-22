import { after } from 'next/server'
import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { captureWithContext } from '@/lib/utils/sentry'
import { normalizePhone } from '@/lib/utils/phone'
import type {
  MetaWebhookPayload,
  WhatsAppInboundMessage,
  WhatsAppEchoMessage,
  WhatsAppStatusUpdate,
} from '@/types/whatsapp'

function maskPhone(phone: string): string {
  if (phone.length < 6) return 'XXXXXX'
  return phone.slice(0, 2) + 'XXXX' + phone.slice(-4)
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Layer 1 — HMAC-SHA256 signature (X-Hub-Signature-256).
 *
 * In Dualhook Coexistence + Webhook Override, Meta signs deliveries with the
 * App Secret of the app subscribed to the WABA — Dualhook's tech-provider app,
 * whose secret is not exposed to us. We still verify against:
 *   - DUALHOOK_SIGNING_SECRET (if Dualhook support provides it)
 *   - META_WHATSAPP_APP_SECRET (correct when our own app is the subscriber,
 *     e.g. direct Cloud API setups without Dualhook)
 */
function verifyHmacSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false

  const secrets = [
    process.env.DUALHOOK_SIGNING_SECRET,
    process.env.META_WHATSAPP_APP_SECRET,
  ].filter((s): s is string => Boolean(s))

  for (const secret of secrets) {
    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
    if (timingSafeEqualStr(expected, signatureHeader)) return true
  }
  return false
}

/**
 * Layer 2 — secret URL token fallback.
 *
 * The webhook URL registered with Dualhook/Meta carries a random token as a
 * query param (?t=...). Meta POSTs to the exact override_callback_uri, so the
 * token is known only to Meta, Dualhook, and us — it authenticates deliveries
 * when the HMAC secret is unavailable (Dualhook signs with its own app secret).
 * Only active when WHATSAPP_WEBHOOK_URL_TOKEN is set.
 */
function verifyUrlToken(request: NextRequest): boolean {
  const expected = process.env.WHATSAPP_WEBHOOK_URL_TOKEN
  if (!expected) return false
  const provided = new URL(request.url).searchParams.get('t')
  if (!provided) return false
  return timingSafeEqualStr(provided, expected)
}

function isEchoField(field: string): boolean {
  // Accept both field names until Dualhook's exact name is confirmed in Phase 8.
  return field === 'smb_message_echoes' || field === 'message_echoes'
}

// Known draft/confirmation message prefixes — secondary echo loop guard.
const BOT_MESSAGE_PREFIXES = ['📋 Order Draft', '✅ Order Confirmed', '📦 Your Orders']

function looksLikeBotMessage(text: string): boolean {
  return BOT_MESSAGE_PREFIXES.some((p) => text.startsWith(p))
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

type N8nShape = {
  messageType: 'customer_text' | 'button_reply' | 'list_reply'
  buttonReply?: { id: string; title: string }
  listReply?: { rowId: string; title: string }
}

function toN8nShape(msg: WhatsAppInboundMessage): N8nShape {
  if (msg.type === 'interactive') {
    const ia = msg.interactive
    if (ia.type === 'button_reply')
      return { messageType: 'button_reply', buttonReply: { id: ia.button_reply.id, title: ia.button_reply.title } }
    if (ia.type === 'list_reply')
      return { messageType: 'list_reply', listReply: { rowId: ia.list_reply.id, title: ia.list_reply.title } }
  }
  if (msg.type === 'button')
    return { messageType: 'button_reply', buttonReply: { id: msg.button.payload, title: msg.button.text } }
  return { messageType: 'customer_text' }
}

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
    captureWithContext(err, { action: 'whatsapp-webhook/forwardToN8n' })
  }
}

async function lookupOrg(
  phoneNumberId: string,
  displayPhoneNumber: string
): Promise<{ id: string; tier: string; language_preference: string } | null> {
  // Primary: match by phone_number_id (the Meta internal ID — unique per org)
  const { data: byId } = await adminClient
    .from('organizations')
    .select('id, tier, language_preference')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .is('deleted_at', null)
    .maybeSingle()

  if (byId) return byId

  // Fallback: display number (human-readable, set during onboarding)
  const { data: byDisplay } = await adminClient
    .from('organizations')
    .select('id, tier, language_preference')
    .eq('whatsapp_display_number', displayPhoneNumber)
    .is('deleted_at', null)
    .maybeSingle()

  return byDisplay ?? null
}

async function processStatusUpdates(statuses: WhatsAppStatusUpdate[]): Promise<void> {
  for (const status of statuses) {
    console.log('[whatsapp] delivery status:', status.status, 'for', maskPhone(status.recipient_id))
  }
}

async function processCustomerMessage(
  msg: WhatsAppInboundMessage,
  orgId: string
): Promise<void> {
  const customerPhone = normalizePhone(msg.from)
  const maskedPhone = maskPhone(customerPhone)

  try {
    // Resolve customer by normalized phone
    const { data: customer } = await adminClient
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('phone', customerPhone)
      .is('deleted_at', null)
      .maybeSingle()

    const messageBody = extractMessageBody(msg)

    // Log to whatsapp_messages
    const { error: insertError } = await adminClient.from('whatsapp_messages').insert({
      message_id: msg.id,
      organization_id: orgId,
      sender_phone: customerPhone,
      chat_phone: customerPhone,
      direction: 'inbound',
      is_echo: false,
      message_type: msg.type,
      message_body: messageBody,
      was_triggered: false,
      was_processed: false,
    })

    if (insertError) {
      captureWithContext(new Error(insertError.message), {
        action: 'whatsapp-webhook/logCustomerMessage',
        org_id: orgId,
        supabase_code: insertError.code,
      })
    }

    if (!customer) {
      // Unknown sender — log only, no pending order, no reply (Rule A)
      console.log('[whatsapp] unknown customer sender:', maskedPhone, '— log only, no action')
      return
    }

    const shape = toN8nShape(msg)
    await forwardToN8n({
      messageType: shape.messageType,
      message: messageBody ?? '',
      chatPhone: customerPhone,
      orgId,
      messageId: msg.id,
      customerId: customer.id,
      ...(shape.buttonReply ? { buttonReply: shape.buttonReply } : {}),
      ...(shape.listReply ? { listReply: shape.listReply } : {}),
    })

    console.log('[whatsapp] customer message forwarded:', maskedPhone, {
      org_id: orgId,
      customer_id: customer.id,
      type: shape.messageType,
    })
  } catch (err) {
    captureWithContext(err, { action: 'whatsapp-webhook/processCustomerMessage', org_id: orgId })
  }
}

async function processEcho(
  echo: WhatsAppEchoMessage,
  orgId: string
): Promise<void> {
  const chatPhone = normalizePhone(echo.to ?? '')
  const maskedChat = maskPhone(chatPhone)
  const echoText = echo.text?.body ?? ''

  try {
    // ─── LOOP GUARD LAYER 1: wamid already logged as outbound ───────────────
    const { data: existing } = await adminClient
      .from('whatsapp_messages')
      .select('id')
      .eq('message_id', echo.id)
      .eq('direction', 'outbound')
      .maybeSingle()

    if (existing) {
      console.log('[whatsapp] echo loop guard: wamid already logged outbound — skipping', echo.id)
      return
    }

    // ─── LOOP GUARD LAYER 2: text signature matches bot draft/confirm ────────
    if (looksLikeBotMessage(echoText)) {
      console.log('[whatsapp] echo loop guard: text signature matches bot message — skipping')
      return
    }

    // Log to whatsapp_messages
    const isCommand = echoText.trimStart().startsWith('/')
    const { error: insertError } = await adminClient.from('whatsapp_messages').insert({
      message_id: echo.id,
      organization_id: orgId,
      sender_phone: normalizePhone(echo.from),
      chat_phone: chatPhone,
      direction: 'outbound',
      is_echo: true,
      message_type: echo.type,
      message_body: echoText,
      was_triggered: isCommand,
      was_processed: false,
    })

    if (insertError) {
      captureWithContext(new Error(insertError.message), {
        action: 'whatsapp-webhook/logEcho',
        org_id: orgId,
        supabase_code: insertError.code,
      })
    }

    await forwardToN8n({
      messageType: 'owner_echo',
      message: echoText,
      chatPhone,
      orgId,
      messageId: echo.id,
      isCommand,
    })

    console.log('[whatsapp] owner echo forwarded:', maskedChat, { org_id: orgId, isCommand })
  } catch (err) {
    captureWithContext(err, { action: 'whatsapp-webhook/processEcho', org_id: orgId })
  }
}

async function _processWebhookPayload(payload: MetaWebhookPayload): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { value } = change
      const { phone_number_id, display_phone_number } = value.metadata

      if (change.field === 'messages') {
        if (value.statuses?.length) {
          await processStatusUpdates(value.statuses)
        }

        const hasEchoes = (value.message_echoes?.length ?? 0) > 0
        const hasMessages = (value.messages?.length ?? 0) > 0

        // Meta sometimes delivers owner echoes inside a 'messages' change event
        // (value.message_echoes populated, value.messages empty). The old
        // `if (!value.messages?.length) continue` silently dropped them.
        if (!hasEchoes && !hasMessages) continue

        const org = await lookupOrg(phone_number_id, display_phone_number)
        if (!org) {
          console.log('[whatsapp] no org for phone_number_id:', phone_number_id, '/', maskPhone(display_phone_number))
          continue
        }

        if (hasEchoes) {
          for (const echo of value.message_echoes!) {
            await processEcho(echo, org.id)
          }
        }

        if (hasMessages) {
          for (const msg of value.messages!) {
            await processCustomerMessage(msg, org.id)
          }
        }
      } else if (isEchoField(change.field)) {
        // Meta delivers echoes in value.message_echoes (not value.messages).
        // Keep value.messages as a defensive fallback.
        const echoes =
          value.message_echoes ??
          (value.messages as unknown as WhatsAppEchoMessage[] | undefined)
        if (!echoes?.length) {
          console.log('[whatsapp] echo change with no echo entries — ignoring')
          continue
        }

        const org = await lookupOrg(phone_number_id, display_phone_number)
        if (!org) {
          console.log('[whatsapp] no org for echo phone_number_id:', phone_number_id)
          continue
        }

        for (const raw of echoes) {
          await processEcho(raw, org.id)
        }
      }
      // All other change.field values (statuses in separate change, etc.): silently ignore
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

  const isDualhookPing = request.headers.get('x-dualhook-event') === 'test_ping'

  if (!isDualhookPing) {
    const hmacOk = verifyHmacSignature(rawBody, request.headers.get('x-hub-signature-256'))
    const tokenOk = !hmacOk && verifyUrlToken(request)

    if (!hmacOk && !tokenOk) {
      captureWithContext(new Error('Webhook authentication failed (HMAC + URL token)'), {
        action: 'whatsapp-webhook/auth',
      })
      return new Response('Unauthorized', { status: 401 })
    }

    if (tokenOk) {
      // HMAC can't be verified under Dualhook Coexistence (signed by Dualhook's
      // tech-provider app secret). URL-token auth is the documented fallback.
      console.log('[whatsapp] authenticated via URL token (HMAC unavailable)')
    }
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
