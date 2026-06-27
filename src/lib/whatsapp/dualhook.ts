// Dualhook tech-provider REST client.
//
// Under Coexistence, Dualhook is the Meta Tech Provider: WhatsApp Embedded Signup
// runs against *their* Meta app, and the short-lived auth `code` returned by the
// Facebook JS SDK is exchanged for the WABA token on Dualhook's side (their app
// secret is never exposed to us — see WHATSAPP_COEXISTENCE.md). We forward the
// signup result here so Dualhook can finalize the connection (token exchange +
// app/echo subscription) and return the verified number details.

import { captureWithContext } from '@/lib/utils/sentry'

const DEFAULT_BASE = 'https://api.dualhook.com/v1'

function baseUrl(): string {
  return (process.env.DUALHOOK_API_BASE || DEFAULT_BASE).replace(/\/+$/, '')
}

export type DualhookConnectResult = {
  phoneNumberId: string
  displayPhoneNumber: string | null
  wabaId: string | null
  verifiedName: string | null
}

export type FinalizeParams = {
  code: string
  phoneNumberId: string
  wabaId: string | null
}

/**
 * Finalize an Embedded Signup with Dualhook.
 * Throws on missing config or a non-2xx response.
 */
export async function finalizeEmbeddedSignup(
  params: FinalizeParams
): Promise<DualhookConnectResult> {
  const apiKey = process.env.DUALHOOK_API_KEY
  if (!apiKey) throw new Error('DUALHOOK_API_KEY not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(`${baseUrl()}/embedded-signup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: params.code,
        phone_number_id: params.phoneNumberId,
        waba_id: params.wabaId,
        // Ensure inbound + owner-echo delivery the moment the number connects.
        subscribe_fields: ['messages', 'smb_message_echoes', 'message_echoes'],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Dualhook finalize failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

    // Be tolerant of field-name variants in Dualhook's response; the Embedded
    // Signup message event already gave us a reliable phone_number_id, so fall
    // back to the request value when the response omits it.
    const phoneNumberId =
      (json.phone_number_id as string) ??
      (json.phoneNumberId as string) ??
      params.phoneNumberId

    return {
      phoneNumberId,
      displayPhoneNumber:
        (json.display_phone_number as string) ?? (json.displayPhoneNumber as string) ?? null,
      wabaId:
        (json.waba_id as string) ?? (json.wabaId as string) ?? params.wabaId ?? null,
      verifiedName:
        (json.verified_name as string) ?? (json.verifiedName as string) ?? null,
    }
  } catch (error) {
    captureWithContext(error, { action: 'dualhook/finalizeEmbeddedSignup' })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
