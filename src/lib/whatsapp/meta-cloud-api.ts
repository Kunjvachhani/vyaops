import { createHmac, timingSafeEqual } from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import type {
  Button,
  Section,
  TemplateComponent,
  SendResult,
  MetaErrorResponse,
  MessageType,
} from '@/types/whatsapp'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'
const RETRY_LIMIT = 2
const RETRY_DELAY_MS = 1000

// ─── Signature verification ───────────────────────────────────────────────────

export function verifyMetaSignature(
  payload: string,
  signatureHeader: string
): boolean {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET ?? ''
  const expected = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

// ─── Core HTTP client ─────────────────────────────────────────────────────────

interface MetaSuccessResponse {
  messages: Array<{ id: string }>
}

// Resolve the business phone-number ID to SEND FROM. Multi-tenant correct: each
// org sends from its own WhatsApp number (organizations.whatsapp_phone_number_id).
// Falls back to the global env var for internal sends that have no real org id.
// This is also why the missing Vercel env var no longer breaks production: the
// value is sourced from the DB first.
async function resolveSendingPhoneNumberId(organizationId: string): Promise<string> {
  const envFallback = (process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '').trim()

  if (!organizationId || organizationId === '00000000-0000-0000-0000-000000000000') {
    return envFallback
  }

  try {
    const { data } = await adminClient
      .from('organizations')
      .select('whatsapp_phone_number_id')
      .eq('id', organizationId)
      .is('deleted_at', null)
      .maybeSingle()
    const orgPid = (data?.whatsapp_phone_number_id ?? '').trim()
    return orgPid || envFallback
  } catch {
    return envFallback
  }
}

async function callGraphApi(
  body: Record<string, unknown>,
  phoneNumberId: string
): Promise<{ messageId: string }> {
  // .trim() guards against trailing newlines/spaces that creep in when long
  // values are pasted into the Vercel env UI.
  const cleanPhoneNumberId = phoneNumberId.trim()
  const accessToken = (process.env.META_WHATSAPP_ACCESS_TOKEN ?? '').trim()

  // Fail LOUD on missing config. An empty phoneNumberId silently builds the URL
  // `${BASE}//messages`, which Meta resolves to the node 'messages' and rejects
  // with the misleading "Error 100/33: Object with ID 'messages' does not exist".
  // That single missing env var cost days of debugging — never again.
  if (!cleanPhoneNumberId) {
    throw new Error(
      'No WhatsApp phone_number_id available — neither organizations.whatsapp_phone_number_id ' +
        'nor META_WHATSAPP_PHONE_NUMBER_ID is set. Cannot call Meta Graph API.'
    )
  }
  if (!accessToken) {
    throw new Error('META_WHATSAPP_ACCESS_TOKEN is not set — cannot call Meta Graph API.')
  }

  const url = `${GRAPH_API_BASE}/${cleanPhoneNumberId}/messages`

  // Always log token prefix so we can verify which token Vercel is using
  console.log(`[meta-api] attempt pid=${cleanPhoneNumberId} tok=${accessToken.slice(0, 15) || 'UNSET'}`)

  let lastError = 'Unknown error'

  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = (await res.json()) as MetaSuccessResponse
      return { messageId: data.messages?.[0]?.id ?? '' }
    }

    const errData = (await res.json()) as MetaErrorResponse
    const { code, error_subcode, message } = errData.error
    lastError = `Meta API error ${code}${error_subcode ? `/${error_subcode}` : ''}: ${message}`
    // One field per line — Vercel MCP table truncates columns ~35 chars
    console.error(`[meta-sub] ${error_subcode ?? 'none'}`)
    console.error(`[meta-code] ${code}`)
    console.error(`[meta-http] ${res.status}`)
    console.error(`[meta-msg] ${message.slice(0, 80)}`)

    // Non-retriable: permanent 4xx client errors (but retry 429 rate limits)
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      break
    }
  }

  throw new Error(lastError)
}

