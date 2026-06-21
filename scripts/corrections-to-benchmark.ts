/**
 * Correction → benchmark case pipeline.
 *
 * Reads owner corrections (the WhatsApp "✏️ Edit" loop, stored in the
 * `corrections` table) and grows the eval-loop benchmark from them:
 *
 *   1. Pulls corrections not yet benchmarked (benchmarked = false).
 *   2. Converts each into a tests/ai/benchmark.json case (same schema the runner
 *      consumes), skipping near-duplicates of cases already in the file.
 *   3. Feeds each correction through the dialect-learning loop
 *      (analyzeCorrection → learnFromCorrection) so dialect mappings land in
 *      org_dictionary (Tier 4) and auto-promote when 3+ orgs agree.
 *   4. Marks the correction rows processed (benchmarked / dialect_processed_at).
 *
 * Net effect: every owner correction improves BOTH the benchmark AND the dialect
 * dictionary. Over time the suite grows 1000 → 2000+ cases automatically.
 *
 * Run:  npm run benchmark:from-corrections
 *   Flags (optional):
 *     --limit=N      process at most N corrections this run
 *     --dry-run      compute + log, but write nothing (no file, no DB updates)
 *     --no-dialect   skip the dialect-learning loop (benchmark growth only)
 *
 * (env is preloaded via `tsx --env-file=.env.local` — do NOT import dotenv here)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { analyzeCorrection, learnFromCorrection } from '@/lib/ai/dialect-learner'
import { levenshtein } from '@/lib/utils/fuzzy-match'
import {
  DeepSeekClassifyResponseSchema,
  type DeepSeekClassifyResponse,
  type IntentType,
  type EvalGateDecision,
} from '@/types/ai'

// ─── Config ─────────────────────────────────────────────────────────────────

const BENCHMARK_PATH = join(process.cwd(), 'tests', 'ai', 'benchmark.json')

// A candidate input is a duplicate if a normalized existing input is within this
// edit-distance ratio (1 = identical). Catches the same message with minor typos.
const DUPE_SIMILARITY = 0.9

// Corrections are, by definition, messages the AI initially got wrong. We hold
// generated cases to the "confirm" band (owner-verified ground truth) rather than
// asserting auto_process — the point is the pipeline should at least reach the
// owner with the right extraction, not necessarily score it 0.85+.
const DEFAULT_MIN_SCORE = 0.7
const DEFAULT_DECISION: EvalGateDecision = 'confirm'

// ─── CLI flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_DIALECT = args.includes('--no-dialect')
const LIMIT = (() => {
  const flag = args.find((a) => a.startsWith('--limit='))
  if (!flag) return 500
  const n = Number(flag.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : 500
})()

// ─── Untyped admin client ───────────────────────────────────────────────────
// `corrections` is a fresh table; the generated Database type may not include it
// yet, so we use a schema-less client here (table names accepted as strings).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
}
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── benchmark.json shapes (mirrors run-benchmark.ts) ───────────────────────

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
  _meta: Record<string, unknown>
  test_cases: BenchmarkCase[]
}

// ─── corrections row (only the fields we read) ──────────────────────────────

interface CorrectionRow {
  id: string
  organization_id: string
  customer_phone: string | null
  original_message: string
  wrong_extraction: Record<string, unknown>
  correct_extraction: Record<string, unknown>
  intent: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeInput(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True if `input` is the same (or near-same) as any existing case input. */
function isDuplicate(input: string, existingNormalized: Set<string>): boolean {
  const norm = normalizeInput(input)
  if (existingNormalized.has(norm)) return true
  for (const ex of existingNormalized) {
    const maxLen = Math.max(norm.length, ex.length)
    if (maxLen === 0) continue
    const similarity = 1 - levenshtein(norm, ex) / maxLen
    if (similarity >= DUPE_SIMILARITY) return true
  }
  return false
}

