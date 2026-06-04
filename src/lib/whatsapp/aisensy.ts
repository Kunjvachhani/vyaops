import { createHmac } from 'crypto'

const AISENSY_BASE_URL = 'https://backend.aisensy.com/campaign/t1/api/v2'

export function verifyAiSensySignature(
  payload: string,
  signature: string
): boolean {
  const expected = createHmac('sha256', process.env.AISENSY_WEBHOOK_SECRET ?? '')
    .update(payload)
    .digest('hex')
  return expected === signature
}

export async function sendWhatsAppMessage(
  phone: string,
  templateName: string,
  params: string[]
): Promise<void> {
  const res = await fetch(AISENSY_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${process.env.AISENSY_API_KEY}`,
    },
    body: JSON.stringify({
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: templateName,
      destination: phone,
      userName: 'VyaOps',
      templateParams: params,
      source: 'new-landing-page form',
      media: {},
      buttons: [],
      carouselCards: [],
      location: {},
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`AiSensy error ${res.status}: ${body}`)
  }
}
