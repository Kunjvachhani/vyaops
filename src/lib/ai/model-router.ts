import { callDeepSeek, classifyIntent, extractEntities, CLASSIFY_SYSTEM_PROMPT } from './deepseek'
import { callOpenRouter } from './openrouter'
import { evaluateExtraction, routeByScore } from './eval-gate'
import { matchCustomer, matchProduct } from '@/lib/utils/fuzzy-match'
import { DeepSeekClassifyResponseSchema } from '@/types/ai'
import type {
  AIRequest,
  AIResponse,
  ModelRouterDecision,
  OrgContext,
  IntentResult,
  IntentType,
  EntityResult,
  ExtractedEntity,
  EvalGateDecision,
  RouteAndProcessResult,
  EvaluateExtractionResult,
} from '@/types/ai'

const QWEN_MODEL = 'qwen/qwen3-235b-a22b'

// Signals that indicate complex reasoning: multi-step, ambiguous, or Qwen-only territory
const COMPLEX_KEYWORDS = [
  'calculate', 'analyze', 'compare', 'forecast', 'predict',
  'explain why', 'audit', 'compliance', 'legal', 'gst', 'tax',
]

// Vague/ambiguous quantity words across Gujarati/Hindi/English
const AMBIGUOUS_QUANTITY_WORDS = [
  'kuch', 'thoda', 'thodi', 'kaafi', 'bahut', 'zyada', 'kam',
  'some', 'few', 'several', 'many', 'lot',
]

function scoreComplexity(request: AIRequest): number {
  const text = request.messages.map((m) => m.content).join(' ').toLowerCase()

  let score = 0

  for (const kw of COMPLEX_KEYWORDS) {
    if (text.includes(kw)) score += 1
  }

  // Ambiguous quantity words — model may mis-extract
  for (const word of AMBIGUOUS_QUANTITY_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      score += 2
      break
    }
  }

  // Multiple product/quantity patterns (comma-separated or "and" between items)
  const multiItemPattern = /\d+\s*(?:pcs?|pieces?|units?|kg|nos?)[,\s]+(?:and\s+)?\d+/i
  if (multiItemPattern.test(text)) score += 2

  // Long message — more likely to be complex / multi-intent
  const tokenEstimate = text.length / 4
  if (tokenEstimate > 500) score += 1
  if (tokenEstimate > 1500) score += 2

  return score
}

export function decideModel(request: AIRequest): ModelRouterDecision {
  if (request.forceModel) {
    return { model: request.forceModel, reason: 'forced' }
  }
  if (scoreComplexity(request) >= 3) {
    return { model: 'qwen', reason: 'high_complexity' }
  }
  return { model: 'deepseek', reason: 'standard' }
}

export async function routeAI(request: AIRequest): Promise<AIResponse> {
  const decision = decideModel(request)

  try {
    return decision.model === 'qwen'
      ? await callOpenRouter({ ...request, model: QWEN_MODEL })
      : await callDeepSeek(request)
  } catch {
    // Primary model failed — fall back to the other
    try {
      return decision.model === 'qwen'
        ? await callDeepSeek(request)
        : await callOpenRouter({ ...request, model: QWEN_MODEL })
    } catch (fallbackError) {
      // Both models failed — surface the error, never silently fail
      throw fallbackError
    }
  }
}