/**
 * Pull expected_entities + intent out of a correction's correct_extraction.
 * Handles both shapes the flow might store:
 *   - DeepSeekClassifyResponse-like: { intent, entities: { customer_name_raw, ... } }
 *   - flat: { intent, customer, product, quantity, unit, order_ref }
 */
function deriveExpected(
  correct: Record<string, unknown>,
  fallbackIntent: string | null
): { intent: IntentType; entities: ExpectedEntities; language: string } {
  const asStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const asNum = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) ? n : undefined
  }

  const nested =
    correct.entities && typeof correct.entities === 'object'
      ? (correct.entities as Record<string, unknown>)
      : {}

  const pick = (flat: string, raw: string): unknown =>
    correct[flat] ?? nested[flat] ?? nested[raw]

  const entities: ExpectedEntities = {
    customer:
      asStr(pick('customer', 'customer_name_raw')) ??
      asStr(nested.vendor_name_raw),
    product: asStr(pick('product', 'product_raw')),
    quantity: asNum(pick('quantity', 'quantity')),
    unit: asStr(pick('unit', 'unit')),
    order_ref: asStr(pick('order_ref', 'order_ref_raw')),
  }
  // Drop undefined keys so absent fields stay absent (per entities_note).
  for (const k of Object.keys(entities) as (keyof ExpectedEntities)[]) {
    if (entities[k] === undefined) delete entities[k]
  }

  const intentRaw = asStr(correct.intent) ?? fallbackIntent ?? 'GENERAL_QUERY'
  const language =
    asStr(correct.language_detected) ?? asStr(correct.language) ?? 'gujlish'

  return { intent: intentRaw as IntentType, entities, language }
}

