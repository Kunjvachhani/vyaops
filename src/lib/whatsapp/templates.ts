export const WhatsAppTemplate = {
  ORDER_CONFIRMED: 'order_confirmed',
  INVOICE_READY: 'invoice_ready',
  PAYMENT_RECEIVED: 'payment_received',
  DISPATCH_UPDATED: 'dispatch_updated',
  QUALITY_REPORT: 'quality_report',
  OTP_LOGIN: 'otp_login',
} as const

export type WhatsAppTemplateName =
  (typeof WhatsAppTemplate)[keyof typeof WhatsAppTemplate]
