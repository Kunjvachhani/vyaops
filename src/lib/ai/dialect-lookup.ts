/**
 * Dialect Dictionary Lookup — Layer 0 Pre-Processing
 *
 * Runs BEFORE any AI call. Tokenizes the raw WhatsApp message,
 * looks up each token across 5 tiers (org→industry→global→business→universal),
 * and returns pre-resolved entities that reduce AI cost + ambiguity.
 *
 * Spec: docs/ai/DIALECT_DICTIONARY.md
 * Integration: docs/ai/DATA_ALIGNMENT_ENGINE.md (Layer 0)
 */

import type {
  DialectLookupParams,
  DialectLookupResult,
  ResolvedToken,
  PreStructuredHints,
} from '@/types/ai';
import { captureWithContext } from '@/lib/utils/sentry';

// Static JSON files (loaded once at module init)
import universalDict from '@/config/dialect/universal.json';
import businessDict from '@/config/dialect/business.json';

// ─── Types ───────────────────────────────────────────────────

type DictEntry = {
  term_normalized: string;
  canonical: string;
  category: string;
  confidence: number;
};

type CacheEntry = {
  entries: Map<string, DictEntry>;
  expiry: number;
};

// ─── Constants ───────────────────────────────────────────────

const ORG_CACHE_TTL_MS = 5 * 60 * 1000;       // 5 minutes
const INDUSTRY_CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes
const GLOBAL_CACHE_TTL_MS = 30 * 60 * 1000;    // 30 minutes

const HONORIFIC_SUFFIXES = [
  'bhai', 'saheb', 'sahab', 'ben', 'ji', 'seth', 'sheth',
  'kaka', 'mama', 'dada', 'ba',
];

// Intent-bearing verb categories
const ORDER_VERBS = new Set(['need', 'send', 'give', 'do', 'make', 'prepare', 'apply']);
const STATUS_VERBS = new Set(['done', 'how much done', 'what happened', 'where is it', 'where reached', 'when will it be done', 'when will I get it', 'is it ready', 'status', 'update']);
const CANCEL_VERBS = new Set(['stop', 'cancel', "don't need", "don't do", 'leave it', 'remove']);
const MODIFY_VERBS = new Set(['change', 'modify', 'update', 'increase', 'more', 'less', 'add', 'more/also', 'on top of', 'another/more', 'another']);

// ─── Caches ──────────────────────────────────────────────────

const orgCache = new Map<string, CacheEntry>();
const industryCache = new Map<string, CacheEntry>();
let globalCacheEntry: CacheEntry | null = null;

// Static dictionaries — flatten into lookup maps at init
const tier1Map = buildStaticMap(universalDict);
const tier2Map = buildStaticMap(businessDict);

// ─── Normalization ───────────────────────────────────────────

/**
 * Normalize a dialect term for lookup.
 * - Lowercase, trim, NFC normalize
 * - Remove punctuation except hyphens
 * - Strip trailing honorifics (-bhai, -saheb, etc.)
 * - Collapse multiple spaces
 */
export function normalizeDialectTerm(raw: string): string {
  let term = raw
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, ' ')
    .trim();

  // Strip trailing honorifics
  for (const suffix of HONORIFIC_SUFFIXES) {
    if (term.endsWith(suffix) && term.length > suffix.length) {
      const stripped = term.slice(0, -suffix.length).trim();
      if (stripped.length > 0) {
        term = stripped;
        break; // only strip one suffix
      }
    }
  }

  return term;
}

// ─── Tokenizer ───────────────────────────────────────────────

/**
 * Tokenize message into 1-gram, 2-gram, and 3-gram candidates.
 * Returns longest-first for greedy matching.
 */
export function tokenize(message: string): string[] {
  const words = message.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];

  // 3-grams first (longest)
  for (let i = 0; i <= words.length - 3; i++) {
    tokens.push(words.slice(i, i + 3).join(' '));
  }
  // 2-grams
  for (let i = 0; i <= words.length - 2; i++) {
    tokens.push(words.slice(i, i + 2).join(' '));
  }
  // 1-grams last (shortest)
  for (const word of words) {
    tokens.push(word);
  }

  return tokens;
}

// ─── Static Map Builder ──────────────────────────────────────

/**
 * Flatten a static JSON dictionary into a Map<normalizedTerm, {canonical, category}>.
 * Handles the nested structure: { "section": { "term": "canonical", ... } }
 */