/** Build the CorrectionParams the dialect-learner expects from a row. */
async function buildDialectParams(row: CorrectionRow): Promise<{
  rawMessage: string
  aiExtraction: DeepSeekClassifyResponse
  ownerCorrection: Record<string, unknown>
  orgId: string
  industrySegment: string
  orgDictionarySummary: string
} | null> {
  // Coerce the stored wrong_extraction into the schema the analyzer expects.
  const parsed = DeepSeekClassifyResponseSchema.safeParse(row.wrong_extraction)
  if (!parsed.success) {
    // Not enough structure to analyze for dialect — skip dialect for this row.
    return null
  }

  const { data: org } = await admin
    .from('organizations')
    .select('industry_config')
    .eq('id', row.organization_id)
    .single()

  const { data: dictRows } = await admin
    .from('org_dictionary')
    .select('term, canonical')
    .eq('organization_id', row.organization_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(50)

  const orgDictionarySummary =
    (dictRows ?? [])
      .map((d: { term: string; canonical: string }) => `${d.term}→${d.canonical}`)
      .join(', ') || '(empty)'

  return {
    rawMessage: row.original_message,
    aiExtraction: parsed.data,
    ownerCorrection: row.correct_extraction,
    orgId: row.organization_id,
    industrySegment: (org?.industry_config as string) ?? 'foundry',
    orgDictionarySummary,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `[corrections→benchmark] start  (limit=${LIMIT}${DRY_RUN ? ', DRY RUN' : ''}${
      SKIP_DIALECT ? ', no-dialect' : ''
    })`
  )

  // 1. Load benchmark file + index existing inputs for dedup.
  const benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, 'utf8')) as BenchmarkFile
  const existingNormalized = new Set(
    benchmark.test_cases.map((c) => normalizeInput(c.input))
  )
  const startCount = benchmark.test_cases.length

  // 2. Pull unprocessed corrections (oldest first → stable case ids).
  const { data: rows, error } = await admin
    .from('corrections')
    .select(
      'id, organization_id, customer_phone, original_message, wrong_extraction, correct_extraction, intent'
    )
    .eq('benchmarked', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(LIMIT)

  if (error) {
    throw new Error(`Failed to read corrections: ${error.message}`)
  }
  const corrections = (rows ?? []) as CorrectionRow[]
  console.log(`[corrections→benchmark] ${corrections.length} unprocessed correction(s)`)

  let appended = 0
  let skippedDupes = 0
  let dialectHits = 0

  // Sequence counter for generated ids: corr-<industry>-<NNNN>.
  const existingCorrIds = benchmark.test_cases.filter((c) => c.id.startsWith('corr-')).length
  let seq = existingCorrIds

  for (const row of corrections) {
    const { intent, entities, language } = deriveExpected(
      row.correct_extraction,
      row.intent
    )

    // Look up industry for the case label (best-effort).
    const { data: org } = await admin
      .from('organizations')
      .select('industry_config')
      .eq('id', row.organization_id)
      .single()
    const industry = (org?.industry_config as string) ?? 'foundry'

    let caseId: string | null = null

    if (isDuplicate(row.original_message, existingNormalized)) {
      skippedDupes++
      console.log(`  • dupe skip: "${row.original_message.slice(0, 48)}"`)
    } else {
      caseId = `corr-${industry}-${String(seq).padStart(4, '0')}`
      seq++
      const newCase: BenchmarkCase = {
        id: caseId,
        input: row.original_message,
        expected_intent: intent,
        expected_entities: entities,
        expected_min_score: DEFAULT_MIN_SCORE,
        expected_decision: DEFAULT_DECISION,
        language,
        difficulty: 'hard',
        industry,
        notes: `From owner correction ${row.id} (WhatsApp Edit).`,
      }
      benchmark.test_cases.push(newCase)
      existingNormalized.add(normalizeInput(row.original_message))
      appended++
      console.log(`  + case ${caseId}: "${row.original_message.slice(0, 48)}"`)
    }

    // 3. Dialect-learning loop (independent of dedup — a duplicate input can
    //    still teach a new mapping if the dictionary changed since).
    let isDialectIssue: boolean | null = null
    let dialectAnalysis: unknown = null
    if (!SKIP_DIALECT) {
      const params = await buildDialectParams(row)
      if (params) {
        const analysis = await analyzeCorrection(params)
        isDialectIssue = analysis.is_dialect_issue
        dialectAnalysis = analysis
        if (analysis.is_dialect_issue) {
          dialectHits++
          if (!DRY_RUN) {
            await learnFromCorrection(
              analysis,
              params.orgId,
              params.industrySegment
            )
          }
          console.log(
            `    ↳ dialect: ${analysis.new_mappings
              .map((m) => `${m.term}→${m.canonical}`)
              .join(', ')}`
          )
        }
      }
    }

    // 4. Mark the row processed.
    if (!DRY_RUN) {
      const update: Record<string, unknown> = {
        benchmarked: true,
        benchmarked_at: new Date().toISOString(),
      }
      if (caseId) update.benchmark_case_id = caseId
      if (!SKIP_DIALECT) {
        update.is_dialect_issue = isDialectIssue
        update.dialect_analysis = dialectAnalysis
        update.dialect_processed_at = new Date().toISOString()
      }
      const { error: upErr } = await admin
        .from('corrections')
        .update(update)
        .eq('id', row.id)
      if (upErr) {
        console.error(`  ! failed to mark correction ${row.id}: ${upErr.message}`)
      }
    }
  }

  // 5. Persist the grown benchmark file.
  if (appended > 0 && !DRY_RUN) {
    writeFileSync(BENCHMARK_PATH, JSON.stringify(benchmark, null, 2) + '\n', 'utf8')
  }

  console.log('─'.repeat(60))
  console.log(
    `[corrections→benchmark] done: +${appended} cases ` +
      `(${startCount} → ${startCount + appended}), ${skippedDupes} dupes, ` +
      `${dialectHits} dialect hit(s)${DRY_RUN ? '  [DRY RUN — nothing written]' : ''}`
  )
}

main().catch((err) => {
  console.error('[corrections→benchmark] fatal:', err)
  process.exit(1)
})
