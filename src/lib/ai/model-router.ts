import { callDeepSeek } from './deepseek'
import { callOpenRouter } from './openrouter'
import type { AIRequest, AIResponse, ModelRouterDecision } from '@/types/ai'

const COMPLEX_KEYWORDS = [
  'calculate', 'analyze', 'compare', 'forecast', 'predict',
  'explain why', 'audit', 'compliance', 'legal', 'gst', 'tax',
]

function scoreComplexity(request: AIRequest): number {
  const text = request.messages
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const kw of COMPLEX_KEYWORDS) {
    if (text.includes(kw)) score += 1
  }
  const tokenEstimate = text.length / 4
  if (tokenEstimate > 500) score += 1
  if (tokenEstimate > 1500) score += 1

  return score
}

export function decideModel(request: AIRequest): ModelRouterDecision {
  if (request.forceModel) {
    return { model: request.forceModel, reason: 'forced' }
  }
  const complexity = scoreComplexity(request)
  if (complexity >= 3) {
    return { model: 'qwen', reason: 'high_complexity' }
  }
  return { model: 'deepseek', reason: 'standard' }
}

export async function routeAI(request: AIRequest): Promise<AIResponse> {
  const decision = decideModel(request)

  try {
    if (decision.model === 'qwen') {
      return await callOpenRouter(request)
    }
    return await callDeepSeek(request)
  } catch (primaryError) {
    // Fallback to the other model on primary failure
    try {
      if (decision.model === 'qwen') {
        return await callDeepSeek(request)
      }
      return await callOpenRouter(request)
    } catch {
      throw primaryError
    }
  }
}
