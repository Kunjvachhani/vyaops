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

export interface WhatsAppTextMessage {
  id: string
  from: string
  timestamp: string
  type: 'text'
  text: { body: string }
}

export interface WhatsAppInteractiveReply {
  id: string
  from: string
  timestamp: string
  type: 'interactive'
  interactive:
    | { type: 'button_reply'; button_reply: { id: string; title: string } }
    | { type: 'list_reply'; list_reply: { id: string; title: string } }
}

export type WhatsAppInboundMessage =
  | WhatsAppTextMessage
  | WhatsAppInteractiveReply

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
        statuses?: Array<{
          id: string
          status: string
          timestamp: string
          recipient_id: string
        }>
      }
      field: string
    }>
  }>
}
