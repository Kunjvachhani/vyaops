import { createHmac } from 'crypto'

export function verifyRazorpayWebhook(
  payload: string,
  signature: string
): boolean {
  const expected = createHmac(
    'sha256',
    process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
  )
    .update(payload)
    .digest('hex')
  return expected === signature
}

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured')
  }
  return { keyId, keySecret }
}
