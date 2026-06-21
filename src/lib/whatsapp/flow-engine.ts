/**
 * Flow engine — owns the pending_orders state machine.
 *
 * Entry points:
 *   handleCustomerMessage() — called for inbound customer text/button messages
 *   handleOwnerEcho()       — called for owner outbound echoes and slash commands
 *
 * All DB writes use the admin client (service-role). All customer-visible text
 * is localised via getBotStrings() using the org's language_preference (gu/hi/en).
 */

import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { routeAndProcess } from '@/lib/ai/model-router'
import { classifyOwnerReply, parseConfirmation } from '@/lib/ai/deepseek'
import { createOrder } from '@/lib/orders/create-order'
import { sendTextMessage } from '@/lib/whatsapp/meta-cloud-api'
import {
  buildOrderDraft,
  buildModificationDraft,
  buildCancellationDraft,
  buildStatusSummary,
} from '@/lib/whatsapp/interactive'
import { getBotStrings } from '@/lib/whatsapp/bot-strings'
import type { Locale } from '@/lib/whatsapp/bot-strings'
import { formatISTDate, toIST } from '@/lib/utils/date'
import type { Database } from '@/types/database'

type PendingOrderRow = Database['public']['Tables']['pending_orders']['Row']
type AsSingle<T> = T | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentISTDateString(): string {
  return toIST(new Date()).toISOString().slice(0, 10)
}

async function getActivePending(
  orgId: string,
  customerPhone: string
): Promise<AsSingle<PendingOrderRow>> {
  // Lazily expire stale rows first
  await adminClient
    .from('pending_orders')
    .update({ state: 'expired' })
    .eq('organization_id', orgId)
    .eq('customer_phone', customerPhone)
    .in('state', ['detected', 'draft_posted'])
    .lt('expires_at', new Date().toISOString())
    .is('deleted_at', null)

  const { data } = await adminClient
    .from('pending_orders')
    .select('*')
    .eq('organization_id', orgId)
    .eq('customer_phone', customerPhone)
    .in('state', ['detected', 'draft_posted'])
    .is('deleted_at', null)
    .maybeSingle()

  return data as AsSingle<PendingOrderRow>
}

async function expireOldAndInsertNew(
  orgId: string,
  customerPhone: string,
  insert: Database['public']['Tables']['pending_orders']['Insert']
): Promise<PendingOrderRow | null> {
  // Expire any active pending (enforces the partial-unique-index invariant in app code)
  await adminClient
    .from('pending_orders')
    .update({ state: 'expired' })
    .eq('organization_id', orgId)
    .eq('customer_phone', customerPhone)
    .in('state', ['detected', 'draft_posted'])
    .is('deleted_at', null)

  const { data, error } = await adminClient
    .from('pending_orders')
    .insert(insert)
    .select()
    .single()

  if (error) {
    console.error('[flow-engine] failed to insert pending_order:', error.message)
    return null
  }

  return data as unknown as PendingOrderRow
}

async function getOrgLocale(orgId: string): Promise<Locale> {
  const { data } = await adminClient
    .from('organizations')
    .select('language_preference')
    .eq('id', orgId)
    .maybeSingle()
  return ((data?.language_preference ?? 'en') as Locale)
}

// ─── Customer message handler ─────────────────────────────────────────────────

