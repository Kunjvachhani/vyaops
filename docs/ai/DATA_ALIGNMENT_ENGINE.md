# Data Alignment Engine — 6 Layers

## The Challenge
Messages like: "rajubhai no order 500 piece valve body kal deliver"
Mixed Gujarati/Hindi/Hinglish/English, misspellings, abbreviations, no punctuation.

## Layer 0: Dialect Dictionary Pre-Processing (NEW)
**Before any AI call**, the message passes through the 5-tier dialect dictionary lookup.
See `docs/ai/DIALECT_DICTIONARY.md` for full architecture.

```
Raw message → Dialect Lookup (Tier 4→3→5→2→1) → Normalized message + resolved tokens
```

Lookup order:
1. **Tier 4 — Org Dictionary** (DB: `org_dictionary`, per-org RLS): Custom aliases set during onboarding
2. **Tier 3 — Industry Dictionary** (DB: `industry_dictionary`, shared): Jargon for 50 Gujarat MSME segments
3. **Tier 5 — Global Learning Pool** (DB: `global_dictionary`, shared): Crowd-sourced mappings from all users
4. **Tier 2 — Business Vocabulary** (static: `src/config/dialect/business.json`): Cross-industry transaction terms
5. **Tier 1 — Gujarati Language Base** (static: `src/config/dialect/universal.json`): Numbers, verbs, postpositions

Result: a `DialectLookupResult` with pre-resolved tokens (quantity, customer hint, product hint, intent hint) passed alongside the raw message to DeepSeek. Tokens resolved by the dictionary skip AI inference entirely — cheaper, faster, more accurate.

**Module:** `src/lib/ai/dialect-lookup.ts`

## Layer 1: Language Detection + Normalization
DeepSeek V4 Pro detects language, expands abbreviations (pcs→pieces, qty→quantity), normalizes common misspellings. System prompt includes manufacturing vocabulary in Gujarati/Hindi/English. Now receives pre-resolved tokens from Layer 0 as additional context, reducing ambiguity.

## Layer 2: Intent Classification
Categories: NEW_ORDER, ORDER_STATUS, MODIFY_ORDER, CANCEL_ORDER, VENDOR_ORDER, PRODUCTION_UPDATE, INVOICE_REQUEST, PAYMENT_UPDATE, INVENTORY_CHECK, COMPLIANCE_QUERY, GENERAL_QUERY
Returns: { intent, confidence }

## Layer 3: Entity Extraction
Extracts: customer_name_raw, product_raw, quantity, unit, price, date, defect_type
Returns structured JSON with raw extracted values.
Pre-resolved entities from Layer 0 are passed through — AI validates rather than discovers.

## Layer 4: Fuzzy Matching
Matches raw names against master data using:
- Levenshtein distance (spelling similarity)
- Phonetic matching (Soundex/Metaphone for Indian names)
- Alias table lookup (stored in customers.aliases, vendors.aliases, products.aliases)
- **Dialect dictionary lookup** (Tier 4 org_dictionary entries with entity_id links)
- Confidence scoring: >85% auto-match, <85% confirm with owner

## Layer 5: Confirmation Gate
Sends structured confirmation to owner. Owner confirms/edits/rejects.
Corrections feed into:
- Alias table (customers.aliases, products.aliases)
- `org_dictionary` (Tier 4) for dialect-specific corrections
- `global_dictionary` (Tier 5) for platform-wide learning
- Eval benchmark (`tests/ai/benchmark.json`)

**Learning module:** `src/lib/ai/dialect-learner.ts`

## Guided Prompts Bypass Layers 1-4
When owner uses buttons/lists/flows, data arrives pre-structured. Only Layer 5 applies.
Layer 0 still runs for analytics — tracks which terms users type to inform dictionary growth.
