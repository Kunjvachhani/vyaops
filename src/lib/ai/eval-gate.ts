import { callOpenRouter } from './openrouter'
import type {
  ExtractionInput,
  EvaluateExtractionResult,
  EvalGateDecision,
  PerDimensionScores,
} from '@/types/ai'
import { QwenEvalResponseSchema } from '@/types/ai'

const QWEN_EVAL_MODEL = 'qwen/qwen3-235b-a22b'

const DIMENSION_WEIGHTS: Record<keyof PerDimensionScores, number> = {
  intent_correctness: 0.30,
  entity_accuracy: 0.25,
  match_confidence: 0.20,
  entity_completeness: 0.15,
  language_understanding: 0.10,
}

const EVAL_SYSTEM_PROMPT = `You are evaluating an AI extraction from a manufacturing factory WhatsApp message.

Score each dimension from 0.00 to 1.00:
- intent_correctness: Is the classified intent correct for this message?
- entity_accuracy: Do extracted entity values accurately reflect the message?
- entity_completeness: Are all entities required for this intent present?
- match_confidence: Are fuzzy customer/product name matches plausible given the available lists?
- language_understanding: Did the model correctly handle the input language (Gujarati/Hindi/Hinglish/English)?

Return strict JSON only — no markdown, no text outside the JSON object:
{
  "intent_correctness": 0.00,
  "entity_accuracy": 0.00,
  "entity_completeness": 0.00,
  "match_confidence": 0.00,
  "language_understanding": 0.00,
  "reasoning": "concise explanation of scores",
  "failure_codes": []
}

Valid failure_codes: WRONG_INTENT, MISSING_CUSTOMER, MISSING_PRODUCT, MISSING_QUANTITY, BAD_QUANTITY, BAD_DATE, UNRESOLVABLE_NAME, LANGUAGE_ERROR`

function computeWeightedScore(scores: PerDimensionScores): number {
  return (Object.keys(DIMENSION_WEIGHTS) as Array<keyof PerDimensionScores>).reduce(
    (sum, dim) => sum + scores[dim] * DIMENSION_WEIGHTS[dim],
    0
  )
}

export function routeByScore(score: number): EvalGateDecision {
  if (score >= 0.85) return 'auto_process'
  if (score >= 0.70) return 'confirm'
  if (score >= 0.50) return 'clarify'
  return 'reject_show_menu'
}

export async function evaluateExtraction(
  rawMessage: string,
  extraction: ExtractionInput,
  customerList: Array<{ id: string; name: string }>,
  productList: Array<{ id: string; name: string }>
): Promise<EvaluateExtractionResult> {
  const aiOutputJson = JSON.stringify(
    {
      intent: extraction.intent.intent,
      confidence: extraction.intent.confidence,
      language: extraction.intent.language,
      entities: extraction.entities.entities,
    },
    null,
    2
  )

  const userContent = [
    `Original message: "${rawMessage}"`,
    `AI extraction:\n${aiOutputJson}`,
    customerList.length ? `Available customers: ${customerList.map((c) => c.name).join(', ')}` : '',
    productList.length ? `Available products: ${productList.map((p) => p.name).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await callOpenRouter({
    messages: [
      { role: 'system', content: EVAL_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    model: QWEN_EVAL_MODEL,
    temperature: 0.1,
    maxTokens: 512,
    logContext: { feature: 'eval' },
  })

  const raw = JSON.parse(response.content) as unknown
  const parsed = QwenEvalResponseSchema.parse(raw)

  const perDimensionScores: PerDimensionScores = {
    intent_correctness: parsed.intent_correctness,
    entity_accuracy: parsed.entity_accuracy,
    entity_completeness: parsed.entity_completeness,
    match_confidence: parsed.match_confidence,
    language_understanding: parsed.language_understanding,
  }

  const compositeScore = computeWeightedScore(perDimensionScores)
  const decision = routeByScore(compositeScore)

  return {
    compositeScore,
    perDimensionScores,
    reasoning: parsed.reasoning,
    failureCodes: parsed.failure_codes,
    decision,
    usage: response.usage,
  }
}
