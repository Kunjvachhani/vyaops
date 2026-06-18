/**
 * WhatsApp template names — must match exactly what's approved on Meta.
 * Grouped by when they're used: reactive (triggered by events) vs
 * proactive (cron-scheduled).
 */

// Reactive templates (sent in response to specific events)
export const REACTIVE_TEMPLATES = {
  ORDER_CONFIRMATION: 'order_confirmation',
  ORDER_COMPLETED: 'order_completed',
  INVOICE_GENERATED: 'invoice_generated',
  PAYMENT_RECEIVED: 'payment_received',
  PRODUCTION_LOGGED: 'production_logged',
  INVENTORY_ALERT: 'inventory_alert',
} as const

// Proactive templates (sent by cron workflows to the OWNER)
export const PROACTIVE_TEMPLATES = {
  DAILY_MORNING_SUMMARY: 'daily_morning_summary',
  DAILY_EVENING_SUMMARY: 'daily_evening_summary',
  COMPLIANCE_REMINDER: 'compliance_reminder',
} as const

// Tiered payment reminders (sent to CUSTOMERS by cron)
export const PAYMENT_REMINDER_TEMPLATES = {
  GENTLE: 'payment_reminder_gentle',
  FOLLOWUP: 'payment_reminder_followup',
  URGENT: 'payment_reminder_urgent',
  FINAL: 'payment_reminder_final',
} as const

// Authentication
export const AUTH_TEMPLATES = {
  OTP_VERIFICATION: 'otp_verification',
} as const

// Gujarati template names that do NOT follow the `<base>_gujarati` convention.
// `inventory_alert`'s Gujarati variant is registered on Meta as
// `inventory_alert_gujaratii` (double trailing 'i') — this spelling is
// intentional and kept as-is, so we map to it explicitly rather than
// "correcting" it to a name that doesn't exist on Meta.
const GUJARATI_NAME_OVERRIDES: Record<string, string> = {
  inventory_alert: 'inventory_alert_gujaratii',
}

// Gujarati suffixed names — append '_gujarati' to any template name
// when org.language_preference === 'gu' (or use an explicit override above).
export function templateNameForLocale(
  baseName: string,
  locale: 'en' | 'gu' | 'hi'
): string {
  if (locale === 'gu') return GUJARATI_NAME_OVERRIDES[baseName] ?? `${baseName}_gujarati`
  // Hindi templates not yet submitted to Meta — fall back to English
  return baseName
}

// Meta language codes for the template API
export function metaLanguageCode(locale: 'en' | 'gu' | 'hi'): string {
  switch (locale) {
    case 'gu': return 'gu'
    case 'hi': return 'hi'
    default: return 'en'
  }
}
