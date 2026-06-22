/**
 * Dialect Learning Module
 *
 * Handles:
 * 1. Analyzing owner corrections to discover new dialect mappings
 * 2. Upserting learned terms into org_dictionary (Tier 4)
 * 3. Promoting terms to industry_dictionary (Tier 3) or global_dictionary (Tier 5)
 *    when 3+ orgs confirm the same mapping
 * 4. Generating onboarding dictionaries (Prompt #10)
 * 5. Owner confirmation of AI-generated aliases
 *
 * Spec: docs/ai/DIALECT_DICTIONARY.md — "Learning Loop" section
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  CorrectionParams,
  CorrectionAnalysis,
  OnboardingDictParams,
  OnboardingDictResult,
  NewDialectMapping,
} from '@/types/ai';
import { captureWithContext } from '@/lib/utils/sentry';
import {
  CorrectionAnalysisSchema,
  OnboardingDictResultSchema,
} from '@/types/ai';
import { normalizeDialectTerm, invalidateOrgCache, invalidateIndustryCache, invalidateGlobalCache } from './dialect-lookup';

// ─── Constants ───────────────────────────────────────────────

const PROMOTION_THRESHOLD = 3; // orgs needed to promote to shared dictionary

// ─── Analyze Correction ──────────────────────────────────────

/**
 * Analyze an owner's correction to determine if it reveals a dialect mapping.
 * Calls Prompt #11 (Correction Analyzer) via DeepSeek.
 */
export async function analyzeCorrection(
  params: CorrectionParams
): Promise<CorrectionAnalysis> {
  // Dynamic import to avoid circular deps
  const { callAI } = await getAIClient();

  const systemPrompt = `An owner corrected an AI-generated draft. Analyze whether this correction reveals a new dialect/slang mapping.

Original message: ${params.rawMessage}
AI extracted: ${JSON.stringify(params.aiExtraction)}
Owner corrected to: ${JSON.stringify(params.ownerCorrection)}
Existing org dictionary: ${params.orgDictionarySummary}

Questions:
1. Was this a DIALECT issue (the AI didn't know a word/alias) or a LOGIC issue (the AI knew the words but made the wrong inference)?
2. If dialect: what is the term→canonical mapping to add to the org dictionary?
3. Is this mapping likely org-specific or would other factories in the same industry use it?

RESPONSE FORMAT (strict JSON):
{
  "is_dialect_issue": true,
  "new_mappings": [
    {
      "term": "pamp bodi",
      "canonical": "Pump Housing",
      "category": "product",
      "likely_scope": "industry"
    }
  ],
  "reasoning": "explanation"
}`;

  try {
    const response = await callAI({
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.1,
      maxTokens: 500,
    });

    const parsed = JSON.parse(response.content);
    const validated = CorrectionAnalysisSchema.parse(parsed);

    return {
      is_dialect_issue: validated.is_dialect_issue,
      new_mappings: validated.new_mappings,
      reasoning: validated.reasoning,
    };
  } catch (error) {
    captureWithContext(error, { action: 'dialect-learner/analyzeCorrection' })
    // Safety default: not a dialect issue (don't learn from failed analysis)
    return {
      is_dialect_issue: false,
      new_mappings: [],
      reasoning: 'Analysis failed — defaulting to no dialect issue',
    };
  }
}

// ─── Learn From Correction ───────────────────────────────────

/**
 * Process a correction analysis and update dictionaries.
 * 1. Upsert into org_dictionary (Tier 4)
 * 2. Check promotion eligibility to Tier 3/5
 */
export async function learnFromCorrection(
  analysis: CorrectionAnalysis,
  orgId: string,
  industrySegment: string
): Promise<void> {
  if (!analysis.is_dialect_issue || analysis.new_mappings.length === 0) {
    return;
  }

  const admin = await getAdminClient();

  for (const mapping of analysis.new_mappings) {
    const termNormalized = normalizeDialectTerm(mapping.term);

    // Step 1: Upsert into org_dictionary
    await upsertOrgDictionary(admin, orgId, mapping, termNormalized);

    // Step 2: Check promotion eligibility
    await checkAndPromote(admin, mapping, termNormalized, industrySegment);
  }

  // Invalidate caches
  invalidateOrgCache(orgId);
}

/**
 * Upsert a term into the org_dictionary.
 * If already exists, bump confidence.
 */
