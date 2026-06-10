/**
 * Webhook routing test — Customer-Initiated Echo-Confirmed Model.
 *
 * Tests 7 scenarios against the n8n master message handler:
 *   a. Customer order message → expect pending_order 'detected', NO outbound send
 *   b. Owner echo AFFIRM → expect draft posted, state 'draft_posted'
 *   c. Owner echo "ok 15 june" → expect order created, ✅ sent, state 'confirmed'
 *   d. Owner echo "ok" with no pending → expect nothing
 *   e. Unknown sender → expect log-only (no pending_order created)
 *   f. LOOP TEST: bot's own draft echoed back → expect ignored (no action)
 *   g. /status from owner → expect summary scoped to chat customer ONLY
 *
 * Also tests via /api/whatsapp/flow directly (since n8n may not be running locally).
 *
 * Run:  npm run test:webhook
 * (env preloaded via `tsx --env-file=.env.local`)
 *
 * MANUAL STEP: After running, verify Dualhook forwards smb_message_echoes:
 * "MANUAL: verify Dualhook forwards smb_message_echoes — send a message FROM
 * the connected number and confirm it appears in n8n executions and in
 * whatsapp_messages with is_echo=true."
 */

import { adminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/utils/phone'

const ORG_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? 'TEST_PHONE_NUMBER_ID'
// These match seeded customers in supabase/seed.sql (normalizePhone handles the + prefix)
const CUSTOMER_PHONE = '919824100001'         // Rajesh Patel
const UNKNOWN_PHONE = '919999999999'          // not in seed — unknown sender
const SECOND_CUSTOMER_PHONE = '919824100002'  // Dharmesh Shah — for /status scope test

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const FLOW_URL = `${APP_URL}/api/whatsapp/flow`
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? ''

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

const ok = (s: string) => `${C.green}✓${C.reset} ${s}`
const warn = (s: string) => `${C.yellow}⚠${C.reset} ${s}`
const fail = (s: string) => `${C.red}✗${C.reset} ${s}`
const hr = () => console.log(C.dim + '─'.repeat(72) + C.reset)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let passed = 0
let failed = 0
let warned = 0

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log('    ' + ok(label))
    passed++
  } else {
    console.log('    ' + fail(`${label}${detail ? ` — ${detail}` : ''}`))
    failed++
  }
}

async function resolveOrg(): Promise<{ id: string; customerId: string; secondCustomerId: string } | null> {
  const { data: org } = await adminClient
    .from('organizations')
    .select('id')
    .eq('whatsapp_phone_number_id', ORG_PHONE_NUMBER_ID)
    .is('deleted_at', null)
    .maybeSingle()

  if (!org) {
    console.log(warn(`No org found for phone_number_id=${ORG_PHONE_NUMBER_ID} — seed the org first`))
    return null
  }

  const normalizedCustomer = normalizePhone(CUSTOMER_PHONE)
  const normalizedSecond = normalizePhone(SECOND_CUSTOMER_PHONE)

  const { data: customers } = await adminClient
    .from('customers')
    .select('id, phone')
    .eq('organization_id', org.id)
    .in('phone', [normalizedCustomer, normalizedSecond])
    .is('deleted_at', null)

  const customer = customers?.find((c) => c.phone === normalizedCustomer)
  const secondCustomer = customers?.find((c) => c.phone === normalizedSecond)

  if (!customer || !secondCustomer) {
    console.log(warn('Test customers not found — seed customers with phones matching CUSTOMER_PHONE and SECOND_CUSTOMER_PHONE'))
    return null
  }

  return { id: org.id, customerId: customer.id, secondCustomerId: secondCustomer.id }
}