function buildStaticMap(
  dict: Record<string, unknown>
): Map<string, { canonical: string; category: string }> {
  const map = new Map<string, { canonical: string; category: string }>();

  for (const [section, entries] of Object.entries(dict)) {
    if (section === '_meta') continue;
    if (typeof entries !== 'object' || entries === null) continue;

    for (const [term, canonical] of Object.entries(entries as Record<string, unknown>)) {
      // Accept both string canonicals (verbs, products…) AND numeric ones
      // (number words like "das" → 10). The previous guard skipped all numbers,
      // silently dropping the entire Tier-1 number dictionary.
      if (term === '_note') continue;
      if (typeof canonical !== 'string' && typeof canonical !== 'number') continue;
      map.set(normalizeDialectTerm(term), {
        canonical: String(canonical),
        category: section,
      });
    }
  }

  return map;
}

// ─── DB Lookups (with caching) ───────────────────────────────

async function getOrgDictionary(orgId: string): Promise<Map<string, DictEntry>> {
  const cached = orgCache.get(orgId);
  if (cached && cached.expiry > Date.now()) return cached.entries;

  // Dynamic import to avoid circular deps at module init
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Map();
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from('org_dictionary')
    .select('term_normalized, canonical, category, confidence, entity_id, entity_type')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error || !data) {
    captureWithContext(new Error(error?.message ?? 'org_dictionary query failed'), { action: 'dialect-lookup/org_dictionary', org_id: orgId })
    return new Map();
  }

  const entries = new Map<string, DictEntry>();
  for (const row of data) {
    entries.set(row.term_normalized, {
      term_normalized: row.term_normalized,
      canonical: row.canonical,
      category: row.category,
      confidence: Number(row.confidence),
    });
  }

  orgCache.set(orgId, { entries, expiry: Date.now() + ORG_CACHE_TTL_MS });
  return entries;
}

async function getIndustryDictionary(segment: string): Promise<Map<string, DictEntry>> {
  const cached = industryCache.get(segment);
  if (cached && cached.expiry > Date.now()) return cached.entries;

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Map();
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from('industry_dictionary')
    .select('term_normalized, canonical, category, confidence')
    .eq('industry_segment', segment)
    .eq('is_active', true);

  if (error || !data) {
    captureWithContext(new Error(error?.message ?? 'industry_dictionary query failed'), { action: 'dialect-lookup/industry_dictionary', segment })
    return new Map();
  }

  const entries = new Map<string, DictEntry>();
  for (const row of data) {
    entries.set(row.term_normalized, {
      term_normalized: row.term_normalized,
      canonical: row.canonical,
      category: row.category,
      confidence: Number(row.confidence),
    });
  }

  industryCache.set(segment, { entries, expiry: Date.now() + INDUSTRY_CACHE_TTL_MS });
  return entries;
}

