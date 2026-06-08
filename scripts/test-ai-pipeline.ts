/**
 * AI pipeline integration test.
 *
 * Drives the real AI core (DeepSeek classify/extract -> Qwen eval gate -> routing)
 * and the fuzzy matcher against the locally-seeded Supabase org
 * ("Shree Ambica Engineering", +919876543210).
 *
 * Run:  npm run test:ai
 * (env is preloaded via `tsx --env-file=.env.local` — do NOT import dotenv here)
 *
 * Requires: local Supabase running + seeded (`npx supabase db reset`),
 *           DEEPSEEK_API_KEY and OPENROUTER_API_KEY set in .env.local.
 */

import { routeAndProcess } from '@/lib/ai/model-router'
import { matchCustomer, matchProduct } from '@/lib/utils/fuzzy-match'
import { adminClient } from '@/lib/supabase/admin'
import type { OrgContext, RouteAndProcessResult } from '@/types/ai'

const ORG_PHONE = '+919876543210'

type PipelineCase = {
  label: string
  language: string
  message: string
  // Soft expectation on the eval-gate composite. LLM scores vary run-to-run,
  // so a miss is a warning, not a hard failure.
  expectComposite: 'above_0.70' | 'below_0.70'
  expectIntent: string
  // Hard safety expectation: an order missing a resolved customer must never
  // reach 'confirm'/'auto_process' (deterministic order gate in model-router).
  mustNotCreateOrder?: boolean
}

const CASES: PipelineCase[] = [
  {
    label: 'a',
    language: 'English',
    message: 'Create order for Raju Patel, 500 pieces Valve Body',
    expectComposite: 'above_0.70',
    expectIntent: 'NEW_ORDER',
  },
  {
    label: 'b',
    language: 'Hindi',
    message: 'Raju bhai ka order dalo 500 piece valve body',
    expectComposite: 'above_0.70',
    expectIntent: 'NEW_ORDER',
  },
  {
    label: 'c',
    language: 'Gujarati',
    message: 'Rajubhai no order nakho 500 piece valve body',
    expectComposite: 'above_0.70',
    expectIntent: 'NEW_ORDER',
  },
  {
    label: 'd',
    language: 'Hinglish',
    message: 'rajubhai order 500 pcs valve body urgent hai',
    expectComposite: 'above_0.70',
    expectIntent: 'NEW_ORDER',
  },
  {
    label: 'e',
    language: 'Ambiguous (no customer)',
    message: '500 valve body',
    expectComposite: 'below_0.70',
    expectIntent: 'NEW_ORDER',
    mustNotCreateOrder: true,
  },
]

// ── small console helpers ───────────────────────────────────────────────────
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

let hardFailures = 0
let softWarnings = 0

async function buildOrgContext(): Promise<{ orgId: string; ctx: OrgContext }> {
  const { data: org, error } = await adminClient
    .from('organizations')
    .select('id, name')
    .eq('whatsapp_phone', ORG_PHONE)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    throw new Error(
      `Org not found for ${ORG_PHONE}. Is local Supabase running and seeded?\n` +
        `  Fix: npx supabase start && npx supabase db reset\n` +
        `  (underlying: ${error?.message ?? 'no row'})`
    )
  }

  const orgId = org.id
  const [customers, products, vendors] = await Promise.all([
    adminClient.from('customers').select('id, name, aliases').eq('organization_id', orgId).is('deleted_at', null),
    adminClient.from('products').select('id, name, aliases').eq('organization_id', orgId).is('deleted_at', null),
    adminClient.from('vendors').select('id, name, aliases').eq('organization_id', orgId).is('deleted_at', null),
  ])

  console.log(
    ok(
      `Org "${org.name}" (${orgId.slice(0, 8)}…) — ` +
        `${customers.data?.length ?? 0} customers, ${products.data?.length ?? 0} products, ${vendors.data?.length ?? 0} vendors`
    )
  )

  return {
    orgId,
    ctx: {
      orgId,
      customers: customers.data ?? [],
      products: products.data ?? [],
      vendors: vendors.data ?? [],
    },
  }
}