export async function handleCustomerMessage(
  orgId: string,
  customerPhone: string,
  customerId: string | null,
  text: string,
  messageId: string
): Promise<void> {
  if (!customerId) return   // Unknown sender — already handled by webhook (log only)

  // Build org context for AI
  const [{ data: customers }, { data: products }, { data: vendors }, { data: org }] = await Promise.all([
    adminClient
      .from('customers')
      .select('id, name, aliases')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    adminClient
      .from('products')
      .select('id, name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    adminClient
      .from('vendors')
      .select('id, name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    adminClient
      .from('organizations')
      .select('industry_config')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  const orgContext = {
    orgId,
    industrySegment: org?.industry_config ?? undefined,
    customers: (customers ?? []).map((c) => ({ id: c.id, name: c.name })),
    products: (products ?? []).map((p) => ({ id: p.id, name: p.name })),
    vendors: (vendors ?? []).map((v) => ({ id: v.id, name: v.name })),
  }

  let result: Awaited<ReturnType<typeof routeAndProcess>>
  try {
    result = await routeAndProcess(text, orgContext)
  } catch (err) {
    console.error('[flow-engine] routeAndProcess failed:', err instanceof Error ? err.message : err)
    return
  }

  const { intent } = result

  // Informational intents — log only, no pending order, no reply (Rule A)
  if (
    intent.intent === 'ORDER_STATUS' ||
    intent.intent === 'GENERAL_QUERY' ||
    intent.intent === 'INVENTORY_CHECK' ||
    intent.intent === 'UNKNOWN' ||
    intent.intent === 'VENDOR_ORDER' ||
    intent.intent === 'PRODUCTION_UPDATE' ||
    intent.intent === 'INVOICE_REQUEST' ||
    intent.intent === 'PAYMENT_UPDATE' ||
    intent.intent === 'COMPLIANCE_QUERY'
  ) {
    console.log('[flow-engine] non-actionable intent:', intent.intent, '— log only')
    return
  }

  // For order intents: require adequate eval confidence
  if (result.evalResult.compositeScore < 0.5) {
    console.log('[flow-engine] eval score too low:', result.evalResult.compositeScore, '— no action')
    return
  }

  // Resolve product entity for the extraction JSONB
  const productEntity = result.entities.entities.find((e) => e.type === 'product_name')
  const quantityEntity = result.entities.entities.find((e) => e.type === 'quantity')

  // For MODIFY_ORDER / CANCEL_ORDER: find the target open order
  let targetOrderId: string | null = null
  if (intent.intent === 'MODIFY_ORDER' || intent.intent === 'CANCEL_ORDER') {
    const { data: openOrders } = await adminClient
      .from('orders')
      .select('id, order_number, quantity, product_id')
      .eq('organization_id', orgId)
      .eq('customer_id', customerId)
      .in('status', ['confirmed', 'in_production'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Simple heuristic: match by quantity mentioned, or most recent
    const qty = quantityEntity ? parseInt(quantityEntity.rawValue) : null
    const matchedOrder = qty
      ? (openOrders ?? []).find((o) => o.quantity === qty) ?? (openOrders ?? [])[0]
      : (openOrders ?? [])[0]

    targetOrderId = matchedOrder?.id ?? null
  }

  const extraction = {
    intent: intent.intent,
    confidence: intent.confidence,
    entities: result.entities.entities,
    evalScore: result.evalResult.compositeScore,
    decision: result.decision,
    productId: productEntity?.normalizedValue ?? null,
    quantity: quantityEntity ? parseInt(quantityEntity.rawValue) : null,
  }

  await expireOldAndInsertNew(orgId, customerPhone, {
    organization_id: orgId,
    customer_id: customerId,
    customer_phone: customerPhone,
    intent: intent.intent,
    target_order_id: targetOrderId,
    extraction: extraction as unknown as import('@/types/database').Database['public']['Tables']['pending_orders']['Insert']['extraction'],
    state: 'detected',
    source_message_id: messageId,
  })

  console.log('[flow-engine] pending_order created:', intent.intent, 'for', customerPhone)
}

// ─── Owner echo handler ───────────────────────────────────────────────────────

export async function handleOwnerEcho(
  orgId: string,
  chatPhone: string,
  text: string,
  messageId: string
): Promise<void> {
  const trimmed = text.trim()

  if (trimmed.startsWith('/')) {
    await handleCommand(orgId, chatPhone, trimmed)
    return
  }

  const pending = await getActivePending(orgId, chatPhone)

  if (!pending) {
    // No active pending — echo is unrelated to any known flow
    return
  }

  if (pending.state === 'detected') {
    await handleEchoForDetected(orgId, chatPhone, pending, text, messageId)
  } else if (pending.state === 'draft_posted') {
    await handleEchoForDraftPosted(orgId, chatPhone, pending, text, messageId)
  }
}

async function handleEchoForDetected(
  orgId: string,
  chatPhone: string,
  pending: PendingOrderRow,
  ownerReply: string,
  _messageId: string
): Promise<void> {
  const extraction = pending.extraction as Record<string, unknown>
  const pendingSummary = `${pending.intent}: qty=${extraction.quantity ?? '?'}`

  // Find the original customer message via source_message_id
  const { data: sourceMsg } = await adminClient
    .from('whatsapp_messages')
    .select('message_body')
    .eq('message_id', pending.source_message_id)
    .maybeSingle()

  const customerMessage = sourceMsg?.message_body ?? ''

  const classification = await classifyOwnerReply(customerMessage, pendingSummary, ownerReply)

  if (classification.signal === 'DECLINE') {
    await adminClient
      .from('pending_orders')
      .update({ state: 'cancelled' })
      .eq('id', pending.id)
    console.log('[flow-engine] owner DECLINE — pending_order cancelled:', pending.id)
    return
  }

  if (classification.signal !== 'AFFIRM') {
    // UNRELATED — do nothing
    return
  }

  // AFFIRM — build and send the draft
  const locale = await getOrgLocale(orgId)
  const draftText = await buildDraftForPending(pending, orgId, locale)
  if (!draftText) {
    console.error('[flow-engine] could not build draft for pending:', pending.id)
    return
  }

  const sendResult = await sendTextMessage(chatPhone, draftText, orgId)

  if (!sendResult.success) {
    // Draft never reached the customer — keep state 'detected' so the owner's
    // next affirmation retries the draft. Never advance state on a failed send.
    console.error('[flow-engine] draft send FAILED — pending_order stays detected:', {
      pending_id: pending.id,
      error: sendResult.error,
    })
    return
  }

  await adminClient
    .from('pending_orders')
    .update({
      state: 'draft_posted',
      draft_message_id: sendResult.messageId ?? null,
    })
    .eq('id', pending.id)

  console.log('[flow-engine] draft posted, pending_order state→draft_posted:', pending.id)
}

async function buildDraftForPending(pending: PendingOrderRow, orgId: string, locale: Locale): Promise<string | null> {
  const extraction = pending.extraction as Record<string, unknown>
  const quantity = extraction.quantity as number | null
  const entities = extraction.entities as Array<Record<string, unknown>> | undefined

  const productEntity = entities?.find((e) => e.type === 'product_name')
  const productName = (productEntity?.normalizedValue ?? productEntity?.rawValue ?? 'Unknown') as string

  // Fetch customer name
  let customerName = 'Customer'
  if (pending.customer_id) {
    const { data } = await adminClient
      .from('customers')
      .select('name')
      .eq('id', pending.customer_id)
      .maybeSingle()
    if (data) customerName = data.name
  }

  if (pending.intent === 'NEW_ORDER') {
    return buildOrderDraft({
      quantity: quantity ?? 0,
      productName,
      customerName,
    }, locale)
  }

  if (pending.intent === 'CANCEL_ORDER' && pending.target_order_id) {
    const { data: order } = await adminClient
      .from('orders')
      .select('order_number, quantity, product_id')
      .eq('id', pending.target_order_id)
      .maybeSingle()

    if (!order) return null

    // Check production progress
    const { data: batches } = await adminClient
      .from('production_batches')
      .select('quantity_produced')
      .eq('organization_id', orgId)
      .eq('order_id', pending.target_order_id)
      .is('deleted_at', null)

    const produced = (batches ?? []).reduce((sum, b) => sum + (b.quantity_produced ?? 0), 0)

    const { data: product } = await adminClient
      .from('products')
      .select('name, unit')
      .eq('id', order.product_id)
      .maybeSingle()

    return buildCancellationDraft({
      orderNumber: order.order_number,
      quantity: order.quantity,
      productName: product?.name ?? 'Product',
      customerName,
      unit: product?.unit,
      quantityProduced: produced,
    }, locale)
  }

  if (pending.intent === 'MODIFY_ORDER' && pending.target_order_id) {
    const { data: order } = await adminClient
      .from('orders')
      .select('quantity, product_id')
      .eq('id', pending.target_order_id)
      .maybeSingle()

    if (!order) return null

    const { data: product } = await adminClient
      .from('products')
      .select('name, unit')
      .eq('id', order.product_id)
      .maybeSingle()

    // Parse modification mode from extraction
    const mode = (extraction.modificationMode as 'add' | 'replace' | 'ambiguous') ?? 'ambiguous'

    return buildModificationDraft({
      mode,
      originalQuantity: order.quantity,
      newQuantity: quantity ?? 0,
      productName: product?.name ?? productName,
      customerName,
      unit: product?.unit,
    }, locale)
  }

  return null
}

async function handleEchoForDraftPosted(
  orgId: string,
  chatPhone: string,
  pending: PendingOrderRow,
  ownerReply: string,
  _messageId: string
): Promise<void> {
  const parsed = await parseConfirmation(ownerReply, currentISTDateString())

  if (parsed.cancel) {
    await adminClient
      .from('pending_orders')
      .update({ state: 'cancelled' })
      .eq('id', pending.id)
    console.log('[flow-engine] owner /cancel on draft — pending cancelled:', pending.id)
    return
  }

  if (!parsed.confirmed) {
    // UNRELATED — stay in draft_posted, keep waiting
    return
  }

  // Owner confirmed — execute the action
  const locale = await getOrgLocale(orgId)
  if (pending.intent === 'NEW_ORDER') {
    await executeNewOrder(orgId, chatPhone, pending, parsed.promisedDate, locale)
  } else if (pending.intent === 'CANCEL_ORDER') {
    await executeCancelOrder(orgId, chatPhone, pending, locale)
  } else if (pending.intent === 'MODIFY_ORDER') {
    await executeModifyOrder(orgId, chatPhone, pending, ownerReply, parsed.promisedDate, locale)
  }
}

async function executeNewOrder(
  orgId: string,
  chatPhone: string,
  pending: PendingOrderRow,
  promisedDate: string | null,
  locale: Locale
): Promise<void> {
  const extraction = pending.extraction as Record<string, unknown>
  const entities = extraction.entities as Array<Record<string, unknown>> | undefined
  const quantity = extraction.quantity as number | null

  const productEntity = entities?.find((e) => e.type === 'product_name')
  const priceEntity = entities?.find((e) => e.type === 'price')

  // Resolve product id via normalized value or name lookup
  let productId: string | null = null
  const productNorm = (productEntity?.normalizedValue ?? productEntity?.rawValue) as string | undefined
  if (productNorm) {
    const { data } = await adminClient
      .from('products')
      .select('id, unit_price_paise')
      .eq('organization_id', orgId)
      .eq('name', productNorm)
      .is('deleted_at', null)
      .maybeSingle()
    if (data) productId = data.id
  }

  if (!pending.customer_id || !productId || !quantity) {
    console.error('[flow-engine] executeNewOrder: missing customer/product/quantity', pending.id)
    return
  }

  const unitPricePaise = priceEntity
    ? Math.round(parseFloat(String(priceEntity.rawValue)) * 100)
    : 0

  let orderResult: Awaited<ReturnType<typeof createOrder>>
  try {
    orderResult = await createOrder({
      orgId,
      customerId: pending.customer_id,
      productId,
      quantity,
      unitPricePaise,
      deliveryDate: promisedDate,
      source: 'whatsapp',
      auditMetadata: { via_whatsapp: true, pending_order_id: pending.id, chat_phone: chatPhone },
    })
  } catch (err) {
    console.error('[flow-engine] createOrder failed:', err instanceof Error ? err.message : err)
    return
  }

  // Mark pending as confirmed
  await adminClient
    .from('pending_orders')
    .update({ state: 'confirmed', confirmed_order_id: orderResult.orderId })
    .eq('id', pending.id)

  // Build and send confirmation (Rule A — this is one of the three allowed sends)
  const s = getBotStrings(locale).confirm
  const readyLine = promisedDate ? s.readyBy(formatISTDate(new Date(promisedDate))) : ''
  const confirmText = [
    s.newOrder(orderResult.orderNumber),
    `${orderResult.quantity} × ${orderResult.productName} (${orderResult.unit})`,
    readyLine,
  ].filter(Boolean).join('\n')

  await sendTextMessage(chatPhone, confirmText, orgId)

  console.log('[flow-engine] NEW_ORDER confirmed:', orderResult.orderNumber)
}

async function executeCancelOrder(
  orgId: string,
  chatPhone: string,
  pending: PendingOrderRow,
  locale: Locale
): Promise<void> {
  if (!pending.target_order_id) {
    console.error('[flow-engine] executeCancelOrder: no target_order_id', pending.id)
    return
  }

  const { data: order } = await adminClient
    .from('orders')
    .select('order_number, status')
    .eq('id', pending.target_order_id)
    .maybeSingle()

  if (!order) {
    console.error('[flow-engine] executeCancelOrder: order not found', pending.target_order_id)
    return
  }

  // Soft state change — never hard delete
  await adminClient
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', pending.target_order_id)

  void logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'order',
    entity_id: pending.target_order_id,
    changes: [{ field: 'status', old_value: order.status, new_value: 'cancelled' }],
    metadata: { via_whatsapp: true, pending_order_id: pending.id, chat_phone: chatPhone },
  })

  await adminClient
    .from('pending_orders')
    .update({ state: 'confirmed', confirmed_order_id: pending.target_order_id })
    .eq('id', pending.id)

  const confirmText = getBotStrings(locale).confirm.cancelOrder(order.order_number)
  await sendTextMessage(chatPhone, confirmText, orgId)

  console.log('[flow-engine] CANCEL_ORDER confirmed:', order.order_number)
}

async function executeModifyOrder(
  orgId: string,
  chatPhone: string,
  pending: PendingOrderRow,
  ownerReply: string,
  _promisedDate: string | null,
  locale: Locale
): Promise<void> {
  if (!pending.target_order_id) {
    console.error('[flow-engine] executeModifyOrder: no target_order_id', pending.id)
    return
  }

  const extraction = pending.extraction as Record<string, unknown>
  const newQuantity = extraction.quantity as number | null
  const mode = (extraction.modificationMode as 'add' | 'replace' | 'ambiguous') ?? 'ambiguous'

  const { data: order } = await adminClient
    .from('orders')
    .select('order_number, quantity, unit_price_paise, status, product_id')
    .eq('id', pending.target_order_id)
    .maybeSingle()

  if (!order || !newQuantity) {
    console.error('[flow-engine] executeModifyOrder: missing order or quantity', pending.id)
    return
  }

  // Handle ambiguous mode: check if owner's reply contains explicit quantity
  let resolvedMode = mode
  let resolvedQuantity = newQuantity

  if (mode === 'ambiguous') {
    // Check if owner included an explicit quantity in "ok" reply
    const numMatch = ownerReply.match(/\b(\d+)\b/)
    if (numMatch) {
      const ownerQty = parseInt(numMatch[1])
      const totalIfAdd = order.quantity + newQuantity
      if (ownerQty === totalIfAdd) {
        resolvedMode = 'add'
        resolvedQuantity = totalIfAdd
      } else if (ownerQty === newQuantity) {
        resolvedMode = 'replace'
        resolvedQuantity = newQuantity
      } else {
        // Still ambiguous — re-post disambiguation
        const { data: product } = await adminClient
          .from('products')
          .select('name, unit')
          .eq('id', order.product_id)
          .maybeSingle()

        const disambiguationText = buildModificationDraft({
          mode: 'ambiguous',
          originalQuantity: order.quantity,
          newQuantity,
          productName: product?.name ?? 'Product',
          customerName: '',
          unit: product?.unit,
        }, locale)
        await sendTextMessage(chatPhone, disambiguationText, orgId)
        return
      }
    } else {
      // No explicit quantity in confirmation — re-post disambiguation (stay in draft_posted)
      return
    }
  } else if (mode === 'add') {
    resolvedQuantity = order.quantity + newQuantity
  }

  const newTotal = resolvedQuantity * order.unit_price_paise

  await adminClient
    .from('orders')
    .update({
      quantity: resolvedQuantity,
      total_amount_paise: newTotal,
    })
    .eq('id', pending.target_order_id)

  void logAudit({
    organization_id: orgId,
    action: 'update',
    entity_type: 'order',
    entity_id: pending.target_order_id,
    changes: [
      { field: 'quantity', old_value: order.quantity, new_value: resolvedQuantity },
      { field: 'total_amount_paise', old_value: order.quantity * order.unit_price_paise, new_value: newTotal },
    ],
    metadata: {
      via_whatsapp: true,
      pending_order_id: pending.id,
      modification_mode: resolvedMode,
      chat_phone: chatPhone,
    },
  })

  await adminClient
    .from('pending_orders')
    .update({ state: 'confirmed', confirmed_order_id: pending.target_order_id })
    .eq('id', pending.id)

  const sc = getBotStrings(locale).confirm
  const confirmText = `${sc.modifyOrder(order.order_number)}\n${sc.newQuantity(resolvedQuantity)}`
  await sendTextMessage(chatPhone, confirmText, orgId)

  console.log('[flow-engine] MODIFY_ORDER confirmed:', order.order_number, resolvedMode, resolvedQuantity)
}

// ─── Correction capture (S4.3 producer) ──────────────────────────────────────
// When the owner corrects a mis-extracted draft via /edit, record the
// (original customer message, wrong extraction, corrected extraction) triple in
// the `corrections` table. This is the single producer that feeds BOTH downstream
// loops — benchmark growth (scripts/corrections-to-benchmark.ts) and dialect
// learning (analyzeCorrection/learnFromCorrection). Best-effort: a logging
// failure must never break the owner's correction UX.
async function recordCorrection(
  orgId: string,
  chatPhone: string,
  wrongPending: PendingOrderRow,
  correctedPending: PendingOrderRow
): Promise<void> {
  try {
    // The original customer message that was mis-extracted (via source_message_id).
    const { data: sourceMsg } = await adminClient
      .from('whatsapp_messages')
      .select('message_body')
      .eq('message_id', wrongPending.source_message_id)
      .maybeSingle()

    const originalMessage = sourceMsg?.message_body
    if (!originalMessage) {
      console.log('[flow-engine] recordCorrection: original message not found — skipping')
      return
    }

    const { error } = await adminClient.from('corrections').insert({
      organization_id: orgId,
      customer_phone: chatPhone,
      original_message: originalMessage,
      wrong_extraction: wrongPending.extraction,
      correct_extraction: correctedPending.extraction,
      intent: correctedPending.intent,
      source: 'whatsapp_edit',
      pending_order_id: correctedPending.id,
    })
    if (error) {
      console.error('[flow-engine] recordCorrection insert failed:', error.message)
      return
    }
    console.log('[flow-engine] correction recorded (whatsapp_edit) for', chatPhone)
  } catch (err) {
    console.error(
      '[flow-engine] recordCorrection failed (non-blocking):',
      err instanceof Error ? err.message : err
    )
  }
}

// ─── Slash command handler ────────────────────────────────────────────────────

export async function handleCommand(
  orgId: string,
  chatPhone: string,
  command: string
): Promise<void> {
  const [cmd, ...args] = command.trim().split(/\s+/)
  const restText = args.join(' ')

  switch (cmd) {
    case '/status':
      await handleStatusCommand(orgId, chatPhone)
      break

    case '/cancel': {
      const pending = await getActivePending(orgId, chatPhone)
      if (pending) {
        await adminClient
          .from('pending_orders')
          .update({ state: 'cancelled' })
          .eq('id', pending.id)
        console.log('[flow-engine] /cancel — pending cancelled:', pending.id)
      }
      // Stay silent — no reply (Rule A: only draft, confirmation, and /status are allowed sends)
      break
    }

    case '/edit':
      if (restText) {
        // S4.3: capture the correction. Snapshot the active (wrong) pending,
        // re-detect on the corrected text, then record the wrong→right pair.
        const wrongPending = await getActivePending(orgId, chatPhone)
        await handleOwnerOrderTrigger(orgId, chatPhone, restText, true)
        if (wrongPending) {
          const correctedPending = await getActivePending(orgId, chatPhone)
          // Only record when re-detection actually produced a new draft (an
          // actionable correction) — a non-actionable /edit leaves the old row.
          if (correctedPending && correctedPending.id !== wrongPending.id) {
            await recordCorrection(orgId, chatPhone, wrongPending, correctedPending)
          }
        }
      }
      break

    case '/order':
      if (restText) {
        // Manual trigger: detect + skip AFFIRM step, post draft immediately
        await handleOwnerOrderTrigger(orgId, chatPhone, restText, true)
      }
      break

    default:
      // Unknown command — stay silent (Rule A)
      break
  }
}

async function handleStatusCommand(orgId: string, chatPhone: string): Promise<void> {
  // Resolve customer by chat_phone — MUST scope to this chat's customer only (never another customer's data)
  const { data: customer } = await adminClient
    .from('customers')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('phone', chatPhone)
    .is('deleted_at', null)
    .maybeSingle()

  if (!customer) {
    console.log('[flow-engine] /status: no customer found for', chatPhone)
    return
  }

  const { data: orders } = await adminClient
    .from('orders')
    .select('id, order_number, quantity, product_id, delivery_date')
    .eq('organization_id', orgId)
    .eq('customer_id', customer.id)
    .in('status', ['confirmed', 'in_production'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const locale = await getOrgLocale(orgId)
  if (!orders?.length) {
    const ss = getBotStrings(locale).status
    await sendTextMessage(
      chatPhone,
      `${ss.header} — ${customer.name}\n\n${ss.noOrders}`,
      orgId
    )
    return
  }

  // Fetch product names and production progress in parallel
  const productIds = [...new Set(orders.map((o) => o.product_id))]
  const orderIds = orders.map((o) => o.id)

  const [{ data: products }, { data: batches }] = await Promise.all([
    adminClient
      .from('products')
      .select('id, name, unit')
      .in('id', productIds)
      .is('deleted_at', null),
    adminClient
      .from('production_batches')
      .select('order_id, quantity_produced')
      .eq('organization_id', orgId)
      .in('order_id', orderIds)
      .is('deleted_at', null),
  ])

  const productMap = new Map((products ?? []).map((p) => [p.id, p]))
  const productionMap = new Map<string, number>()
  for (const b of batches ?? []) {
    if (!b.order_id) continue
    productionMap.set(b.order_id, (productionMap.get(b.order_id) ?? 0) + (b.quantity_produced ?? 0))
  }

  const summary = buildStatusSummary({
    customerName: customer.name,
    orders: orders.map((o) => {
      const product = productMap.get(o.product_id)
      return {
        orderNumber: o.order_number,
        quantity: o.quantity,
        productName: product?.name ?? 'Unknown',
        unit: product?.unit ?? 'pcs',
        quantityProduced: productionMap.get(o.id) ?? 0,
        deliveryDate: o.delivery_date
          ? formatISTDate(new Date(o.delivery_date))
          : null,
      }
    }),
  }, locale)

  await sendTextMessage(chatPhone, summary, orgId)
}

async function handleOwnerOrderTrigger(
  orgId: string,
  chatPhone: string,
  text: string,
  skipAffirm: boolean
): Promise<void> {
  // Resolve customer by chat_phone
  const { data: customer } = await adminClient
    .from('customers')
    .select('id')
    .eq('organization_id', orgId)
    .eq('phone', chatPhone)
    .is('deleted_at', null)
    .maybeSingle()

  if (!customer) return

  // Run classification (reuse customer message handler logic)
  await handleCustomerMessage(orgId, chatPhone, customer.id, text, `owner-trigger-${Date.now()}`)

  if (!skipAffirm) return

  // Auto-affirm: immediately post the draft
  const pending = await getActivePending(orgId, chatPhone)
  if (!pending || pending.state !== 'detected') return

  const locale = await getOrgLocale(orgId)
  const draftText = await buildDraftForPending(pending, orgId, locale)
  if (!draftText) return

  const sendResult = await sendTextMessage(chatPhone, draftText, orgId)
  await adminClient
    .from('pending_orders')
    .update({ state: 'draft_posted', draft_message_id: sendResult.messageId ?? null })
    .eq('id', pending.id)
}
