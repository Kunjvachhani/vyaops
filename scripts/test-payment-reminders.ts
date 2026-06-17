/**
 * S3.8 Payment Reminders — API route verification.
 *
 * Exercises the two new internal routes against a RUNNING dev server:
 *   • GET  /api/invoices/overdue
 *   • POST /api/invoices/[id]/reminder
 *
 * It does NOT test the n8n workflow itself (that is verified by importing
 * payment-reminder.json into n8n and triggering it manually).
 *
 * Run:  npm run test:reminders          (preloads .env.local via tsx)
 *   or: npx tsx scripts/test-payment-reminders.ts
 *
 * Requires the dev server on NEXT_PUBLIC_APP_URL (default http://localhost:3000)
 * and INTERNAL_API_KEY in .env.local.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── env: tsx --env-file already populates process.env; fall back to a manual
// .env.local parse so the script also runs under a bare runner. ───────────────
function loadEnvLocal(): void {
  if (process.env.INTERNAL_API_KEY) return
  try {
    const txt = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || process.env[m[1]]) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  } catch {
    /* no .env.local — rely on whatever the runner injected */
  }
}
loadEnvLocal()

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? ''
const OVERDUE_URL = `${APP_URL}/api/invoices/overdue`
const FAKE_UUID = 'FAKE-UUID'
const REMINDER_TIERS = ['gentle', 'follow_up', 'urgent', 'final'] as const

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
const bad = (s: string) => `${C.red}✗${C.reset} ${s}`
const warn = (s: string) => `${C.yellow}⚠${C.reset} ${s}`
const hr = () => console.log(C.dim + '─'.repeat(72) + C.reset)

type OverdueInvoice = {
  id: string
  organization_id: string
  invoice_number: string
  customer_name: string
  customer_phone: string
  amount_display: string
  days_overdue: number
  reminder_tier: string
  template_name: string
  template_params: unknown
  reminder_count: number
}

// Per-test assertion bookkeeping. A test PASSES only if every assert() in it held.
let currentOk = true
function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log('    ' + ok(label))
  } else {
    console.log('    ' + bad(`${label}${detail ? ` — ${detail}` : ''}`))
    currentOk = false
  }
}

type Outcome = 'pass' | 'fail' | 'skip'
const results: Record<number, Outcome> = {}

async function http(
  url: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { auth = true, headers, ...rest } = init
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(headers as Record<string, string>) }
  if (auth) h['x-internal-api-key'] = INTERNAL_API_KEY
  const res = await fetch(url, { ...rest, headers: h })
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body }
}