// Uses the same system prompt as deepseek.ts but calls Qwen via OpenRouter
async function classifyAndExtractViaQwen(
  message: string,
  orgContext: OrgContext
): Promise<{ intent: IntentResult; entities: EntityResult }> {
  const contextLines: string[] = []
  if (orgContext.customers.length)
    contextLines.push(`Known customers: ${orgContext.customers.map((c) => c.name).join(', ')}`)
  if (orgContext.products.length)
    contextLines.push(`Known products: ${orgContext.products.map((p) => p.name).join(', ')}`)
  if (orgContext.vendors.length)
    contextLines.push(`Known vendors: ${orgContext.vendors.map((v) => v.name).join(', ')}`)

  const userContent = contextLines.length
    ? `${contextLines.join('\n')}\n\nMessage: ${message}`
    : `Message: ${message}`

  const response = await callOpenRouter({
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    model: QWEN_MODEL,
    temperature: 0.1,
    maxTokens: 512,
  })

  const raw = JSON.parse(response.content) as unknown
  const parsed = DeepSeekClassifyResponseSchema.parse(raw)

  const e = parsed.entities
  const entities: ExtractedEntity[] = []

  if (e.customer_name_raw)
    entities.push({ type: 'customer_name', rawValue: e.customer_name_raw, confidence: parsed.confidence })
  if (e.vendor_name_raw)
    entities.push({ type: 'vendor_name', rawValue: e.vendor_name_raw, confidence: parsed.confidence })
  if (e.product_raw)
    entities.push({ type: 'product_name', rawValue: e.product_raw, confidence: parsed.confidence })
  if (e.quantity != null)
    entities.push({ type: 'quantity', rawValue: String(e.quantity), confidence: parsed.confidence })
  if (e.unit)
    entities.push({ type: 'unit', rawValue: e.unit, confidence: parsed.confidence })
  if (e.price_raw != null)
    entities.push({ type: 'price', rawValue: String(e.price_raw), confidence: parsed.confidence })
  if (e.delivery_date_raw)
    entities.push({ type: 'date', rawValue: e.delivery_date_raw, confidence: parsed.confidence })
  if (e.defect_type)
    entities.push({ type: 'defect_type', rawValue: e.defect_type, confidence: parsed.confidence })

  return {
    intent: {
      intent: parsed.intent,
      confidence: parsed.confidence,
      rawMessage: message,
      language: parsed.language_detected,
    },
    entities: {
      entities,
      confidence: parsed.confidence,
      reasoning: parsed.original_normalized,
    },
  }
}

// Fallback eval result when the eval gate API itself fails.
// Always routes to 'confirm' — NEVER auto-processes without a successful eval.
function buildFallbackEvalResult(): EvaluateExtractionResult {
  const fallbackScore = 0.72 // lands in 'confirm' band
  return {
    compositeScore: fallbackScore,
    perDimensionScores: {
      intent_correctness: fallbackScore,
      entity_accuracy: fallbackScore,
      entity_completeness: fallbackScore,
      match_confidence: fallbackScore,
      language_understanding: fallbackScore,
    },
    reasoning: 'Eval gate unavailable — defaulting to confirm for safety',
    failureCodes: ['EVAL_GATE_UNAVAILABLE'],
    decision: routeByScore(fallbackScore),
  }
}

// Decision severity ordering. Used to CAP (downgrade) routing — never to escalate.
const DECISION_RANK: Record<EvalGateDecision, number> = {
  reject_show_menu: 0,
  clarify: 1,
  confirm: 2,
  auto_process: 3,
}

function capDecision(decision: EvalGateDecision, max: EvalGateDecision): EvalGateDecision {
  return DECISION_RANK[decision] > DECISION_RANK[max] ? max : decision
}

// Order intents require a resolved counterparty (+ product) before we ever
// reach 'confirm' or 'auto_process'. Note: 'auto_process' means "post draft
// immediately" in the new model — it NEVER means "skip the owner's ok".
// Sales orders need a customer; purchases need a vendor.
const CUSTOMER_ORDER_INTENTS = new Set<IntentType>(['NEW_ORDER', 'MODIFY_ORDER', 'CANCEL_ORDER'])
const VENDOR_ORDER_INTENTS = new Set<IntentType>(['VENDOR_ORDER'])

type ResolutionFlags = {
  customerResolved: boolean
  productResolved: boolean
  hasVendor: boolean
}

