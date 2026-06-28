import type { AIRequest, AIResponse } from '@/types/ai'
import { logAiUsage } from './usage-logger'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_RETRIES = 3
const TIMEOUT_MS = 30_000
const QWEN_MODEL = 'qwen/qwen-2.5-72b-instruct'

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      return fetchWithRetry(url, init, attempt + 1)
    }
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      return fetchWithRetry(url, init, attempt + 1)
    }
    throw err
  }
}

export async function callOpenRouter(request: AIRequest): Promise<AIResponse> {
  const start = Date.now()
  const requestedModel = request.model ?? QWEN_MODEL
  try {
    const res = await fetchWithRetry(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'VyaOps',
        },
        body: JSON.stringify({
          model: requestedModel,
          messages: request.messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 4096,
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenRouter error ${res.status}: ${body}`)
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number }
      model: string
    }

    logAiUsage({
      provider: 'openrouter',
      model: data.model,
      feature: request.logContext?.feature,
      orgId: request.logContext?.orgId,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      latencyMs: Date.now() - start,
      success: true,
    })

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
    }
  } catch (err) {
    logAiUsage({
      provider: 'openrouter',
      model: requestedModel,
      feature: request.logContext?.feature,
      orgId: request.logContext?.orgId,
      latencyMs: Date.now() - start,
      success: false,
      errorCode: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    })
    throw err
  }
}
