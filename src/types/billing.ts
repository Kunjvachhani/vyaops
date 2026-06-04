export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired'

export interface RazorpaySubscription {
  id: string
  plan_id: string
  status: SubscriptionStatus
  current_start: number
  current_end: number
  ended_at: number | null
  quantity: number
  total_count: number
  paid_count: number
}

export interface RazorpayPaymentEntity {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  order_id: string
  invoice_id: string | null
  subscription_id: string | null
  method: string
  captured: boolean
  created_at: number
}

export interface RazorpayWebhookEvent {
  entity: string
  account_id: string
  event: string
  contains: string[]
  payload: {
    subscription?: { entity: RazorpaySubscription }
    payment?: { entity: RazorpayPaymentEntity }
  }
  created_at: number
}
