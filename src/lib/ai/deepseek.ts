import type {
  AIRequest,
  AIResponse,
  IntentResult,
  EntityResult,
  ExtractedEntity,
  OrgContext,
  ModelResponse,
  OwnerReplyClassification,
  ConfirmationParseResult,
  ModificationParseResult,
} from '@/types/ai'
import {
  DeepSeekClassifyResponseSchema,
  OwnerReplyClassificationSchema,
  ConfirmationParseResultSchema,
  ModificationParseResultSchema,
} from '@/types/ai'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const MAX_RETRIES = 3
const TIMEOUT_MS = 30_000

export const CLASSIFY_SYSTEM_PROMPT = `You are an AI assistant for Indian manufacturing factories. You process WhatsApp messages in Gujarati, Hindi, Hinglish, and English.

IMPORTANT CONTEXT: The message author is the CUSTOMER (not the factory owner). Messages come from the customer's WhatsApp to the factory owner's number.

Your task: classify the intent and extract structured data from the message.

INTENTS:
- NEW_ORDER: Customer placing a new order (keywords: order, ઓર્ડર, आर्डर, piece, pcs, deliver, mokljo, joiye, chahiye)
- MODIFY_ORDER: Customer wants to change an existing order quantity or details (keywords: change, badlvu, badlo, modify, update, haji, add karvu, zyada, kam, adjust)
- CANCEL_ORDER: Customer wants to cancel an existing order (keywords: cancel, band, roko, nahi joiye, nai joiye, rokvi do, mat karo)
- ORDER_STATUS: Checking existing orders (keywords: status, kya hua, kidhar hai, ketlu thayyu, kitna hua)
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
    "price_raw": null,
    "order_ref_raw": null
  },
  "language_detected": "hinglish",
  "original_normalized": "rajubhai no order 500 piece valve body kal deliver"
}

For MODIFY_ORDER: populate order_ref_raw with any quantity/product reference to the existing order.
For CANCEL_ORDER: populate order_ref_raw with whatever the customer uses to identify the order.

CRITICAL INTENT DISAMBIGUATION — NEW_ORDER vs GENERAL_QUERY:
- If the message mentions a PRODUCT + QUANTITY (even implicitly), it's NEW_ORDER. "Vijay bhai ne 500 piece valve body joiye" → NEW_ORDER
- If the message ONLY asks about price/rate/availability WITHOUT placing an order, it's GENERAL_QUERY. "valve body no bhav shu che?" → GENERAL_QUERY
- If the message asks "maal che?" / "stock che?" (is product available?), it's INVENTORY_CHECK, NOT NEW_ORDER.
- "X joiye" / "X chahiye" / "X moklo" WITH quantity → NEW_ORDER. WITHOUT quantity but with a clear product → still NEW_ORDER (quantity=null).
- "X no rate apo" / "X no bhav batao" → GENERAL_QUERY (price inquiry, not ordering).
- "batch kitna hua" / "aaj kitna banya" / "production update" → PRODUCTION_UPDATE, NOT GENERAL_QUERY.
- Greetings alone ("kem cho", "hello", "good morning") with no business content → GENERAL_QUERY.`

const OWNER_REPLY_CLASSIFIER_PROMPT = `You are classifying a factory owner's WhatsApp reply to determine his intent regarding a pending customer order.

CONTEXT:
- Customer message: {customer_message}
- Pending order: {pending_order_summary}
- Owner reply: {owner_reply}

Classify the owner's reply:
- AFFIRM: Owner is agreeing to process or accept the order (even if he mentions a delay or condition)
- DECLINE: Owner is refusing or cannot fulfill the order
- UNRELATED: Reply is about something else entirely — a different topic, a greeting, or clearly unrelated to this order

IMPORTANT RULES:
1. A reply with a condition (e.g., "yes but 3 days") is AFFIRM
2. A reply expressing doubt or asking for time is UNRELATED — not a clear signal
3. "/cancel" typed by the owner is NOT classified here — handled separately
4. Owners write in Gujarati/Hindi romanized as Latin script ("Gujlish"/"Hinglish").
   Read the reply in that context — do NOT match on isolated word fragments.

LANGUAGE EXAMPLES (Gujlish/Hinglish — all AFFIRM):
- "ok karavi dav" / "kari dav" / "kari dejo" → AFFIRM (get it done)
- "thai jase" / "thai jashe" → AFFIRM (it will be done)
- "vandho nathi" / "vandho thai jase" → AFFIRM ("no objection" / "no problem, will be done" — "vandho" alone does NOT mean decline)
- "ha, moklo" / "haa thik che" / "barabar" → AFFIRM
- "kar do" / "ho jayega" / "bana denge" → AFFIRM

DECLINE examples:
- "na, nahi thase" / "nahi banega" → DECLINE
- "stock nathi, na karo" / "cancel karo" → DECLINE
- "shaky nathi" / "possible nathi" → DECLINE

RESPONSE FORMAT (strict JSON, no markdown):
{"signal": "AFFIRM", "confidence": 0.95}`

