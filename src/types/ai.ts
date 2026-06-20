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
  | 'MODIFY_ORDER'
  | 'CANCEL_ORDER'
  | 'ORDER_STATUS'
  | 'VENDOR_ORDER'
  | 'PRODUCTION_UPDATE'
  | 'INVOICE_REQUEST'
  | 'PAYMENT_UPDATE'
  | 'INVENTORY_CHECK'
  | 'COMPLIANCE_QUERY'
  | 'GENERAL_QUERY'
  | 'UNKNOWN'

// ─── Owner-reply classifier ───────────────────────────────────────────────────

export type OwnerReplySignal = 'AFFIRM' | 'DECLINE' | 'UNRELATED'

export interface OwnerReplyClassification {
  signal: OwnerReplySignal
  confidence: number
}

// ─── Confirmation parser ──────────────────────────────────────────────────────

export interface ConfirmationParseResult {
  confirmed: boolean
  promisedDate: string | null  // ISO date YYYY-MM-DD or null
  cancel: boolean
}

// ─── Modification parser ──────────────────────────────────────────────────────

export type ModificationMode = 'add' | 'replace' | 'ambiguous'

export interface ModificationParseResult {
  mode: ModificationMode
  newQuantity: number
  confidence: number
}

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
  'MODIFY_ORDER',
  'CANCEL_ORDER',
  'ORDER_STATUS',
  'VENDOR_ORDER',
  'PRODUCTION_UPDATE',
  'INVOICE_REQUEST',
  'PAYMENT_UPDATE',
  'INVENTORY_CHECK',
  'COMPLIANCE_QUERY',
  'GENERAL_QUERY',
] as const

export const OwnerReplyClassificationSchema = z.object({
  signal: z.enum(['AFFIRM', 'DECLINE', 'UNRELATED']),
  confidence: z.number().min(0).max(1),
})

export const ConfirmationParseResultSchema = z.object({
  confirmed: z.boolean(),
  promised_date: z.string().nullable(),
  cancel: z.boolean(),
})

export const ModificationParseResultSchema = z.object({
  mode: z.enum(['add', 'replace', 'ambiguous']),
  new_quantity: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
})

const LANGUAGE_VALUES = ['gujarati', 'hindi', 'hinglish', 'english'] as const

/**
 * Coerce helper: accepts number OR numeric string, returns number | null.
 * DeepSeek sometimes returns quantity/price as a string ("500" instead of 500).
 * Without this, the Zod parse throws and discards the entire extraction.
 */
const coerceNumeric = z.union([
  z.number(),
  z.string().transform((s) => {
    const n = Number(s)
    return isNaN(n) ? null : n
  }),
]).nullable().optional()

export const DeepSeekRawEntitiesSchema = z.object({
  customer_name_raw: z.string().nullable().optional(),
  vendor_name_raw: z.string().nullable().optional(),
  product_raw: z.string().nullable().optional(),
  quantity: coerceNumeric,
  unit: z.string().nullable().optional(),
  delivery_date_raw: z.string().nullable().optional(),
  price_raw: coerceNumeric,
  defect_type: z.string().nullable().optional(),
  order_ref_raw: z.string().nullable().optional(),
})

export const DeepSeekClassifyResponseSchema = z.object({
  intent: z.enum(INTENT_VALUES).catch('GENERAL_QUERY' as const),
  confidence: z.number().min(0).max(1),
  entities: DeepSeekRawEntitiesSchema,
  language_detected: z.enum(LANGUAGE_VALUES).catch('english' as const),
  original_normalized: z.string(),
})

export type DeepSeekClassifyResponse = z.infer<typeof DeepSeekClassifyResponseSchema>

// ─── Eval gate types ──────────────────────────────────────────────────────────

export type EvalGateDecision = 'auto_process' | 'confirm' | 'clarify' | 'reject_show_menu'

export interface PerDimensionScores {
  intent_correctness: number
  entity_accuracy: number
  entity_completeness: number
  match_confidence: number
  language_understanding: number
}

export interface EvaluateExtractionResult {
  compositeScore: number
  perDimensionScores: PerDimensionScores
  reasoning: string
  failureCodes: string[]
  decision: EvalGateDecision
  // Token usage of the eval-gate LLM call. Present when the eval ran against the
  // model; absent on the fallback path (eval gate unavailable).
  usage?: AIUsage
}

export interface ExtractionInput {
  intent: IntentResult
  entities: EntityResult
}

export interface RouteAndProcessResult {
  decision: EvalGateDecision
  intent: IntentResult
  entities: EntityResult
  evalResult: EvaluateExtractionResult
  modelUsed: 'deepseek' | 'qwen'
}

export const QwenEvalResponseSchema = z.object({
  intent_correctness: z.number().min(0).max(1),
  entity_accuracy: z.number().min(0).max(1),
  entity_completeness: z.number().min(0).max(1),
  match_confidence: z.number().min(0).max(1),
  language_understanding: z.number().min(0).max(1),
  reasoning: z.string(),
  failure_codes: z.array(z.string()).default([]),
})

export type QwenEvalResponse = z.infer<typeof QwenEvalResponseSchema>

// ─── Dialect Dictionary types ────────────────────────────────────────────────

export interface DialectLookupParams {
  message: string
  orgId: string
  industrySegment: string
}

export interface ResolvedToken {
  token: string
  canonical: string
  tier: 1 | 2 | 3 | 4 | 5
  category: string
  confidence: number
}

export interface PreStructuredHints {
  quantity?: number
  customer_hint?: string
  product_hint?: string
  intent_hint?: IntentType
}

export interface DialectLookupResult {
  resolved_tokens: ResolvedToken[]
  pre_structured: PreStructuredHints
  unresolved_tokens: string[]
  raw_message: string
  lookup_time_ms: number
}

// ─── Dialect Learning types ──────────────────────────────────────────────────

export interface CorrectionParams {
  rawMessage: string
  aiExtraction: DeepSeekClassifyResponse
  ownerCorrection: Record<string, unknown>
  orgId: string
  industrySegment: string
  orgDictionarySummary: string
}

export interface NewDialectMapping {
  term: string
  canonical: string
  category: string
  likely_scope: 'org' | 'industry' | 'global'
}

export interface CorrectionAnalysis {
  is_dialect_issue: boolean
  new_mappings: NewDialectMapping[]
  reasoning: string
}

export const CorrectionAnalysisSchema = z.object({
  is_dialect_issue: z.boolean(),
  new_mappings: z.array(z.object({
    term: z.string(),
    canonical: z.string(),
    category: z.string(),
    likely_scope: z.enum(['org', 'industry', 'global']),
  })),
  reasoning: z.string(),
})

export interface OnboardingDictParams {
  orgId: string
  industrySegment: string
  products: Array<{ id: string; name: string }>
  customers: Array<{ id: string; name: string }>
  languagePreference: string
}

export interface OnboardingDictResult {
  products: Array<{ name: string; aliases: string[] }>
  customers: Array<{ name: string; aliases: string[] }>
}

export const OnboardingDictResultSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    aliases: z.array(z.string()),
  })),
  customers: z.array(z.object({
    name: z.string(),
    aliases: z.array(z.string()),
  })),
})