function printResult(c: PipelineCase, r: RouteAndProcessResult): void {
  const entityStr =
    r.entities.entities.length > 0
      ? r.entities.entities
          .map((e) => {
            const resolved = e.normalizedValue && e.normalizedValue !== e.rawValue ? ` → ${JSON.stringify(e.normalizedValue)}` : ''
            return `${e.type}=${JSON.stringify(e.rawValue)}${resolved}`
          })
          .join(', ')
      : C.dim + '(none)' + C.reset

  const score = r.evalResult.compositeScore
  const dims = r.evalResult.perDimensionScores

  console.log(`${C.bold}[${c.label}] ${c.language}${C.reset}  ${C.dim}model=${r.modelUsed}${C.reset}`)
  console.log(`    message : ${JSON.stringify(c.message)}`)
  console.log(`    intent  : ${r.intent.intent}  ${C.dim}(conf ${r.intent.confidence.toFixed(2)}, lang ${r.intent.language})${C.reset}`)
  console.log(`    entities: ${entityStr}`)
  console.log(
    `    eval    : ${C.cyan}${score.toFixed(3)}${C.reset}  ` +
      `${C.dim}[intent ${dims.intent_correctness.toFixed(2)} · acc ${dims.entity_accuracy.toFixed(2)} · ` +
      `complete ${dims.entity_completeness.toFixed(2)} · match ${dims.match_confidence.toFixed(2)} · lang ${dims.language_understanding.toFixed(2)}]${C.reset}`
  )
  console.log(`    decision: ${C.bold}${r.decision}${C.reset}`)
  if (r.evalResult.failureCodes.length) {
    console.log(`    flags   : ${r.evalResult.failureCodes.join(', ')}`)
  }

  // ── checks ────────────────────────────────────────────────────────────────
  if (r.intent.intent === c.expectIntent) {
    console.log('    ' + ok(`intent is ${c.expectIntent}`))
  } else {
    console.log('    ' + fail(`intent expected ${c.expectIntent}, got ${r.intent.intent}`))
    hardFailures++
  }

  const above = score > 0.7
  const wantAbove = c.expectComposite === 'above_0.70'
  if (above === wantAbove) {
    console.log('    ' + ok(`composite ${score.toFixed(3)} is ${c.expectComposite.replace('_', ' ')}`))
  } else {
    console.log(
      '    ' +
        warn(`composite ${score.toFixed(3)} expected ${c.expectComposite.replace('_', ' ')} — LLM scores vary, review`)
    )
    softWarnings++
  }

  // Hard safety gate: an order with no resolved customer must never auto-create.
  if (c.mustNotCreateOrder) {
    const safe = r.decision === 'clarify' || r.decision === 'reject_show_menu'
    if (safe) {
      console.log('    ' + ok(`safety gate held — decision "${r.decision}" creates no order despite eval ${score.toFixed(3)}`))
    } else {
      console.log('    ' + fail(`SAFETY: decision "${r.decision}" would create an order with no resolved customer`))
      hardFailures++
    }
  }
}

async function runFuzzySection(orgId: string): Promise<void> {
  hr()
  console.log(C.bold + 'Fuzzy matching (against seed data)' + C.reset)

  // Customer: "Rajubhai" is a seeded alias of "Rajesh Patel" (company alias "raju patel").
  const custProbe = 'Rajubhai'
  const cust = await matchCustomer(orgId, custProbe)
  if (cust.match) {
    console.log('    ' + ok(`customer "${custProbe}" → "${cust.match.name}" (conf ${cust.confidence.toFixed(2)})`))
    if (!/patel/i.test(cust.match.name)) {
      console.log('    ' + warn(`expected a Patel customer, got "${cust.match.name}"`))
      softWarnings++
    }
  } else {
    console.log(
      '    ' +
        fail(
          `customer "${custProbe}" did not resolve (best conf ${cust.confidence.toFixed(2)}, ` +
            `alternatives: ${cust.alternatives.map((a) => a.name).join(', ') || 'none'})`
        )
    )
    hardFailures++
  }

  // Product: "valve body" is an exact seeded alias of "Valve Body".
  const prodProbe = 'valve body'
  const prod = await matchProduct(orgId, prodProbe)
  if (prod.match) {
    console.log('    ' + ok(`product "${prodProbe}" → "${prod.match.name}" (conf ${prod.confidence.toFixed(2)})`))
  } else {
    console.log('    ' + fail(`product "${prodProbe}" did not resolve (best conf ${prod.confidence.toFixed(2)})`))
    hardFailures++
  }
}

async function main(): Promise<void> {
  console.log(C.bold + '\nVyaOps — AI pipeline test\n' + C.reset)
  hr()

  const { orgId, ctx } = await buildOrgContext()
  hr()

  for (const c of CASES) {
    try {
      const r = await routeAndProcess(c.message, ctx)
      printResult(c, r)
    } catch (err) {
      console.log(
        `${C.bold}[${c.label}] ${c.language}${C.reset}\n    ` +
          fail(`pipeline threw: ${err instanceof Error ? err.message : String(err)}`)
      )
      hardFailures++
    }
    console.log()
  }

  await runFuzzySection(orgId)

  hr()
  if (hardFailures === 0) {
    console.log(ok(`${C.bold}All hard checks passed${C.reset}` + (softWarnings ? `  (${softWarnings} soft warning(s) — review above)` : '')))
  } else {
    console.log(fail(`${C.bold}${hardFailures} hard failure(s)${C.reset}` + (softWarnings ? `, ${softWarnings} soft warning(s)` : '')))
  }
  console.log()
  process.exit(hardFailures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n' + fail(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`))
  process.exit(1)
})