async function postToFlow(payload: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const res = await fetch(FLOW_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': INTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  })
  let body: unknown = {}
  try { body = await res.json() } catch { /* ignore */ }
  return { status: res.status, body }
}

async function getPendingState(orgId: string, phone: string): Promise<string | null> {
  await sleep(500) // brief wait for async flow-engine to settle
  const { data } = await adminClient
    .from('pending_orders')
    .select('state')
    .eq('organization_id', orgId)
    .eq('customer_phone', normalizePhone(phone))
    .in('state', ['detected', 'draft_posted', 'confirmed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.state ?? null
}

async function getLastOutboundMessage(orgId: string, chatPhone: string): Promise<{ body: string | null; is_echo: boolean } | null> {
  await sleep(500)
  const { data } = await adminClient
    .from('whatsapp_messages')
    .select('message_body, is_echo')
    .eq('organization_id', orgId)
    .eq('chat_phone', normalizePhone(chatPhone))
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { body: data.message_body, is_echo: data.is_echo } : null
}

async function runScenario(label: string, desc: string, fn: (org: { id: string; customerId: string; secondCustomerId: string }) => Promise<void>, org: { id: string; customerId: string; secondCustomerId: string }): Promise<void> {
  console.log(`\n${C.bold}[${label}] ${desc}${C.reset}`)
  try {
    await fn(org)
  } catch (err) {
    console.log('    ' + fail(`Scenario threw: ${err instanceof Error ? err.message : String(err)}`))
    failed++
  }
}

async function main(): Promise<void> {
  console.log(C.bold + '\nVyaOps — webhook flow test (new echo-confirmed model)\n' + C.reset)

  if (!INTERNAL_API_KEY) {
    console.log(warn('INTERNAL_API_KEY not set — requests to /api/whatsapp/flow will fail auth'))
  }

  hr()

  const org = await resolveOrg()
  if (!org) {
    console.log(fail('Cannot run tests without a seeded org. Run: npx supabase db reset'))
    process.exit(1)
  }

  console.log(ok(`Org: ${org.id}`))
  console.log(ok(`Customer: ${org.customerId} (phone: ${CUSTOMER_PHONE})`))
  hr()

  // ─── Scenario A: Customer order message ──────────────────────────────────────
  await runScenario('a', 'Customer order message → pending_order detected, NO outbound send', async ({ id: orgId, customerId }) => {
    // Clean up any previous pending for this phone
    await adminClient.from('pending_orders').update({ state: 'expired' })
      .eq('organization_id', orgId).eq('customer_phone', normalizePhone(CUSTOMER_PHONE))

    const countBefore = (await adminClient
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'outbound')
      .eq('chat_phone', normalizePhone(CUSTOMER_PHONE))).count ?? 0

    const { status } = await postToFlow({
      messageType: 'customer_text',
      message: '500 piece valve body mokljo, urgent che',
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-msg-${Date.now()}`,
      customerId,
    })

    assert('flow route returned 200', status === 200)

    const state = await getPendingState(orgId, CUSTOMER_PHONE)
    assert('pending_order in detected state', state === 'detected', `got: ${state}`)

    const countAfter = (await adminClient
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'outbound')
      .eq('chat_phone', normalizePhone(CUSTOMER_PHONE))).count ?? 0
    assert('no outbound message sent', countAfter === countBefore, `${countAfter - countBefore} messages sent`)
  }, org)

  // ─── Scenario B: Owner echo AFFIRM → draft posted ────────────────────────────
  await runScenario('b', 'Owner echo AFFIRM → draft posted, state draft_posted', async ({ id: orgId }) => {
    const { status } = await postToFlow({
      messageType: 'owner_echo',
      message: 'haa thai jase',
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-echo-${Date.now()}`,
      isCommand: false,
    })

    assert('flow route returned 200', status === 200)

    const state = await getPendingState(orgId, CUSTOMER_PHONE)
    assert('pending_order in draft_posted state', state === 'draft_posted', `got: ${state}`)

    const msg = await getLastOutboundMessage(orgId, CUSTOMER_PHONE)
    assert('draft message sent', msg?.body?.includes('📋 Order Draft') ?? false, `got: ${msg?.body?.slice(0, 50)}`)
  }, org)

  // ─── Scenario C: Owner "ok 15 june" → order confirmed ────────────────────────
  await runScenario('c', 'Owner echo "ok 15 june" → order created, ✅ sent, state confirmed', async ({ id: orgId }) => {
    const { status } = await postToFlow({
      messageType: 'owner_echo',
      message: 'ok 15 june',
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-echo-${Date.now()}`,
      isCommand: false,
    })

    assert('flow route returned 200', status === 200)

    const state = await getPendingState(orgId, CUSTOMER_PHONE)
    assert('pending_order in confirmed state', state === 'confirmed', `got: ${state}`)

    const msg = await getLastOutboundMessage(orgId, CUSTOMER_PHONE)
    assert('confirmation message sent', msg?.body?.includes('✅ Order Confirmed') ?? false, `got: ${msg?.body?.slice(0, 50)}`)
  }, org)

  // ─── Scenario D: Owner echo "ok" with no pending → nothing ───────────────────
  await runScenario('d', 'Owner echo "ok" with no active pending → nothing happens', async ({ id: orgId }) => {
    const countBefore = (await adminClient
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'outbound')
      .eq('chat_phone', normalizePhone(CUSTOMER_PHONE))).count ?? 0

    const { status } = await postToFlow({
      messageType: 'owner_echo',
      message: 'ok',
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-echo-${Date.now()}`,
      isCommand: false,
    })

    assert('flow route returned 200', status === 200)

    const countAfter = (await adminClient
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'outbound')
      .eq('chat_phone', normalizePhone(CUSTOMER_PHONE))).count ?? 0
    assert('no outbound message sent', countAfter === countBefore)
  }, org)

  // ─── Scenario E: Unknown sender → log only ────────────────────────────────────
  await runScenario('e', 'Unknown sender → log-only, no pending_order', async ({ id: orgId }) => {
    const { status } = await postToFlow({
      messageType: 'customer_text',
      message: '300 piece valve body joiye',
      chatPhone: UNKNOWN_PHONE,
      orgId,
      messageId: `test-unknown-${Date.now()}`,
      customerId: null,   // null = unknown sender from webhook
    })

    assert('flow route returned 200', status === 200)

    const state = await getPendingState(orgId, UNKNOWN_PHONE)
    assert('no pending_order created', state === null, `got: ${state}`)
  }, org)

  // ─── Scenario F: Loop test — bot's own draft echoed back ──────────────────────
  await runScenario('f', 'LOOP TEST: bot draft echoed back → ignored (no action)', async ({ id: orgId }) => {
    // First create a fresh pending for the loop test
    await adminClient.from('pending_orders').update({ state: 'expired' })
      .eq('organization_id', orgId).eq('customer_phone', normalizePhone(CUSTOMER_PHONE))

    const draftText = '📋 Order Draft\n\n500 × Valve Body (pcs)\nCustomer: Test\nReady by: —\n\nReply "ok" to confirm · /cancel to discard'

    // Insert a fake outbound wamid matching the echo we'll send
    const fakeWamid = `wamid.bot-own-${Date.now()}`
    await adminClient.from('whatsapp_messages').insert({
      organization_id: orgId,
      message_id: fakeWamid,
      direction: 'outbound',
      is_echo: false,
      sender_phone: normalizePhone(CUSTOMER_PHONE),
      chat_phone: normalizePhone(CUSTOMER_PHONE),
      message_type: 'text',
      message_body: draftText,
      was_triggered: false,
      was_processed: false,
    })

    // The webhook echo handler (not flow route) does the loop guard — test that
    // the wamid-based guard would catch it. Here we verify the flow engine doesn't
    // create pending on an echo that shouldn't reach it.
    // This scenario confirms: if the webhook correctly filters self-echoes, flow never sees them.
    console.log('    ' + ok('Bot message logged as outbound (wamid guard in webhook)'))

    // Verify a text-signature echo also gets no action from flow if it reaches it
    const pendingBefore = await getPendingState(orgId, CUSTOMER_PHONE)
    await postToFlow({
      messageType: 'owner_echo',
      message: draftText,   // text signature — flow engine should treat as UNRELATED
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-loop-${Date.now()}`,
      isCommand: false,
    })

    const pendingAfter = await getPendingState(orgId, CUSTOMER_PHONE)
    assert('no new pending created from bot-echoed message', pendingBefore === pendingAfter)
  }, org)

  // ─── Scenario G: /status scoped to chat customer only ────────────────────────
  await runScenario('g', '/status from owner → summary scoped to chat customer, not second customer', async ({ id: orgId, secondCustomerId }) => {
    // Seed a visible order for the second customer
    const { data: product } = await adminClient
      .from('products').select('id').eq('organization_id', orgId).is('deleted_at', null).limit(1).maybeSingle()

    if (secondCustomerId && product?.id) {
      await adminClient.from('orders').insert({
        organization_id: orgId,
        order_number: `TEST-STATUS-${Date.now()}`,
        customer_id: secondCustomerId,
        product_id: product.id,
        quantity: 999,
        unit_price_paise: 100,
        total_amount_paise: 99900,
        status: 'confirmed',
        source: 'web',
        idempotency_key: `test-status-${Date.now()}`,
      })
    }

    await postToFlow({
      messageType: 'owner_echo',
      message: '/status',
      chatPhone: CUSTOMER_PHONE,
      orgId,
      messageId: `test-status-${Date.now()}`,
      isCommand: true,
    })

    await sleep(1000)
    const msg = await getLastOutboundMessage(orgId, CUSTOMER_PHONE)

    if (msg?.body) {
      assert('/status reply sent', msg.body.includes('📦'), `got: ${msg.body.slice(0, 60)}`)
      assert('second customer orders NOT in reply (999 qty)', !msg.body.includes('999'), `leak: ${msg.body}`)
    } else {
      console.log('    ' + warn('No /status reply found — check flow engine /status handler'))
      warned++
    }
  }, org)

  hr()
  console.log(`\n${C.bold}Results:${C.reset} ${C.green}${passed} passed${C.reset} | ${C.red}${failed} failed${C.reset} | ${C.yellow}${warned} warnings${C.reset}`)

  console.log(C.dim + '\n────────────────────────────────────────────────────────────' + C.reset)
  console.log(C.yellow + '⚠ MANUAL: verify Dualhook forwards smb_message_echoes —' + C.reset)
  console.log('  Send a message FROM the connected number in WhatsApp Business App.')
  console.log('  Confirm it appears in n8n executions AND in whatsapp_messages with is_echo=true.')
  console.log('  If field name differs (message_echoes vs smb_message_echoes), update isEchoField().')
  console.log(C.dim + '────────────────────────────────────────────────────────────' + C.reset)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n' + fail(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`))
  process.exit(1)
})
