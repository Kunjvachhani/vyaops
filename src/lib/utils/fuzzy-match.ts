import type { Database } from '@/types/database'
import { adminClient } from '@/lib/supabase/admin'

type Customer = Database['public']['Tables']['customers']['Row']
type Product = Database['public']['Tables']['products']['Row']

export type MatchResult<T> = {
  match: T | null
  confidence: number
  alternatives: T[]
}

// --- Levenshtein distance ---
// Spreads strings into Unicode code point arrays so Gujarati/Hindi characters
// each count as one unit rather than multiple UTF-16 code units.

export function levenshtein(a: string, b: string): number {
  const aChars = [...a]
  const bChars = [...b]
  const m = aChars.length
  const n = bChars.length

  if (m === 0) return n
  if (n === 0) return m

  // Two-row rolling array — O(n) space
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = aChars[i - 1] === bChars[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]
}

// --- Indian phonetic normalization ---

// Collapses aspiration digraphs (bh→b, sh→s, th→t, …), doubles vowels
// (aa→a, ee→i, …), and repeated consonants (kumarr→kumar, patell→patel)
// before applying the Soundex-like code.
function toPhoneticToken(name: string): string {
  let s = name.toLowerCase().trim()

  // Vowel-length normalisation
  s = s.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/ii/g, 'i').replace(/oo/g, 'u')

  // Aspirate equivalences → base consonant
  s = s
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'p')
    .replace(/ch/g, 'c')
    .replace(/jh/g, 'j')

  // Collapse doubled consonants
  s = s.replace(/(.)\1+/g, '$1')

  return s.replace(/[^a-z]/g, '')
}

// 6-character Soundex-like code for Indian romanised names.
// Larger than the 4-char US Soundex to differentiate longer Indian surnames.
function indianSoundexCode(name: string): string {
  const token = toPhoneticToken(name)
  if (!token) return ''

  const codeMap: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  }

  let code = token[0].toUpperCase()
  let prevDigit = codeMap[token[0]] ?? '0'

  for (let i = 1; i < token.length && code.length < 6; i++) {
    const digit = codeMap[token[i]] ?? '0'
    if (digit !== '0' && digit !== prevDigit) {
      code += digit
      prevDigit = digit
    }
  }

  return code.padEnd(4, '0')
}