async function getGlobalDictionary(): Promise<Map<string, DictEntry>> {
  if (globalCacheEntry && globalCacheEntry.expiry > Date.now()) {
    return globalCacheEntry.entries;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Map();
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from('global_dictionary')
    .select('term_normalized, canonical, category, confidence')
    .eq('is_active', true);

  if (error || !data) {
    captureWithContext(new Error(error?.message ?? 'global_dictionary query failed'), { action: 'dialect-lookup/global_dictionary' })
    return new Map();
  }

  const entries = new Map<string, DictEntry>();
  for (const row of data) {
    entries.set(row.term_normalized, {
      term_normalized: row.term_normalized,
      canonical: row.canonical,
      category: row.category,
      confidence: Number(row.confidence),
    });
  }

  globalCacheEntry = { entries, expiry: Date.now() + GLOBAL_CACHE_TTL_MS };
  return entries;
}

// ─── Main Lookup ─────────────────────────────────────────────

/**
 * 5-tier dialect dictionary lookup.
 * Tier 4 (org) → Tier 3 (industry) → Tier 5 (global) → Tier 2 (business) → Tier 1 (universal)
 * First hit wins per token. Greedy matching (longest tokens first).
 */
export async function lookupDialect(
  params: DialectLookupParams
): Promise<DialectLookupResult> {
  const startTime = Date.now();
  const { message, orgId, industrySegment } = params;

  // Load DB dictionaries in parallel
  const [orgDict, industryDict, globalDict] = await Promise.all([
    getOrgDictionary(orgId),
    getIndustryDictionary(industrySegment),
    getGlobalDictionary(),
  ]);

  const tokens = tokenize(message);
  const resolvedTokens: ResolvedToken[] = [];
  const consumedPositions = new Set<number>(); // track which word indices are consumed
  const words = message.trim().split(/\s+/);

  for (const token of tokens) {
    const normalized = normalizeDialectTerm(token);
    if (!normalized) continue;

    // Find the word indices this token covers
    const tokenWords = token.split(/\s+/);
    const startIdx = findTokenStart(words, tokenWords, consumedPositions);
    if (startIdx === -1) continue; // already consumed

    // Try each tier in order
    let resolved: ResolvedToken | null = null;

    // Tier 4: Org dictionary
    const orgEntry = orgDict.get(normalized);
    if (orgEntry) {
      resolved = {
        token,
        canonical: orgEntry.canonical,
        tier: 4,
        category: orgEntry.category,
        confidence: orgEntry.confidence,
      };
    }

    // Tier 3: Industry dictionary
    if (!resolved) {
      const indEntry = industryDict.get(normalized);
      if (indEntry) {
        resolved = {
          token,
          canonical: indEntry.canonical,
          tier: 3,
          category: indEntry.category,
          confidence: indEntry.confidence,
        };
      }
    }

    // Tier 5: Global dictionary
    if (!resolved) {
      const globalEntry = globalDict.get(normalized);
      if (globalEntry) {
        resolved = {
          token,
          canonical: globalEntry.canonical,
          tier: 5,
          category: globalEntry.category,
          confidence: globalEntry.confidence,
        };
      }
    }

    // Tier 2: Business vocabulary (static JSON)
    if (!resolved) {
      const bizEntry = tier2Map.get(normalized);
      if (bizEntry) {
        resolved = {
          token,
          canonical: bizEntry.canonical,
          tier: 2,
          category: bizEntry.category,
          confidence: 1.0,
        };
      }
    }

    // Tier 1: Universal Gujarati language base (static JSON)
    if (!resolved) {
      const uniEntry = tier1Map.get(normalized);
      if (uniEntry) {
        resolved = {
          token,
          canonical: uniEntry.canonical,
          tier: 1,
          category: uniEntry.category,
          confidence: 1.0,
        };
      }
    }

    if (resolved) {
      resolvedTokens.push(resolved);
      // Mark word positions as consumed
      for (let i = startIdx; i < startIdx + tokenWords.length; i++) {
        consumedPositions.add(i);
      }
    }
  }

  // Collect unresolved tokens (words not consumed by any match)
  const unresolvedTokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!consumedPositions.has(i)) {
      unresolvedTokens.push(words[i]);
    }
  }

  // Build pre-structured hints from resolved tokens
  const preStructured = buildPreStructuredHints(resolvedTokens);

  return {
    resolved_tokens: resolvedTokens,
    pre_structured: preStructured,
    unresolved_tokens: unresolvedTokens,
    raw_message: message,
    lookup_time_ms: Date.now() - startTime,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Find the starting word index of a token in the word array,
 * skipping positions already consumed.
 */
function findTokenStart(
  words: string[],
  tokenWords: string[],
  consumed: Set<number>
): number {
  outer:
  for (let i = 0; i <= words.length - tokenWords.length; i++) {
    // Check no positions are consumed
    for (let j = 0; j < tokenWords.length; j++) {
      if (consumed.has(i + j)) continue outer;
    }
    // Check words match (case-insensitive)
    let match = true;
    for (let j = 0; j < tokenWords.length; j++) {
      if (words[i + j].toLowerCase() !== tokenWords[j].toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Build pre-structured hints from resolved tokens.
 * Extracts: quantity, customer_hint, product_hint, intent_hint.
 */
function buildPreStructuredHints(tokens: ResolvedToken[]): PreStructuredHints {
  const hints: PreStructuredHints = {};

  for (const t of tokens) {
    // Numbers → quantity
    if (t.category === 'numbers' || t.category === 'number') {
      const num = Number(t.canonical);
      if (!isNaN(num) && num > 0) {
        hints.quantity = num;
      }
    }

    // Product resolutions
    if (t.category === 'product') {
      hints.product_hint = t.canonical;
    }

    // Customer resolutions
    if (t.category === 'customer') {
      hints.customer_hint = t.canonical;
    }

    // Intent from verbs
    if (
      t.category === 'verbs_order' ||
      t.category === 'order_terms'
    ) {
      if (ORDER_VERBS.has(t.canonical) || t.category === 'order_terms') {
        hints.intent_hint = 'NEW_ORDER';
      }
    }
    if (t.category === 'verbs_status') {
      if (STATUS_VERBS.has(t.canonical)) {
        hints.intent_hint = 'ORDER_STATUS';
      }
    }
    if (t.category === 'verbs_cancel') {
      if (CANCEL_VERBS.has(t.canonical)) {
        hints.intent_hint = 'CANCEL_ORDER';
      }
    }
    if (t.category === 'verbs_modify') {
      if (MODIFY_VERBS.has(t.canonical)) {
        hints.intent_hint = 'MODIFY_ORDER';
      }
    }
  }

  return hints;
}

/**
 * Invalidate org dictionary cache (call after learning new terms).
 */
export function invalidateOrgCache(orgId: string): void {
  orgCache.delete(orgId);
}

/**
 * Invalidate industry dictionary cache (call after promotions).
 */
export function invalidateIndustryCache(segment: string): void {
  industryCache.delete(segment);
}

/**
 * Invalidate global dictionary cache (call after promotions).
 */
export function invalidateGlobalCache(): void {
  globalCacheEntry = null;
}