const CONFIRMATION_PARSER_PROMPT = `You are parsing a factory owner's WhatsApp reply to an order draft.

Owner reply: {owner_reply}
Current IST date: {current_ist_date}

Parse the reply:
- confirmed: true if the owner is confirming the order
- promised_date: ISO date (YYYY-MM-DD) if a delivery date is mentioned, null otherwise
- cancel: true if owner is cancelling

DATE RESOLUTION RULES:
- "kal" = tomorrow (current IST date + 1 day)
- "next monday" = next Monday's date from current IST date
- "15 june" / "15/6" / "15-06" = June 15 current or next year (future only)
- Vague dates ("jaldi", "this week") = null

DEFAULT ON PARSE FAILURE: {"confirmed": false, "promised_date": null, "cancel": false}

RESPONSE FORMAT (strict JSON, no markdown):
{"confirmed": true, "promised_date": "2026-06-15", "cancel": false}`

const MODIFICATION_PARSER_PROMPT = `You are parsing a customer's WhatsApp message requesting a modification to an existing order.

Original order: {original_order_summary}
Customer message: {customer_message}

Determine the modification:
- mode: 'add' (customer wants MORE on top), 'replace' (customer wants a different total), 'ambiguous'
- new_quantity: the number mentioned
- confidence: 0.0–1.0

DISAMBIGUATION RULES:
- "biji X" / "add karvo" / "upar thi" / "zyada X" → 'add'
- "X j joiye" / "sirf X" / "total X" / "change to X" / "badlo ne X" → 'replace'
- "haji X" alone (no explicit add/replace wording) → 'ambiguous'

RESPONSE FORMAT (strict JSON, no markdown):
{"mode": "ambiguous", "new_quantity": 450, "confidence": 0.75}`

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
    maxTokens: 800,
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

// ─── Owner-reply classifier ───────────────────────────────────────────────────
// Routes through DeepSeek only (cheap, frequent). Safety default: UNRELATED.

export async function classifyOwnerReply(
  customerMessage: string,
  pendingSummary: string,
  ownerReply: string
): Promise<OwnerReplyClassification> {
  const systemPrompt = OWNER_REPLY_CLASSIFIER_PROMPT
    .replace('{customer_message}', customerMessage)
    .replace('{pending_order_summary}', pendingSummary)
    .replace('{owner_reply}', ownerReply)

  try {
    const response = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ownerReply },
      ],
      temperature: 0.1,
      maxTokens: 128,
    })

    const raw = JSON.parse(response.content) as unknown
    return OwnerReplyClassificationSchema.parse(raw)
  } catch {
    // Any failure → UNRELATED (never default to an affirmative signal)
    return { signal: 'UNRELATED', confidence: 0 }
  }
}

// ─── Confirmation parser ──────────────────────────────────────────────────────
// Safety default: not confirmed.

export async function parseConfirmation(
  ownerReply: string,
  currentISTDate: string
): Promise<ConfirmationParseResult> {
  const systemPrompt = CONFIRMATION_PARSER_PROMPT
    .replace('{owner_reply}', ownerReply)
    .replace('{current_ist_date}', currentISTDate)

  try {
    const response = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ownerReply },
      ],
      temperature: 0.1,
      maxTokens: 128,
    })

    const raw = JSON.parse(response.content) as unknown
    const parsed = ConfirmationParseResultSchema.parse(raw)
    return {
      confirmed: parsed.confirmed,
      promisedDate: parsed.promised_date,
      cancel: parsed.cancel,
    }
  } catch {
    return { confirmed: false, promisedDate: null, cancel: false }
  }
}

// ─── Modification parser ──────────────────────────────────────────────────────
// Safety default: ambiguous (never silently pick add or replace on failure).

export async function parseModification(
  originalOrderSummary: string,
  customerMessage: string
): Promise<ModificationParseResult> {
  const systemPrompt = MODIFICATION_PARSER_PROMPT
    .replace('{original_order_summary}', originalOrderSummary)
    .replace('{customer_message}', customerMessage)

  try {
    const response = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: customerMessage },
      ],
      temperature: 0.1,
      maxTokens: 128,
    })

    const raw = JSON.parse(response.content) as unknown
    const parsed = ModificationParseResultSchema.parse(raw)
    return {
      mode: parsed.mode,
      newQuantity: parsed.new_quantity,
      confidence: parsed.confidence,
    }
  } catch {
    return { mode: 'ambiguous', newQuantity: 0, confidence: 0 }
  }
}