// Layer 4 of the Data Alignment Engine: resolve raw customer/product names
// against master data via fuzzy matching, annotating each entity in place with
// the canonical name (normalizedValue) and the match confidence. Failures leave
// the entity unresolved so the safety gate holds the message for confirmation.
async function resolveEntities(orgId: string, entities: EntityResult): Promise<ResolutionFlags> {
  const customer = entities.entities.find((e) => e.type === 'customer_name')
  const product = entities.entities.find((e) => e.type === 'product_name')
  const hasVendor = entities.entities.some((e) => e.type === 'vendor_name')

  let customerResolved = false
  let productResolved = false

  if (customer) {
    try {
      const m = await matchCustomer(orgId, customer.rawValue)
      customer.confidence = m.confidence
      if (m.match) {
        customer.normalizedValue = m.match.name
        customerResolved = true
      }
    } catch {
      // matcher/DB failure — leave unresolved; the gate downgrades to 'clarify'
    }
  }

  if (product) {
    try {
      const m = await matchProduct(orgId, product.rawValue)
      product.confidence = m.confidence
      if (m.match) {
        product.normalizedValue = m.match.name
        productResolved = true
      }
    } catch {
      // leave unresolved
    }
  }

  return { customerResolved, productResolved, hasVendor }
}

// Deterministic safety gate over the eval-gate's decision. An order can only
// reach 'confirm'/'auto_process' when its required entities actually resolved —
// regardless of how generously the eval LLM scored the extraction.
function applyOrderSafetyGate(
  intent: IntentType,
  decision: EvalGateDecision,
  resolution: ResolutionFlags
): EvalGateDecision {
  if (CUSTOMER_ORDER_INTENTS.has(intent) && (!resolution.customerResolved || !resolution.productResolved)) {
    return capDecision(decision, 'clarify')
  }
  if (VENDOR_ORDER_INTENTS.has(intent) && (!resolution.hasVendor || !resolution.productResolved)) {
    return capDecision(decision, 'clarify')
  }
  return decision
}

export async function routeAndProcess(
  message: string,
  orgContext: OrgContext
): Promise<RouteAndProcessResult> {
  // Step 1: pick model based on message complexity
  const complexity = scoreComplexity({
    messages: [{ role: 'user', content: message }],
  })
  const modelUsed: 'deepseek' | 'qwen' = complexity >= 3 ? 'qwen' : 'deepseek'

  // Step 2: classify intent + extract entities (with cross-model fallback)
  let intent: IntentResult
  let entities: EntityResult

  try {
    if (modelUsed === 'qwen') {
      ;({ intent, entities } = await classifyAndExtractViaQwen(message, orgContext))
    } else {
      ;[intent, entities] = await Promise.all([
        classifyIntent(message, orgContext),
        extractEntities(message, '', orgContext),
      ])
    }
  } catch {
    // Primary model failed — fall back to the other
    try {
      if (modelUsed === 'qwen') {
        ;[intent, entities] = await Promise.all([
          classifyIntent(message, orgContext),
          extractEntities(message, '', orgContext),
        ])
      } else {
        ;({ intent, entities } = await classifyAndExtractViaQwen(message, orgContext))
      }
    } catch (fallbackError) {
      throw fallbackError
    }
  }

  // Step 2b: Layer 4 — resolve names to master data (annotates entities in place)
  const resolution = await resolveEntities(orgContext.orgId, entities)

  // Step 3: run eval gate (always Qwen, always cross-model from DeepSeek generator).
  // Entities now carry normalizedValue, so the evaluator scores match_confidence
  // against the resolved canonical names instead of the raw extracted text.
  let evalResult: EvaluateExtractionResult

  try {
    evalResult = await evaluateExtraction(
      message,
      { intent, entities },
      orgContext.customers,
      orgContext.products
    )
  } catch {
    // Eval gate API failed — default to 'confirm', never auto-process
    evalResult = buildFallbackEvalResult()
  }

  // Step 4: deterministic safety gate. Orders missing a resolved counterparty or
  // product can never auto-process/confirm, no matter the eval score.
  const decision = applyOrderSafetyGate(intent.intent, evalResult.decision, resolution)

  return {
    decision,
    intent,
    entities,
    evalResult,
    modelUsed,
  }
}
