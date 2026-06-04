import type { AIRequest, AIResponse } from '@/types/ai'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const MAX_RETRIES = 3
const TIMEOUT_MS = 30_000

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

export async function callDeepSeek(request: AIRequest): Promise<AIResponse> {
  const res = await fetchWithRetry(
    `${DEEPSEEK_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 2048,
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number }
  }

  return {
    content: data.choices[0].message.content,
    model: 'deepseek-chat',
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    },
  }
}
