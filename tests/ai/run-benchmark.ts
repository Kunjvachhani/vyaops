/**
 * AI eval-loop benchmark runner.
 *
 * Loads tests/ai/benchmark.json (1000 cases across 10 Gujarat MSME industries),
 * runs each message through the real pipeline — classify/extract via the model
 * router → in-memory fuzzy match against the case's industry catalog → eval gate
 * scoring — then compares against expected values and reports a graded summary.
 *
 * Run: `npm run test:benchmark`
 *   Flags (optional):
 *     --limit=N         run only the first N cases (smoke test)
 *     --concurrency=N   parallel cases in flight (default 6, or BENCHMARK_CONCURRENCY)
 *
 * Exits 1 if the overall pass rate is below PASS_THRESHOLD (80%).
 *
 * The fuzzy matcher is replicated in-memory here (reusing the exported
 * `levenshtein` + `soundexMatch` primitives) so cases score against the catalog
 * baked into benchmark.json rather than a seeded Supabase org. The scoring
 * formula mirrors `scoreAgainst` in src/lib/utils/fuzzy-match.ts exactly.
 */

import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { routeAI, applyDialectHints } from '@/lib/ai/model-router'
import { evaluateExtraction } from '@/lib/ai/eval-gate'
import { CLASSIFY_SYSTEM_PROMPT } from '@/lib/ai/deepseek'
import { lookupDialect } from '@/lib/ai/dialect-lookup'
// Production scoring functions — reused so benchmark matching can never drift
// from production: tokenAwareScore for customers, scoreAgainst for products.
import { tokenAwareScore, scoreAgainst } from '@/lib/utils/fuzzy-match'
import { DeepSeekClassifyResponseSchema } from '@/types/ai'
import type {
  IntentType,
  IntentResult,
  EntityResult,
  ExtractedEntity,
  OrgContext,
  EvalGateDecision,
} from '@/types/ai'

// ─── Tunables ─────────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 0.8 // overall pass rate below this → exit code 1
const MATCH_CONFIDENCE_MIN = 0.8 // fuzzy match must beat this to count as a hit

// Cost estimation. DeepSeek price is from CLAUDE.md; Qwen (eval) is an OpenRouter
// estimate — both are rough and only used for the cost line in the summary.
const DEEPSEEK_USD_PER_M = 0.435
const QWEN_USD_PER_M = 0.4
const USD_TO_INR = 83

// ─── benchmark.json shapes ─────────────────────────────────────────────────────

interface IndustryCatalog {
  city: string
  products: string[]
  customers: string[]
  slang_terms: string[]
}

interface ExpectedEntities {
  customer?: string
  product?: string
  quantity?: number
  unit?: string
  order_ref?: string
}

interface BenchmarkCase {
  id: string
  input: string
  expected_intent: IntentType
  expected_entities: ExpectedEntities
  expected_min_score: number
  expected_decision: EvalGateDecision
  language: string
  difficulty: string
  industry?: string
  notes?: string
}

interface BenchmarkFile {
  version: string
  _meta: {
    industry_catalogs: Record<string, IndustryCatalog>
  }
  test_cases: BenchmarkCase[]
}

// ─── Per-case result ───────────────────────────────────────────────────────────

type Criterion = 'intent' | 'customer' | 'product' | 'quantity' | 'eval_score'

interface CriterionResult {
  applicable: boolean
  passed: boolean
}

interface CaseResult {
  id: string
  input: string
  industry: string
  difficulty: string
  language: string
  passed: boolean
  criteria: Record<Criterion, CriterionResult>
  actual: {
    intent: IntentType | null
    customer: { raw: string | null; matched: string | null; confidence: number }
    product: { raw: string | null; matched: string | null; confidence: number }
    quantity: number | null
    evalScore: number | null
    decision: EvalGateDecision | null
  }
  expected: {
    intent: IntentType
    customer: string | null
    product: string | null
    quantity: number | null
    minScore: number
    decision: EvalGateDecision
  }
  latencyMs: number
  tokens: { deepseek: number; qwen: number }
  error?: string
}

// ─── In-memory matcher (uses production scorers — see imports above) ─────────────
// Customers use tokenAwareScore (first-name/honorific aware, matches production
// matchCustomer); products use scoreAgainst (whole-string, matches matchProduct).

