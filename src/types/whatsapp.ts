// ─── Outbound message building blocks ────────────────────────────────────────

export interface Button {
  id: string
  title: string // max 20 chars (WhatsApp limit)
}

export interface ListItem {
  id: string
  title: string
  description?: string
}

export interface Section {
  title: string
  rows: ListItem[]
}

export type TemplateComponentType = 'header' | 'body' | 'button'
export type TemplateParameterType =
  | 'text'
  | 'image'
  | 'video'
  | 'document'
  | 'payload'
  | 'currency'
  | 'date_time'

export interface TemplateParameter {
  type: TemplateParameterType
  text?: string
  payload?: string
}

export interface TemplateComponent {
  type: TemplateComponentType
  sub_type?: 'quick_reply' | 'url'
  index?: number
  parameters: TemplateParameter[]
}

// ─── Send result ──────────────────────────────────────────────────────────────

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Meta API error shape ─────────────────────────────────────────────────────

export interface MetaErrorResponse {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

// ─── DB record (whatsapp_messages table) ─────────────────────────────────────

export type MessageType = 'text' | 'image' | 'document' | 'interactive' | 'template'

export interface WhatsAppMessageRecord {
  organization_id: string
  message_id: string
  direction: 'inbound' | 'outbound'
  sender_phone: string
  message_type: MessageType
  message_body?: string | null
  media_url?: string | null
  intent_classified?: string | null
  intent_confidence?: number | null
  eval_score?: number | null
  was_triggered?: boolean
  was_processed?: boolean
  processing_result?: Record<string, unknown> | null
}

// ─── Inbound message types ────────────────────────────────────────────────────

export type WhatsAppMessageKind =
  | 'text'
  | 'image'
  | 'document'
  | 'interactive'
  | 'button'
  | 'order'
  | 'unknown'

export interface WhatsAppContact {
  wa_id: string
  profile: { name: string }
}

export interface WhatsAppMessageContext {
  from: string
  id: string
}

export interface WhatsAppTextMessage {
  id: string
  from: string
  timestamp: string
  type: 'text'
  text: { body: string }
  context?: WhatsAppMessageContext
}

export interface WhatsAppInteractiveReply {
  id: string
  from: string
  timestamp: string
  type: 'interactive'
  interactive:
    | { type: 'button_reply'; button_reply: { id: string; title: string } }
    | { type: 'list_reply'; list_reply: { id: string; title: string } }
  context?: WhatsAppMessageContext
}

// Sent when a user taps a quick-reply button on a template message
export interface WhatsAppButtonMessage {
  id: string
  from: string
  timestamp: string
  type: 'button'
  button: { text: string; payload: string }
  context?: WhatsAppMessageContext
}

export type WhatsAppInboundMessage =
  | WhatsAppTextMessage
  | WhatsAppInteractiveReply
  | WhatsAppButtonMessage

export interface WhatsAppStatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

export interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: WhatsAppContact[]
        messages?: WhatsAppInboundMessage[]
        statuses?: WhatsAppStatusUpdate[]
      }
      field: string
    }>
  }>
}
