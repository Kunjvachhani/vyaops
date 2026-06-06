import { createHmac, timingSafeEqual } from 'crypto'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export function verifyMetaSignature(
  payload: string,
  signatureHeader: string
): boolean {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET ?? ''
  const expected = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

async function callGraphApi(
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? ''
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN ?? ''
  const url = `${GRAPH_API_BASE}/${phoneNumberId}${path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = (await res.json()) as {
      error?: { message?: string; code?: number; error_subcode?: number }
    }
    const msg = data.error?.message ?? 'Unknown error'
    const code = data.error?.code ?? res.status
    const sub = data.error?.error_subcode
    throw new Error(`Meta API error ${code}${sub ? `/${sub}` : ''}: ${msg}`)
  }
}

export async function sendTextMessage(
  phone: string,
  text: string
): Promise<void> {
  await callGraphApi('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { body: text },
  })
}

export async function sendQuickReplyButtons(
  phone: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  await callGraphApi('/messages', {
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
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  })
}

export async function sendListMessage(
  phone: string,
  body: string,
  buttonLabel: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
): Promise<void> {
  await callGraphApi('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: sections.map((s) => ({
          title: s.title,
          rows: s.rows.slice(0, 10),
        })),
      },
    },
  })
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  components: Array<{
    type: string
    parameters: Array<{ type: string; text?: string }>
  }>
): Promise<void> {
  await callGraphApi('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  })
}