async function upsertOrgDictionary(
  admin: SupabaseAdmin,
  orgId: string,
  mapping: NewDialectMapping,
  termNormalized: string
): Promise<void> {
  // Check if exists
  const { data: existing } = await admin
    .from('org_dictionary')
    .select('id, confidence')
    .eq('organization_id', orgId)
    .eq('term_normalized', termNormalized)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (existing) {
    // Bump confidence (max 1.0)
    const newConfidence = Math.min(Number(existing.confidence) + 0.1, 1.0);
    await admin
      .from('org_dictionary')
      .update({ confidence: newConfidence })
      .eq('id', existing.id);
  } else {
    // Insert new entry
    await admin.from('org_dictionary').insert({
      organization_id: orgId,
      term: mapping.term,
      term_normalized: termNormalized,
      canonical: mapping.canonical,
      category: mapping.category,
      source: 'owner_correction',
      confidence: 0.9,
      is_active: true,
    });
  }
}

/**
 * Check if a mapping should be promoted to industry or global dictionary.
 * Promotion requires 3+ different orgs confirming the same term→canonical.
 */
async function checkAndPromote(
  admin: SupabaseAdmin,
  mapping: NewDialectMapping,
  termNormalized: string,
  industrySegment: string
): Promise<void> {
  // Count distinct orgs with this same mapping in org_dictionary
  const { data: orgMatches, error } = await admin
    .from('org_dictionary')
    .select('organization_id')
    .eq('term_normalized', termNormalized)
    .eq('canonical', mapping.canonical)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error || !orgMatches) return;

  const distinctOrgs = new Set(orgMatches.map((m: { organization_id: string }) => m.organization_id));
  const orgCount = distinctOrgs.size;

  if (orgCount < PROMOTION_THRESHOLD) return;

  // Promote based on scope
  if (mapping.likely_scope === 'industry') {
    await promoteToIndustry(admin, mapping, termNormalized, industrySegment, orgCount);
    invalidateIndustryCache(industrySegment);
  } else {
    await promoteToGlobal(admin, mapping, termNormalized, orgCount);
    invalidateGlobalCache();
  }
}

async function promoteToIndustry(
  admin: SupabaseAdmin,
  mapping: NewDialectMapping,
  termNormalized: string,
  industrySegment: string,
  orgCount: number
): Promise<void> {
  const { data: existing } = await admin
    .from('industry_dictionary')
    .select('id, promotion_count')
    .eq('term_normalized', termNormalized)
    .eq('industry_segment', industrySegment)
    .eq('is_active', true)
    .single();

  if (existing) {
    await admin
      .from('industry_dictionary')
      .update({ promotion_count: orgCount })
      .eq('id', existing.id);
  } else {
    await admin.from('industry_dictionary').insert({
      term: mapping.term,
      term_normalized: termNormalized,
      canonical: mapping.canonical,
      category: mapping.category,
      industry_segment: industrySegment,
      language: 'gujlish',
      source: 'promotion',
      promotion_count: orgCount,
      confidence: 0.85,
      is_active: true,
    });
  }
}

