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

async function callGraphApi(
  body: Record<string, unknown>
): Promise<{ messageId: string }> {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? ''
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN ?? ''
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`

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
    const { messageId } = await callGraphApi(apiBody)
    logOutboundMessage(organizationId, phone, messageType, messageId, logBody)
    return { success: true, messageId }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    // Never swallow send failures silently — this is the only place the
    // Graph API error surfaces.
    console.error(`[meta-api] send failed: ${error}`, {
      org_id: organizationId,
      message_type: messageType,
      phone_number_id: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? 'UNSET',
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