async function main(): Promise<void> {
  console.log(C.bold + '\nVyaOps — S3.8 Payment Reminders API test\n' + C.reset)
  console.log(C.dim + `Target: ${APP_URL}` + C.reset)
  if (!INTERNAL_API_KEY) {
    console.log(warn('INTERNAL_API_KEY not set — authed requests will 401. Check .env.local.'))
  }
  hr()

  let firstInvoice: OverdueInvoice | null = null
  let originalCount = 0
  let noOverdue = false

  // ── Test 1: GET /api/invoices/overdue — happy path ──────────────────────────
  console.log(`\n${C.bold}[1] GET /api/invoices/overdue — happy path${C.reset}`)
  currentOk = true
  try {
    const { status, body } = await http(OVERDUE_URL)
    assert('200 response', status === 200, `got ${status}`)

    const invoices = body.invoices as OverdueInvoice[] | undefined
    const meta = body.meta as Record<string, unknown> | undefined
    assert('response has `invoices` array', Array.isArray(invoices))
    assert('response has `meta` object', !!meta && typeof meta === 'object')

    if (Array.isArray(invoices)) {
      originalCount = invoices.length
      firstInvoice = invoices[0] ?? null
      console.log(
        '    ' +
          C.cyan +
          `${invoices.length} overdue invoice(s) returned` +
          C.reset +
          (meta
            ? C.dim +
              ` · skipped_no_phone=${meta.skipped_no_phone} skipped_reminded_today=${meta.skipped_reminded_today} total_overdue=${meta.total_overdue}` +
              C.reset
            : '')
      )

      for (const inv of invoices) {
        const shapeOk =
          typeof inv.id === 'string' &&
          typeof inv.invoice_number === 'string' &&
          typeof inv.customer_name === 'string' &&
          typeof inv.customer_phone === 'string' &&
          typeof inv.amount_display === 'string' &&
          typeof inv.days_overdue === 'number' &&
          typeof inv.reminder_tier === 'string' &&
          typeof inv.template_name === 'string'
        assert(`invoice ${inv.invoice_number}: required fields present`, shapeOk)

        const paramsOk =
          Array.isArray(inv.template_params) &&
          inv.template_params.length === 4 &&
          inv.template_params.every((p) => typeof p === 'string')
        assert(`invoice ${inv.invoice_number}: template_params is 4 strings`, paramsOk)

        assert(
          `invoice ${inv.invoice_number}: reminder_tier valid`,
          (REMINDER_TIERS as readonly string[]).includes(inv.reminder_tier),
          inv.reminder_tier
        )
        assert(
          `invoice ${inv.invoice_number}: template_name starts with payment_reminder_`,
          inv.template_name.startsWith('payment_reminder_'),
          inv.template_name
        )
        assert(
          `invoice ${inv.invoice_number}: days_overdue > 0`,
          inv.days_overdue > 0,
          String(inv.days_overdue)
        )
      }

      if (invoices.length === 0) {
        noOverdue = true
        console.log(
          '\n' +
            warn(
              'No overdue invoices found — seed data may need invoices with past due dates.'
            )
        )
        console.log(
          '    Create one manually or update seed (due_date < today, status unpaid), then re-run.'
        )
      }
    }
  } catch (err) {
    assert('request completed', false, err instanceof Error ? err.message : String(err))
  }
  results[1] = currentOk ? 'pass' : 'fail'

  // ── Test 2: include_reminded=true returns >= test 1 ─────────────────────────
  console.log(`\n${C.bold}[2] GET /api/invoices/overdue?include_reminded=true${C.reset}`)
  currentOk = true
  try {
    const { status, body } = await http(`${OVERDUE_URL}?include_reminded=true`)
    assert('200 response', status === 200, `got ${status}`)
    const invoices = body.invoices as OverdueInvoice[] | undefined
    assert('response has `invoices` array', Array.isArray(invoices))
    if (Array.isArray(invoices)) {
      assert(
        `count (${invoices.length}) >= default count (${originalCount})`,
        invoices.length >= originalCount
      )
    }
  } catch (err) {
    assert('request completed', false, err instanceof Error ? err.message : String(err))
  }
  results[2] = currentOk ? 'pass' : 'fail'

  // ── Test 3: POST /reminder — happy path ─────────────────────────────────────
  console.log(`\n${C.bold}[3] POST /api/invoices/[id]/reminder — happy path${C.reset}`)
  if (noOverdue || !firstInvoice) {
    console.log('    ' + warn('SKIPPED — no overdue invoice to remind'))
    results[3] = 'skip'
  } else {
    currentOk = true
    try {
      const before = firstInvoice.reminder_count
      const { status, body } = await http(`${APP_URL}/api/invoices/${firstInvoice.id}/reminder`, {
        method: 'POST',
        body: JSON.stringify({ message_id: 'test_wamid_123', reminder_tier: 'gentle' }),
      })
      assert('200 response', status === 200, `got ${status}`)
      const data = body.data as { reminder_count?: number } | undefined
      assert(
        `reminder_count incremented (${before} → ${data?.reminder_count})`,
        typeof data?.reminder_count === 'number' && data.reminder_count === before + 1
      )
    } catch (err) {
      assert('request completed', false, err instanceof Error ? err.message : String(err))
    }
    results[3] = currentOk ? 'pass' : 'fail'
  }

  // ── Test 4: POST /reminder — invalid invoice id → 404 ───────────────────────
  console.log(`\n${C.bold}[4] POST /api/invoices/FAKE-UUID/reminder — 404${C.reset}`)
  if (noOverdue) {
    console.log('    ' + warn('SKIPPED — no overdue invoices in this run'))
    results[4] = 'skip'
  } else {
    currentOk = true
    try {
      const { status } = await http(`${APP_URL}/api/invoices/${FAKE_UUID}/reminder`, {
        method: 'POST',
        body: JSON.stringify({ message_id: 'test_wamid_123', reminder_tier: 'gentle' }),
      })
      assert('404 response', status === 404, `got ${status}`)
    } catch (err) {
      assert('request completed', false, err instanceof Error ? err.message : String(err))
    }
    results[4] = currentOk ? 'pass' : 'fail'
  }

  // ── Test 5: auth guard — missing header → 401 ───────────────────────────────
  console.log(`\n${C.bold}[5] GET /api/invoices/overdue without x-internal-api-key — 401${C.reset}`)
  currentOk = true
  try {
    const { status } = await http(OVERDUE_URL, { auth: false })
    assert('401 response', status === 401, `got ${status}`)
  } catch (err) {
    assert('request completed', false, err instanceof Error ? err.message : String(err))
  }
  results[5] = currentOk ? 'pass' : 'fail'

  // ── Test 6: reminded invoice now excluded from default list ─────────────────
  console.log(`\n${C.bold}[6] Reminded invoice excluded after test 3${C.reset}`)
  if (noOverdue || !firstInvoice || results[3] !== 'pass') {
    console.log('    ' + warn('SKIPPED — depends on a successful reminder in test 3'))
    results[6] = 'skip'
  } else {
    currentOk = true
    try {
      const { body } = await http(OVERDUE_URL)
      const invoices = (body.invoices as OverdueInvoice[] | undefined) ?? []
      assert(
        `default count is one less (${originalCount} → ${invoices.length})`,
        invoices.length === originalCount - 1,
        `expected ${originalCount - 1}`
      )
      assert(
        'reminded invoice no longer in default list',
        !invoices.some((i) => i.id === firstInvoice!.id)
      )

      const { body: incBody } = await http(`${OVERDUE_URL}?include_reminded=true`)
      const incInvoices = (incBody.invoices as OverdueInvoice[] | undefined) ?? []
      assert(
        'reminded invoice still present with include_reminded=true',
        incInvoices.some((i) => i.id === firstInvoice!.id)
      )
    } catch (err) {
      assert('request completed', false, err instanceof Error ? err.message : String(err))
    }
    results[6] = currentOk ? 'pass' : 'fail'
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  hr()
  const passed = Object.values(results).filter((r) => r === 'pass').length
  const failed = Object.values(results).filter((r) => r === 'fail').length
  const skipped = Object.values(results).filter((r) => r === 'skip').length

  console.log('')
  for (let n = 1; n <= 6; n++) {
    const r = results[n]
    const tag =
      r === 'pass' ? `${C.green}PASS${C.reset}` : r === 'fail' ? `${C.red}FAIL${C.reset}` : `${C.yellow}SKIP${C.reset}`
    console.log(`  Test ${n}: ${tag}`)
  }

  console.log(
    `\n${C.bold}S3.8 Payment Reminders — ${passed}/6 tests passed${C.reset}` +
      `  ${C.dim}(${failed} failed, ${skipped} skipped)${C.reset}`
  )

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n' + bad(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`))
  process.exit(1)
})