async function promoteToGlobal(
  admin: SupabaseAdmin,
  mapping: NewDialectMapping,
  termNormalized: string,
  orgCount: number
): Promise<void> {
  const { data: existing } = await admin
    .from('global_dictionary')
    .select('id, taught_by_count')
    .eq('term_normalized', termNormalized)
    .eq('canonical', mapping.canonical)
    .eq('is_active', true)
    .single();

  if (existing) {
    await admin
      .from('global_dictionary')
      .update({
        taught_by_count: orgCount,
        last_confirmed_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await admin.from('global_dictionary').insert({
      term: mapping.term,
      term_normalized: termNormalized,
      canonical: mapping.canonical,
      category: mapping.category,
      language: 'gujlish',
      taught_by_count: orgCount,
      confidence: 0.7,
      is_active: true,
    });
  }
}

// ─── Onboarding Dictionary Generation ────────────────────────

/**
 * Generate initial dialect dictionary entries during org onboarding.
 * Calls Prompt #10 (Onboarding Dictionary Generator) via DeepSeek.
 * Returns AI-suggested aliases for review by the owner.
 */
export async function generateOnboardingDictionary(
  params: OnboardingDictParams
): Promise<OnboardingDictResult> {
  const { callAI } = await getAIClient();

  const systemPrompt = `You are generating a dialect dictionary for an Indian manufacturing factory that uses WhatsApp in Gujarati, Hindi, Hinglish, and Gujlish.

Factory details:
- Industry: ${params.industrySegment}
- Language preference: ${params.languagePreference}

Product catalog:
${JSON.stringify(params.products)}

Customer list:
${JSON.stringify(params.customers)}

For each product and customer, generate likely aliases that factory owners would type on WhatsApp:
1. Phonetic Gujlish (Roman-script Gujarati pronunciation)
2. Common abbreviations
3. Common misspellings (voice-to-text errors, typos)
4. Hindi transliteration
5. Factory-floor nicknames

RESPONSE FORMAT (strict JSON):
{
  "products": [{"name": "Valve Body", "aliases": ["valv bodi", "vb", "valve"]}],
  "customers": [{"name": "Rajesh Patel", "aliases": ["rajesh", "rajubhai", "raju"]}]
}`;

  try {
    const response = await callAI({
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.3,
      maxTokens: 2000,
    });

    const parsed = JSON.parse(response.content);
    return OnboardingDictResultSchema.parse(parsed);
  } catch (error) {
    captureWithContext(error, { action: 'dialect-learner/generateOnboardingDictionary' })
    return { products: [], customers: [] };
  }
}

/**
 * Bulk-insert AI-generated aliases into org_dictionary.
 * Source = 'onboarding_ai', confidence = 0.7 (not yet owner-confirmed).
 */
export async function saveOnboardingDictionary(
  orgId: string,
  result: OnboardingDictResult,
  productIdMap: Map<string, string>,
  customerIdMap: Map<string, string>
): Promise<number> {
  const admin = await getAdminClient();
  let insertCount = 0;

  // Products
  for (const product of result.products) {
    const entityId = productIdMap.get(product.name);
    for (const alias of product.aliases) {
      const termNormalized = normalizeDialectTerm(alias);
      if (!termNormalized) continue;

      const { error } = await admin.from('org_dictionary').upsert(
        {
          organization_id: orgId,
          term: alias,
          term_normalized: termNormalized,
          canonical: product.name,
          category: 'product',
          entity_id: entityId ?? null,
          entity_type: entityId ? 'product' : null,
          source: 'onboarding_ai',
          confidence: 0.7,
          is_active: true,
        },
        { onConflict: 'organization_id,term_normalized', ignoreDuplicates: true }
      );

      if (!error) insertCount++;
    }
  }

  // Customers
  for (const customer of result.customers) {
    const entityId = customerIdMap.get(customer.name);
    for (const alias of customer.aliases) {
      const termNormalized = normalizeDialectTerm(alias);
      if (!termNormalized) continue;

      const { error } = await admin.from('org_dictionary').upsert(
        {
          organization_id: orgId,
          term: alias,
          term_normalized: termNormalized,
          canonical: customer.name,
          category: 'customer',
          entity_id: entityId ?? null,
          entity_type: entityId ? 'customer' : null,
          source: 'onboarding_ai',
          confidence: 0.7,
          is_active: true,
        },
        { onConflict: 'organization_id,term_normalized', ignoreDuplicates: true }
      );

      if (!error) insertCount++;
    }
  }

  invalidateOrgCache(orgId);
  return insertCount;
}

/**
 * Owner confirms or rejects an AI-generated dictionary entry.
 */
export async function confirmOnboardingEntry(
  orgId: string,
  entryId: string,
  confirmed: boolean
): Promise<void> {
  const admin = await getAdminClient();

  if (confirmed) {
    await admin
      .from('org_dictionary')
      .update({ confidence: 1.0, source: 'onboarding_confirmed' })
      .eq('id', entryId)
      .eq('organization_id', orgId);
  } else {
    await admin
      .from('org_dictionary')
      .update({ is_active: false })
      .eq('id', entryId)
      .eq('organization_id', orgId);
  }

  invalidateOrgCache(orgId);
}

// ─── Helpers ─────────────────────────────────────────────────

type SupabaseAdmin = SupabaseClient<Database>;

async function getAdminClient(): Promise<SupabaseAdmin> {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

async function getAIClient() {
  // Import model-router's AI call function (routeAI: AIRequest → AIResponse,
  // picks DeepSeek/Qwen + handles fallback). Dynamic import avoids a circular
  // dependency at module init.
  try {
    const router = await import('./model-router');
    return { callAI: router.routeAI };
  } catch {
    // Fallback: direct DeepSeek call if model-router fails to import
    const deepseek = await import('./deepseek');
    return { callAI: deepseek.callDeepSeek };
  }
}