// ─── DB logging ───────────────────────────────────────────────────────────────

function logOutboundMessage(
  organizationId: string,
  phone: string,
  messageType: MessageType,
  messageId: string,
  body?: string
): void {
  adminClient
    .from('whatsapp_messages')
    .insert({
      organization_id: organizationId,
      message_id: messageId,
      direction: 'outbound',
      is_echo: false,
      sender_phone: phone,
      chat_phone: phone,   // for outbound, phone IS the customer (recipient)
      message_type: messageType,
      message_body: body ?? null,
      was_triggered: false,
      was_processed: false,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[WhatsApp] Failed to log outbound message:', error)
      }
    })
}

// ─── Shared send + log wrapper ────────────────────────────────────────────────

async function sendAndLog(
  organizationId: string,
  phone: string,
  messageType: MessageType,
  apiBody: Record<string, unknown>,
  logBody?: string
): Promise<SendResult> {
  try {
    const phoneNumberId = await resolveSendingPhoneNumberId(organizationId)
    const { messageId } = await callGraphApi(apiBody, phoneNumberId)
    logOutboundMessage(organizationId, phone, messageType, messageId, logBody)
    return { success: true, messageId }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    // Never swallow send failures silently — this is the only place the
    // Graph API error surfaces.
    console.error(`[meta-api] send failed: ${error}`, {
      org_id: organizationId,
      message_type: messageType,
      env_pid: (process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '').trim() || 'UNSET',
      token_prefix: (process.env.META_WHATSAPP_ACCESS_TOKEN ?? '').slice(0, 10) || 'UNSET',
    })
    return { success: false, error }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Forwards an already-assembled Meta message body (type + type-specific payload)
// straight to the Graph API. Used by the /api/whatsapp/send callback, where n8n
// hands us a fully-built interactive/text/template object. Merges the envelope
// fields (messaging_product/recipient_type/to) and logs the outbound message.
export async function sendRawMessage(
  phone: string,
  message: { type: MessageType; [key: string]: unknown },
  organizationId: string
): Promise<SendResult> {
  const apiBody: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    ...message,
  }

  // Best-effort human-readable body for the log row.
  let logBody: string | undefined
  if (message.type === 'text') {
    logBody = (message.text as { body?: string } | undefined)?.body
  } else if (message.type === 'interactive') {
    logBody = (message.interactive as { body?: { text?: string } } | undefined)?.body?.text
  } else if (message.type === 'template') {
    logBody = (message.template as { name?: string } | undefined)?.name
  }

  return sendAndLog(organizationId, phone, message.type, apiBody, logBody)
}

export async function sendTextMessage(
  phone: string,
  text: string,
  organizationId: string
): Promise<SendResult> {
  return sendAndLog(
    organizationId,
    phone,
    'text',
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { body: text },
    },
    text
  )
}

export async function sendQuickReplyButtons(
  phone: string,
  body: string,
  buttons: Button[],
  organizationId: string
): Promise<SendResult> {
  return sendAndLog(
    organizationId,
    phone,
    'interactive',
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    },
    body
  )
}

export async function sendListMessage(
  phone: string,
  body: string,
  sections: Section[],
  organizationId: string
): Promise<SendResult> {
  // Cap at 10 total items across all sections (WhatsApp limit)
  let remaining = 10
  const cappedSections: Section[] = []
  for (const section of sections) {
    if (remaining <= 0) break
    const rows = section.rows.slice(0, remaining)
    cappedSections.push({ title: section.title, rows })
    remaining -= rows.length
  }

  return sendAndLog(
    organizationId,
    phone,
    'interactive',
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: 'Select',
          sections: cappedSections,
        },
      },
    },
    body
  )
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[],
  organizationId: string
): Promise<SendResult> {
  return sendAndLog(
    organizationId,
    phone,
    'template',
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    },
    templateName
  )
}