function matchBest(
  raw: string,
  candidates: string[],
  scorer: (raw: string, candidate: string) => number
): { matched: string | null; confidence: number } {
  let best: string | null = null
  let bestScore = 0
  for (const c of candidates) {
    const s = scorer(raw, c)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return { matched: best, confidence: bestScore }
}

// ─── JSON extraction (models occasionally wrap output in ```json fences) ─────────

function extractJson(content: string): unknown {
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('no JSON object found in model output')
    }
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

// ─── Pipeline for a single case ─────────────────────────────────────────────────

// Dummy UUID — the dialect org-tier lookup queries org_dictionary by uuid; a
// valid-shaped id avoids a Postgres cast error (it just returns no rows).
const BENCHMARK_ORG_ID = '00000000-0000-0000-0000-000000000000'

function buildOrgContext(
  catalog: IndustryCatalog | undefined,
  industrySegment: string
): OrgContext {
  const customers = (catalog?.customers ?? []).map((name, i) => ({ id: `c${i}`, name }))
  const products = (catalog?.products ?? []).map((name, i) => ({ id: `p${i}`, name }))
  return { orgId: BENCHMARK_ORG_ID, industrySegment, customers, products, vendors: [] }
}

function buildEntities(
  parsed: ReturnType<typeof DeepSeekClassifyResponseSchema.parse>
): ExtractedEntity[] {
  const e = parsed.entities
  const entities: ExtractedEntity[] = []
  if (e.customer_name_raw)
    entities.push({ type: 'customer_name', rawValue: e.customer_name_raw, confidence: parsed.confidence })
  if (e.vendor_name_raw)
    entities.push({ type: 'vendor_name', rawValue: e.vendor_name_raw, confidence: parsed.confidence })
  if (e.product_raw)
    entities.push({ type: 'product_name', rawValue: e.product_raw, confidence: parsed.confidence })
  if (e.quantity != null)
    entities.push({ type: 'quantity', rawValue: String(e.quantity), confidence: parsed.confidence })
  if (e.unit)
    entities.push({ type: 'unit', rawValue: e.unit, confidence: parsed.confidence })
  if (e.price_raw != null)
    entities.push({ type: 'price', rawValue: String(e.price_raw), confidence: parsed.confidence })
  if (e.delivery_date_raw)
    entities.push({ type: 'date', rawValue: e.delivery_date_raw, confidence: parsed.confidence })
  if (e.defect_type)
    entities.push({ type: 'defect_type', rawValue: e.defect_type, confidence: parsed.confidence })
  return entities
}

async function runCase(testCase: BenchmarkCase, catalog: IndustryCatalog | undefined): Promise<CaseResult> {
  const start = Date.now()
  const orgContext = buildOrgContext(catalog, testCase.industry ?? '')

  const expected = {
    intent: testCase.expected_intent,
    customer: testCase.expected_entities.customer ?? null,
    product: testCase.expected_entities.product ?? null,
    quantity: testCase.expected_entities.quantity ?? null,
    minScore: testCase.expected_min_score,
    decision: testCase.expected_decision,
  }

  const base: Omit<CaseResult, 'passed' | 'criteria' | 'actual' | 'latencyMs' | 'tokens' | 'error'> = {
    id: testCase.id,
    input: testCase.input,
    industry: testCase.industry ?? 'unknown',
    difficulty: testCase.difficulty,
    language: testCase.language,
    expected,
  }

  try {
    // Step 1: classify + extract through the model router (captures tokens + model).
    const contextLines: string[] = []
    if (orgContext.customers.length)
      contextLines.push(`Known customers: ${orgContext.customers.map((c) => c.name).join(', ')}`)
    if (orgContext.products.length)
      contextLines.push(`Known products: ${orgContext.products.map((p) => p.name).join(', ')}`)
    const userContent = contextLines.length
      ? `${contextLines.join('\n')}\n\nMessage: ${testCase.input}`
      : `Message: ${testCase.input}`

    const classifyResp = await routeAI({
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      maxTokens: 800,
    })

    const deepseekTokens = classifyResp.usage.promptTokens + classifyResp.usage.completionTokens

    const parsed = DeepSeekClassifyResponseSchema.parse(extractJson(classifyResp.content))
    const entities = buildEntities(parsed)

    const intent: IntentResult = {
      intent: parsed.intent,
      confidence: parsed.confidence,
      rawMessage: testCase.input,
      language: parsed.language_detected,
    }
    const entityResult: EntityResult = {
      entities,
      confidence: parsed.confidence,
      reasoning: parsed.original_normalized,
    }

    // Step 1b: Layer 0 — dialect dictionary pre-resolution (number words, product/
    // customer slang). Same call + merge as production routeAndProcess. Reads the
    // Tier-3 industry_dictionary from the DB the env points at (local for the run).
    try {
      const dialect = await lookupDialect({
        message: testCase.input,
        orgId: BENCHMARK_ORG_ID,
        industrySegment: orgContext.industrySegment ?? '',
      })
      applyDialectHints(entityResult, dialect)
    } catch {
      // dialect layer is best-effort — never block the case on it
    }

    // Step 2: fuzzy resolution against the industry catalog. Customers use the
    // token-aware scorer (matches production matchCustomer); products use the
    // whole-string scorer (matches matchProduct — token-aware would false-match on
    // shared category tokens like "Housing"/"Fabric").
    const customerEntity = entityResult.entities.find((e) => e.type === 'customer_name')
    const productEntity = entityResult.entities.find((e) => e.type === 'product_name')

    const customerMatch = customerEntity
      ? matchBest(customerEntity.rawValue, orgContext.customers.map((c) => c.name), tokenAwareScore)
      : { matched: null, confidence: 0 }
    const productMatch = productEntity
      ? matchBest(productEntity.rawValue, orgContext.products.map((p) => p.name), scoreAgainst)
      : { matched: null, confidence: 0 }

    if (customerEntity && customerMatch.matched) {
      customerEntity.normalizedValue = customerMatch.matched
      customerEntity.confidence = customerMatch.confidence
    }
    if (productEntity && productMatch.matched) {
      productEntity.normalizedValue = productMatch.matched
      productEntity.confidence = productMatch.confidence
    }

    // Step 3: eval gate scoring (cross-model, via Qwen).
    const evalResult = await evaluateExtraction(
      testCase.input,
      { intent, entities: entityResult },
      orgContext.customers,
      orgContext.products
    )

    // Eval gate token usage is exact — threaded through from the OpenRouter call.
    const qwenTokens = evalResult.usage
      ? evalResult.usage.promptTokens + evalResult.usage.completionTokens
      : 0

    // Step 4: grade against expected values.
    const quantityEntity = entities.find((e) => e.type === 'quantity')
    const actualQuantity = quantityEntity ? Number(quantityEntity.rawValue) : null

    const eqName = (a: string | null, b: string | null): boolean =>
      a != null && b != null && a.toLowerCase().trim() === b.toLowerCase().trim()

    const criteria: Record<Criterion, CriterionResult> = {
      intent: {
        applicable: true,
        passed: parsed.intent === expected.intent,
      },
      customer: {
        applicable: expected.customer != null,
        passed:
          expected.customer != null &&
          eqName(customerMatch.matched, expected.customer) &&
          customerMatch.confidence > MATCH_CONFIDENCE_MIN,
      },
      product: {
        applicable: expected.product != null,
        passed:
          expected.product != null &&
          eqName(productMatch.matched, expected.product) &&
          productMatch.confidence > MATCH_CONFIDENCE_MIN,
      },
      quantity: {
        applicable: expected.quantity != null,
        passed: expected.quantity != null && actualQuantity === expected.quantity,
      },
      eval_score: {
        applicable: true,
        passed: evalResult.compositeScore >= expected.minScore,
      },
    }

    const passed = casePassed(criteria)

    return {
      ...base,
      passed,
      criteria,
      actual: {
        intent: parsed.intent,
        customer: {
          raw: customerEntity?.rawValue ?? null,
          matched: customerMatch.matched,
          confidence: Number(customerMatch.confidence.toFixed(3)),
        },
        product: {
          raw: productEntity?.rawValue ?? null,
          matched: productMatch.matched,
          confidence: Number(productMatch.confidence.toFixed(3)),
        },
        quantity: actualQuantity,
        evalScore: Number(evalResult.compositeScore.toFixed(3)),
        decision: evalResult.decision,
      },
      latencyMs: Date.now() - start,
      tokens: { deepseek: deepseekTokens, qwen: qwenTokens },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const naCriteria: Record<Criterion, CriterionResult> = {
      intent: { applicable: true, passed: false },
      customer: { applicable: expected.customer != null, passed: false },
      product: { applicable: expected.product != null, passed: false },
      quantity: { applicable: expected.quantity != null, passed: false },
      eval_score: { applicable: true, passed: false },
    }
    return {
      ...base,
      passed: false,
      criteria: naCriteria,
      actual: {
        intent: null,
        customer: { raw: null, matched: null, confidence: 0 },
        product: { raw: null, matched: null, confidence: 0 },
        quantity: null,
        evalScore: null,
        decision: null,
      },
      latencyMs: Date.now() - start,
      tokens: { deepseek: 0, qwen: 0 },
      error: message,
    }
  }
}

// A case passes if at most one APPLICABLE criterion fails — generalizes the
// "4/5 or 5/5 criteria met" rule to cases where some entities are not expected.
function casePassed(criteria: Record<Criterion, CriterionResult>): boolean {
  const applicable = Object.values(criteria).filter((c) => c.applicable)
  const failed = applicable.filter((c) => !c.passed).length
  return failed <= 1
}

// ─── Concurrency helper ─────────────────────────────────────────────────────────

async function runWithConcurrency(
  cases: BenchmarkCase[],
  catalogs: Record<string, IndustryCatalog>,
  concurrency: number,
  onResult: (result: CaseResult, done: number, total: number) => void
): Promise<CaseResult[]> {
  const results = new Array<CaseResult>(cases.length)
  let nextIndex = 0
  let done = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++
      if (i >= cases.length) return
      const testCase = cases[i]
      const result = await runCase(testCase, testCase.industry ? catalogs[testCase.industry] : undefined)
      results[i] = result
      done++
      onResult(result, done, cases.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, cases.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// Compact one-line description of a failed case for live supervision.
// e.g. FAIL [textiles/hard/gujlish] hard-tex-012  miss:intent,customer  intent=ORDER_STATUS≠NEW_ORDER cust="raju"→null(0.42)
function formatFailLine(r: CaseResult): string {
  const missed = (Object.keys(r.criteria) as Criterion[]).filter(
    (k) => r.criteria[k].applicable && !r.criteria[k].passed
  )
  const parts: string[] = []
  if (r.error) {
    parts.push(`ERROR=${r.error.slice(0, 80)}`)
  } else {
    if (missed.includes('intent')) parts.push(`intent=${r.actual.intent}≠${r.expected.intent}`)
    if (missed.includes('customer'))
      parts.push(`cust="${r.actual.customer.raw ?? '∅'}"→${r.actual.customer.matched ?? 'null'}(${r.actual.customer.confidence})≠${r.expected.customer}`)
    if (missed.includes('product'))
      parts.push(`prod="${r.actual.product.raw ?? '∅'}"→${r.actual.product.matched ?? 'null'}(${r.actual.product.confidence})≠${r.expected.product}`)
    if (missed.includes('quantity')) parts.push(`qty=${r.actual.quantity}≠${r.expected.quantity}`)
    if (missed.includes('eval_score')) parts.push(`score=${r.actual.evalScore}<${r.expected.minScore}`)
  }
  return `FAIL [${r.industry}/${r.difficulty}/${r.language}] ${r.id}  miss:${missed.join(',')}  ${parts.join(' ')}`
}

// ─── Summary helpers ────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${((n / d) * 100).toFixed(1)}%`
}

function groupBy(results: CaseResult[], key: (r: CaseResult) => string): Map<string, CaseResult[]> {
  const map = new Map<string, CaseResult[]>()
  for (const r of results) {
    const k = key(r)
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  return map
}

function printGroup(title: string, map: Map<string, CaseResult[]>): void {
  console.log(`\n${title}:`)
  const keys = [...map.keys()].sort()
  for (const k of keys) {
    const group = map.get(k)!
    const passed = group.filter((r) => r.passed).length
    console.log(`  ${k.padEnd(16)} ${String(passed).padStart(4)}/${String(group.length).padEnd(4)} (${pct(passed, group.length)})`)
  }
}

function dimensionStats(results: CaseResult[], dim: Criterion): { passed: number; applicable: number } {
  let passed = 0
  let applicable = 0
  for (const r of results) {
    const c = r.criteria[dim]
    if (c.applicable) {
      applicable++
      if (c.passed) passed++
    }
  }
  return { passed, applicable }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; concurrency: number; resume: string | null } {
  let limit: number | null = null
  let concurrency = Number(process.env.BENCHMARK_CONCURRENCY ?? 6)
  let resume: string | null = null
  for (const arg of process.argv.slice(2)) {
    const limitMatch = arg.match(/^--limit=(\d+)$/)
    const concMatch = arg.match(/^--concurrency=(\d+)$/)
    const resumeMatch = arg.match(/^--resume(?:=(.+))?$/)
    if (limitMatch) limit = Number(limitMatch[1])
    if (concMatch) concurrency = Number(concMatch[1])
    if (resumeMatch) resume = resumeMatch[1] ?? 'auto'
  }
  return { limit, concurrency: Math.max(1, concurrency), resume }
}

// Load already-scored cases from a prior run's JSONL so --resume can skip them.
// Only successfully-scored cases are reused; errored cases (e.g. the OpenRouter
// 402 batch) are dropped so they get retried. Returns id → CaseResult.
function loadResumeResults(resumeArg: string, currentStream: string): Map<string, CaseResult> {
  let path = resumeArg
  if (resumeArg === 'auto') {
    const dir = join(process.cwd(), 'tests/ai')
    const candidates = readdirSync(dir)
      .filter((f) => f.startsWith('benchmark-results-') && f.endsWith('.jsonl'))
      .map((f) => join(dir, f))
      .filter((p) => p !== currentStream)
      .sort()
    if (candidates.length === 0) {
      console.error('✖ --resume=auto found no prior benchmark-results-*.jsonl to resume from')
      process.exit(1)
    }
    path = candidates[candidates.length - 1]
  }

  const done = new Map<string, CaseResult>()
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const r = JSON.parse(line) as CaseResult
      if (!r.error) done.set(r.id, r) // reuse only clean results; retry errored ones
    } catch {
      // skip malformed line
    }
  }
  console.log(`Resuming from ${path} — ${done.size} previously-scored cases will be skipped`)
  return done
}

async function main(): Promise<void> {
  const { limit, concurrency, resume } = parseArgs()

  if (!process.env.DEEPSEEK_API_KEY || !process.env.OPENROUTER_API_KEY) {
    console.error('✖ DEEPSEEK_API_KEY and OPENROUTER_API_KEY must be set (run via npm run test:benchmark).')
    process.exit(1)
  }

  const benchmarkPath = join(process.cwd(), 'tests/ai/benchmark.json')
  const file = JSON.parse(readFileSync(benchmarkPath, 'utf-8')) as BenchmarkFile
  const catalogs = file._meta.industry_catalogs
  const allCases = file.test_cases
  const scopedCases = limit != null ? allCases.slice(0, limit) : allCases

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const streamPath = join(process.cwd(), `tests/ai/benchmark-results-${timestamp}.jsonl`)

  // --resume: reuse clean results from a prior run; only run the rest.
  const resumed = resume ? loadResumeResults(resume, streamPath) : new Map<string, CaseResult>()
  const cases = scopedCases.filter((c) => !resumed.has(c.id))

  console.log(`Running ${cases.length} benchmark case(s) — concurrency ${concurrency}${resumed.size ? ` (+${resumed.size} reused)` : ''}`)
  console.log('(classify via model router + eval gate scoring; this calls live AI APIs)')
  console.log(`Live per-case log (tail this for supervision) → ${streamPath}\n`)

  const startedAt = Date.now()
  let passedSoFar = 0
  const freshResults = await runWithConcurrency(cases, catalogs, concurrency, (result, done, total) => {
    if (result.passed) passedSoFar++
    // Stream every completed case to disk as JSONL — enables live mid-run analysis
    // and survives a crash. The final aggregated JSON is still written at the end.
    appendFileSync(streamPath, JSON.stringify(result) + '\n')
    // Print failures live so the run can be supervised from the console.
    if (!result.passed) {
      process.stdout.write(`\r${' '.repeat(40)}\r${formatFailLine(result)}\n`)
    }
    if (done % 25 === 0 || done === total) {
      process.stdout.write(`\r  progress: ${done}/${total} (${pct(passedSoFar, done)} passing so far)`)
    }
  })
  process.stdout.write('\n')
  const wallMs = Date.now() - startedAt

  // Merge freshly-run results with reused ones, in scoped-case order.
  const freshById = new Map(freshResults.map((r) => [r.id, r]))
  const results = scopedCases
    .map((c) => freshById.get(c.id) ?? resumed.get(c.id))
    .filter((r): r is CaseResult => r != null)

  // ── Aggregate ──
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const errored = results.filter((r) => r.error).length

  const totalLatency = results.reduce((s, r) => s + r.latencyMs, 0)
  const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0

  const deepseekTokens = results.reduce((s, r) => s + r.tokens.deepseek, 0)
  const qwenTokens = results.reduce((s, r) => s + r.tokens.qwen, 0)
  const totalTokens = deepseekTokens + qwenTokens

  const costUsd =
    (deepseekTokens / 1_000_000) * DEEPSEEK_USD_PER_M + (qwenTokens / 1_000_000) * QWEN_USD_PER_M
  const costInr = costUsd * USD_TO_INR

  // ── Print summary ──
  console.log('\n' + '═'.repeat(56))
  console.log('  BENCHMARK SUMMARY')
  console.log('═'.repeat(56))
  console.log(`\nTotal: ${passed}/${total} passed (${pct(passed, total)})`)
  if (errored > 0) console.log(`Errored (counted as fail): ${errored}`)

  printGroup('By industry', groupBy(results, (r) => r.industry))
  printGroup('By difficulty', groupBy(results, (r) => r.difficulty))
  printGroup('By language', groupBy(results, (r) => r.language))

  console.log('\nBy dimension:')
  const dims: Array<{ label: string; dim: Criterion }> = [
    { label: 'customer match', dim: 'customer' },
    { label: 'product match', dim: 'product' },
    { label: 'quantity', dim: 'quantity' },
    { label: 'intent', dim: 'intent' },
    { label: 'eval score', dim: 'eval_score' },
  ]
  for (const { label, dim } of dims) {
    const { passed: p, applicable: a } = dimensionStats(results, dim)
    console.log(`  ${label.padEnd(16)} ${String(p).padStart(4)}/${String(a).padEnd(4)} (${pct(p, a)})`)
  }

  console.log('\nPerformance:')
  console.log(`  Average latency: ${avgLatency}ms`)
  console.log(`  Wall-clock time: ${(wallMs / 1000).toFixed(1)}s`)
  console.log(`  Total tokens used: ${totalTokens.toLocaleString()} (deepseek ${deepseekTokens.toLocaleString()}, qwen ${qwenTokens.toLocaleString()})`)
  console.log(`  Estimated cost: ₹${costInr.toFixed(2)} (~$${costUsd.toFixed(3)})`)

  // ── Persist detailed results ──
  const outPath = join(process.cwd(), `tests/ai/benchmark-results-${timestamp}.json`)
  const report = {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: file.version,
    summary: {
      total,
      passed,
      passRate: total > 0 ? passed / total : 0,
      errored,
      avgLatencyMs: avgLatency,
      wallMs,
      tokens: { deepseek: deepseekTokens, qwen: qwenTokens, total: totalTokens },
      estimatedCostInr: Number(costInr.toFixed(2)),
      estimatedCostUsd: Number(costUsd.toFixed(4)),
    },
    results,
  }
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nDetailed results → ${outPath}`)

  // ── Exit code ──
  const passRate = total > 0 ? passed / total : 0
  if (passRate < PASS_THRESHOLD) {
    console.log(`\n✖ FAIL — pass rate ${pct(passed, total)} is below threshold ${(PASS_THRESHOLD * 100).toFixed(0)}%`)
    process.exit(1)
  }
  console.log(`\n✓ PASS — pass rate ${pct(passed, total)} meets threshold ${(PASS_THRESHOLD * 100).toFixed(0)}%`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Benchmark runner crashed:', err)
  process.exit(1)
})
