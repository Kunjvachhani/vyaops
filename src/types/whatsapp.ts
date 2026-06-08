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
