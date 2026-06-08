import { z } from 'zod'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
  forceModel?: 'deepseek' | 'qwen'
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
}

export interface AIResponse {
  content: string
  model: string
  usage: AIUsage
}

export interface ModelRouterDecision {
  model: 'deepseek' | 'qwen'
  reason: 'forced' | 'high_complexity' | 'standard'
}

export interface EvalResult {
  score: number
  flags: string[]
  reasoning: string
}

// ─── Intent + Entity types ────────────────────────────────────────────────────

export type IntentType =
  | 'NEW_ORDER'
  | 'ORDER_STATUS'
  | 'VENDOR_ORDER'
  | 'PRODUCTION_UPDATE'
  | 'INVOICE_REQUEST'
  | 'PAYMENT_UPDATE'
  | 'INVENTORY_CHECK'
  | 'COMPLIANCE_QUERY'
  | 'GENERAL_QUERY'
  | 'UNKNOWN'

export type DetectedLanguage = 'gujarati' | 'hindi' | 'hinglish' | 'english'

export type EntityType =
  | 'customer_name'
  | 'vendor_name'
  | 'product_name'
  | 'quantity'
  | 'unit'
  | 'price'
  | 'date'
  | 'defect_type'

export interface ExtractedEntity {
  type: EntityType
  rawValue: string
  normalizedValue?: string
  confidence: number
}

export interface IntentResult {
  intent: IntentType
  confidence: number
  rawMessage: string
  language: DetectedLanguage
}

export interface EntityResult {
  entities: ExtractedEntity[]
  confidence: number
  reasoning: string
}

export interface OrgContext {
  orgId: string
  customers: Array<{ id: string; name: string; aliases?: string[] }>
  products: Array<{ id: string; name: string; aliases?: string[] }>
  vendors: Array<{ id: string; name: string; aliases?: string[] }>
}

export interface ModelResponse {
  content: string
  model: string
  tokens: { prompt: number; completion: number }
  latencyMs: number
}

// ─── Zod schemas for validating raw AI JSON responses ─────────────────────────

const INTENT_VALUES = [
  'NEW_ORDER',
  'ORDER_STATUS',
  'VENDOR_ORDER',
  'PRODUCTION_UPDATE',
  'INVOICE_REQUEST',
  'PAYMENT_UPDATE',
  'INVENTORY_CHECK',
  'COMPLIANCE_QUERY',
  'GENERAL_QUERY',
] as const

const LANGUAGE_VALUES = ['gujarati', 'hindi', 'hinglish', 'english'] as const

export const DeepSeekRawEntitiesSchema = z.object({
  customer_name_raw: z.string().nullable().optional(),
  vendor_name_raw: z.string().nullable().optional(),
  product_raw: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  delivery_date_raw: z.string().nullable().optional(),
  price_raw: z.number().nullable().optional(),
  defect_type: z.string().nullable().optional(),
})

export const DeepSeekClassifyResponseSchema = z.object({
  intent: z.enum(INTENT_VALUES).catch('GENERAL_QUERY' as const),
  confidence: z.number().min(0).max(1),
  entities: DeepSeekRawEntitiesSchema,
  language_detected: z.enum(LANGUAGE_VALUES).catch('english' as const),
  original_normalized: z.string(),
})

export type DeepSeekClassifyResponse = z.infer<typeof DeepSeekClassifyResponseSchema>