// Returns true when two romanised Indian names are phonetically equivalent:
// exact Soundex code match, or the same first-3-digit prefix (covers longer
// name variants that differ in suffix syllables).
export function soundexMatch(a: string, b: string): boolean {
  const ca = indianSoundexCode(a)
  const cb = indianSoundexCode(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const prefix = ca.slice(0, 3)
  return prefix !== '000' && prefix === cb.slice(0, 3)
}

// --- In-memory cache ---

const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry<T> {
  data: T[]
  fetchedAt: number
}

const customerCache = new Map<string, CacheEntry<Customer>>()
const productCache = new Map<string, CacheEntry<Product>>()

function isFresh<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

async function getCustomers(orgId: string): Promise<Customer[]> {
  const cached = customerCache.get(orgId)
  if (cached && isFresh(cached)) return cached.data

  const { data, error } = await adminClient
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (error) throw new Error(`fuzzy-match: failed to fetch customers: ${error.message}`)

  const entry: CacheEntry<Customer> = { data: data ?? [], fetchedAt: Date.now() }
  customerCache.set(orgId, entry)
  return entry.data
}

async function getProducts(orgId: string): Promise<Product[]> {
  const cached = productCache.get(orgId)
  if (cached && isFresh(cached)) return cached.data

  const { data, error } = await adminClient
    .from('products')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (error) throw new Error(`fuzzy-match: failed to fetch products: ${error.message}`)

  const entry: CacheEntry<Product> = { data: data ?? [], fetchedAt: Date.now() }
  productCache.set(orgId, entry)
  return entry.data
}

// --- Scoring ---

function normalizeStr(s: string): string {
  return s.toLowerCase().trim()
}

// Indian honorifics that customers prepend/append to names in WhatsApp
const HONORIFICS = new Set([
  'bhai', 'saheb', 'sahab', 'ben', 'ji', 'seth', 'sheth',
  'kaka', 'mama', 'dada', 'ba', 'sir', 'madam', 'sir',
])

/**
 * Strip common Indian honorifics from a name string.
 * "patel saheb" → "patel", "vijay bhai" → "vijay", "ji patel" → "patel"
 */
function stripHonorifics(name: string): string {
  const words = normalizeStr(name).split(/\s+/)
  const filtered = words.filter(w => !HONORIFICS.has(w))
  return filtered.length > 0 ? filtered.join(' ') : normalizeStr(name)
}

function scoreAgainst(raw: string, candidate: string): number {
  const a = normalizeStr(raw)
  const b = normalizeStr(candidate)

  if (a === b) return 1.0

  const maxLen = Math.max([...a].length, [...b].length)
  if (maxLen === 0) return 1.0

  const levSim = 1 - levenshtein(a, b) / maxLen
  const phoneticBonus = soundexMatch(raw, candidate) ? 0.15 : 0

  return Math.min(1.0, levSim + phoneticBonus)
}

/**
 * Token-aware scoring for customer names.
 * Scores the raw input against:
 *   1. The full candidate string
 *   2. Each individual token (first name, last name) of the candidate
 *   3. Honorific-stripped versions of both raw and candidate
 * Takes the max across all comparisons.
 *
 * This fixes the core matching failure: "vijay" vs "Vijay Mehta" now scores
 * via first-token match (1.0) instead of whole-string Levenshtein (0.46).
 */
function tokenAwareScore(raw: string, candidate: string): number {
  const rawStripped = stripHonorifics(raw)
  const candidateStripped = stripHonorifics(candidate)

  const scores: number[] = [
    // Full-string comparisons
    scoreAgainst(raw, candidate),
    scoreAgainst(rawStripped, candidateStripped),
  ]

  // Score raw against each token of the candidate name
  const candidateTokens = candidateStripped.split(/\s+/)
  if (candidateTokens.length > 1) {
    for (const token of candidateTokens) {
      if (token.length >= 2) {
        scores.push(scoreAgainst(rawStripped, token))
      }
    }
  }

  // Score each token of raw against each token of candidate (for multi-word raw inputs)
  const rawTokens = rawStripped.split(/\s+/)
  if (rawTokens.length > 1) {
    for (const rt of rawTokens) {
      if (rt.length < 2) continue
      scores.push(scoreAgainst(rt, candidateStripped))
      for (const ct of candidateTokens) {
        if (ct.length >= 2) {
          scores.push(scoreAgainst(rt, ct))
        }
      }
    }
  }

  return Math.max(...scores)
}

function bestScoreForFields(raw: string, fields: string[]): number {
  const scores = fields.filter(f => f.length > 0).map(f => scoreAgainst(raw, f))
  return scores.length > 0 ? Math.max(...scores) : 0
}

/**
 * Like bestScoreForFields but uses token-aware scoring (for customer matching).
 */
function bestTokenAwareScore(raw: string, fields: string[]): number {
  const scores = fields.filter(f => f.length > 0).map(f => tokenAwareScore(raw, f))
  return scores.length > 0 ? Math.max(...scores) : 0
}

// --- matchCustomer ---
// Searches customer.name, customer.aliases, and customer.company_name.
// (The schema has no contact_person column; company_name is the equivalent secondary field.)

export async function matchCustomer(
  orgId: string,
  rawName: string,
): Promise<MatchResult<Customer>> {
  const customers = await getCustomers(orgId)
  const rawNorm = normalizeStr(rawName)
  const rawStripped = stripHonorifics(rawName)

  // Fast path: exact match on name, first-name token, or any alias (case-insensitive)
  for (const customer of customers) {
    const nameNorm = normalizeStr(customer.name)
    const nameStripped = stripHonorifics(customer.name)
    const firstToken = nameStripped.split(/\s+/)[0]

    if (
      nameNorm === rawNorm ||
      nameStripped === rawStripped ||
      (firstToken.length >= 2 && firstToken === rawStripped) ||
      customer.aliases.some(a => normalizeStr(a) === rawNorm || normalizeStr(a) === rawStripped)
    ) {
      return { match: customer, confidence: 1.0, alternatives: [] }
    }
  }

  // Fuzzy path: token-aware scoring (scores against individual name tokens)
  const scored = customers
    .map(customer => ({
      customer,
      score: bestTokenAwareScore(rawName, [
        customer.name,
        ...customer.aliases,
        customer.company_name ?? '',
      ]),
    }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]

  if (!top || top.score < 0.60) {
    return { match: null, confidence: top?.score ?? 0, alternatives: [] }
  }

  if (top.score >= 0.80) {
    return { match: top.customer, confidence: top.score, alternatives: [] }
  }

  return {
    match: null,
    confidence: top.score,
    alternatives: scored.slice(0, 3).map(s => s.customer),
  }
}

// --- matchProduct ---
// Searches product.name and product.aliases.

export async function matchProduct(
  orgId: string,
  rawName: string,
): Promise<MatchResult<Product>> {
  const products = await getProducts(orgId)
  const rawNorm = normalizeStr(rawName)

  // Fast path: exact match on name or any alias (case-insensitive)
  for (const product of products) {
    if (
      normalizeStr(product.name) === rawNorm ||
      product.aliases.some(a => normalizeStr(a) === rawNorm)
    ) {
      return { match: product, confidence: 1.0, alternatives: [] }
    }
  }

  const scored = products
    .map(product => ({
      product,
      score: bestScoreForFields(rawName, [product.name, ...product.aliases]),
    }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]

  if (!top || top.score < 0.60) {
    return { match: null, confidence: top?.score ?? 0, alternatives: [] }
  }

  if (top.score >= 0.85) {
    return { match: top.product, confidence: top.score, alternatives: [] }
  }

  return {
    match: null,
    confidence: top.score,
    alternatives: scored.slice(0, 3).map(s => s.product),
  }
}
