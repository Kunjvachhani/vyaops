import * as Sentry from '@sentry/nextjs'

export type ErrorContext = {
  /** Short label used as a Sentry tag — e.g. 'GET /api/orders', 'flow-engine/insert'. */
  action: string
  org_id?: string
  user_role?: string
  [key: string]: unknown
}

// Mask phone: keep 2-char country prefix + XXXX + last 4 digits.
// e.g. 919876543210 → 91XXXX3210
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 6) return 'XXXX'
  const prefix = digits.length > 10 ? digits.slice(0, 2) : ''
  return `${prefix}XXXX${digits.slice(-4)}`
}

// Mask GSTIN: expose only the last 3 chars.
// e.g. 27AAPFU0939F1ZV → XXXXXXXXXXXX1ZV
function maskGstin(value: string): string {
  if (value.length < 4) return 'XXXX'
  return 'X'.repeat(value.length - 3) + value.slice(-3)
}

function maskContextValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value
  const k = key.toLowerCase()
  if (k.includes('phone') || k.includes('mobile')) return maskPhone(String(value))
  if (k.includes('gstin')) return maskGstin(String(value))
  if (k.includes('amount') || k.includes('paise') || k.includes('price') || k.includes('total')) return '[MASKED]'
  if (k.includes('password') || k.includes('secret')) return '[MASKED]'
  return value
}

function maskContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(ctx)) {
    result[key] = maskContextValue(key, value)
  }
  return result
}

/**
 * Captures an exception with context, masking any sensitive fields before
 * sending to Sentry. Always include at minimum `action`. Add `org_id` and
 * `user_role` whenever available — they appear as searchable Sentry tags.
 *
 * NEVER pass full phone numbers, GSTINs, or monetary amounts in the context
 * object — the masker catches common key names but is not exhaustive.
 */
export function captureWithContext(error: unknown, context: ErrorContext): void {
  const { action, org_id, user_role, ...rest } = context
  Sentry.captureException(
    error instanceof Error ? error : new Error(String(error)),
    {
      tags: {
        action,
        ...(org_id ? { org_id } : {}),
        ...(user_role ? { user_role } : {}),
      },
      extra: maskContext(rest as Record<string, unknown>),
    }
  )
}
