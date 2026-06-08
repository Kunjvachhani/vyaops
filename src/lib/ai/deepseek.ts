import type {
  AIRequest,
  AIResponse,
  IntentResult,
  EntityResult,
  ExtractedEntity,
  OrgContext,
  ModelResponse,
} from '@/types/ai'
import { DeepSeekClassifyResponseSchema } from '@/types/ai'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const MAX_RETRIES = 3
const TIMEOUT_MS = 30_000

const CLASSIFY_SYSTEM_PROMPT = `You are an AI assistant for Indian manufacturing factories. You process WhatsApp messages in Gujarati, Hindi, Hinglish, and English.

Your task: classify the intent and extract structured data from the message.

INTENTS:
- NEW_ORDER: Customer placing a new order (keywords: order, ઓર્ડર, आर्डर, piece, pcs, deliver)
- ORDER_STATUS: Checking existing orders (keywords: status, kya hua, kidhar hai)
- VENDOR_ORDER: Placing order with supplier (keywords: vendor, supplier, kharid, mangao)
- PRODUCTION_UPDATE: Logging production data (keywords: batch, ban gaya, production, reject, defect)
- INVOICE_REQUEST: Generate or send invoice (keywords: invoice, bill, બિલ)
- PAYMENT_UPDATE: Payment received or status (keywords: payment, paisa, rupiya, UPI, transfer)
- INVENTORY_CHECK: Stock levels (keywords: stock, kitna, inventory, maal)
- GENERAL_QUERY: Anything else

RESPONSE FORMAT (strict JSON, no markdown):
{
  "intent": "NEW_ORDER",
  "confidence": 0.92,
  "entities": {
    "customer_name_raw": "rajubhai",
    "product_raw": "valve body",
    "quantity": 500,
    "unit": "pieces",
    "delivery_date_raw": "kal",
    "price_raw": null
  },
  "language_detected": "hinglish",
  "original_normalized": "rajubhai no order 500 piece valve body kal deliver"
}`

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

export async function callDeepSeekTimed(request: AIRequest): Promise<ModelResponse> {
  const start = Date.now()
  const res = await callDeepSeek(request)
  return {
    content: res.content,
    model: res.model,
    tokens: { prompt: res.usage.promptTokens, completion: res.usage.completionTokens },
    latencyMs: Date.now() - start,
  }
}

function buildOrgContextHint(orgContext: OrgContext): string {
  const customers = orgContext.customers.map((c) => c.name).join(', ')
  const products = orgContext.products.map((p) => p.name).join(', ')
  const vendors = orgContext.vendors.map((v) => v.name).join(', ')
  return [
    customers ? `Known customers: ${customers}` : '',
    products ? `Known products: ${products}` : '',
    vendors ? `Known vendors: ${vendors}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function classifyAndExtract(message: string, orgContext: OrgContext) {
  const contextHint = buildOrgContextHint(orgContext)
  const userContent = contextHint
    ? `${contextHint}\n\nMessage: ${message}`
    : `Message: ${message}`

  const response = await callDeepSeek({
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
    maxTokens: 512,
  })

  const raw = JSON.parse(response.content) as unknown
  return DeepSeekClassifyResponseSchema.parse(raw)
}

export async function classifyIntent(
  message: string,
  orgContext: OrgContext
): Promise<IntentResult> {
  const parsed = await classifyAndExtract(message, orgContext)
  return {
    intent: parsed.intent,
    confidence: parsed.confidence,
    rawMessage: message,
    language: parsed.language_detected,
  }
}

export async function extractEntities(
  message: string,
  intent: string,
  orgContext: OrgContext
): Promise<EntityResult> {
  const parsed = await classifyAndExtract(message, orgContext)
  const e = parsed.entities

  const entities: ExtractedEntity[] = []

  if (e.customer_name_raw) {
    entities.push({ type: 'customer_name', rawValue: e.customer_name_raw, confidence: parsed.confidence })
  }
  if (e.vendor_name_raw) {
    entities.push({ type: 'vendor_name', rawValue: e.vendor_name_raw, confidence: parsed.confidence })
  }
  if (e.product_raw) {
    entities.push({ type: 'product_name', rawValue: e.product_raw, confidence: parsed.confidence })
  }
  if (e.quantity != null) {
    entities.push({ type: 'quantity', rawValue: String(e.quantity), confidence: parsed.confidence })
  }
  if (e.unit) {
    entities.push({ type: 'unit', rawValue: e.unit, confidence: parsed.confidence })
  }
  if (e.price_raw != null) {
    entities.push({ type: 'price', rawValue: String(e.price_raw), confidence: parsed.confidence })
  }
  if (e.delivery_date_raw) {
    entities.push({ type: 'date', rawValue: e.delivery_date_raw, confidence: parsed.confidence })
  }
  if (e.defect_type) {
    entities.push({ type: 'defect_type', rawValue: e.defect_type, confidence: parsed.confidence })
  }

  void intent

  return {
    entities,
    confidence: parsed.confidence,
    reasoning: parsed.original_normalized,
  }
}
