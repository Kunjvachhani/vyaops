# Dialect Dictionary — 5-Tier Lookup System

## Purpose
Indian manufacturing MSMEs communicate in Gujlish (Roman-script Gujarati + English), Hinglish, pure Gujarati, pure Hindi, and English — often mixed mid-sentence. The dialect dictionary pre-processes raw WhatsApp messages before they hit the AI pipeline, resolving known terms instantly (zero API cost) and leaving only truly unknown tokens for AI inference.

## Architecture: 5-Tier Lookup Hierarchy

```
Raw WhatsApp message
       │
       ▼
┌─ Tier 4: Org Dictionary ──────────┐  DB: org_dictionary (per-org, RLS)
│  Custom aliases set during         │  "VB" → Valve Body (at this org)
│  onboarding. Private to each org.  │  "mota wala" → Gear Box Housing
└──────────┬─────────────────────────┘
           │ unresolved tokens
           ▼
┌─ Tier 3: Industry Dictionary ─────┐  DB: industry_dictionary
│  Jargon for 50 Gujarat MSME       │  "saancho" → mould (foundry)
│  segments. Seeded + grows from     │  "thaan" → bolt of fabric (textiles)
│  cross-org corrections.           │
└──────────┬─────────────────────────┘
           │ unresolved tokens
           ▼
┌─ Tier 5: Global Learning Pool ────┐  DB: global_dictionary
│  Crowd-sourced word mappings.      │  Terms that AI resolved and owners
│  Grows with every new user.        │  confirmed. No org data leaks.
│  Append-only, no duplicates.       │  Platform's collective intelligence.
└──────────┬─────────────────────────┘
           │ unresolved tokens
           ▼
┌─ Tier 2: Business Vocabulary ─────┐  Static: src/config/dialect/business.json
│  Cross-industry transaction terms. │  "udhaar" → credit
│  Gujarati business language.       │  "challan" → delivery note
│  Updated per release cycle.        │  "bhav" → price/rate
└──────────┬─────────────────────────┘
           │ unresolved tokens
           ▼
┌─ Tier 1: Gujarati Language Base ──┐  Static: src/config/dialect/universal.json
│  3000+ entries: numbers, verbs,    │  "pachso" → 500
│  postpositions, conjunctions,      │  "joiye" → need/want
│  common misspellings, voice-to-    │  "moklo" → send
│  text variants.                    │  "ne" → to (postposition)
└──────────┬─────────────────────────┘
           │ still unresolved tokens
           ▼
┌─ AI Fallback (DeepSeek V4 Pro) ───┐  API call with context:
│  Only tokens that survived all     │  "unrecognized tokens: [x, y, z]
│  5 tiers reach the AI. Cheaper,    │   — infer from sentence context"
│  faster, more accurate.            │
└────────────────────────────────────┘
```

**Lookup order: Tier 4 → Tier 3 → Tier 5 → Tier 2 → Tier 1 → AI**

Most specific wins. Org alias trumps industry jargon trumps crowd-learned mapping.

---

## Tier 1: Gujarati Language Base (Static JSON)

**File:** `src/config/dialect/universal.json`
**Maintained by:** VyaOps dev team, shipped with each release.
**Size:** ~3,000 entries (curated for WhatsApp business vocabulary, not literary Gujarati).

### Structure
```json
{
  "numbers": {
    "ek": 1, "be": 2, "tran": 3, "char": 4, "paanch": 5,
    "chha": 6, "saat": 7, "aath": 8, "nav": 9, "das": 10,
    "vis": 20, "tris": 30, "chalis": 40, "pachas": 50,
    "saath": 60, "sitter": 70, "enshi": 80, "nevun": 90,
    "sau": 100, "do so": 200, "tin so": 300, "char so": 400,
    "pachso": 500, "chha so": 600, "sat so": 700, "aath so": 800,
    "nav so": 900, "ek hazaar": 1000, "be hazaar": 2000,
    "das hazaar": 10000, "lakh": 100000, "ek lakh": 100000
  },
  "verbs": {
    "joiye": "need/want", "apo": "give", "aapjo": "please give",
    "moklo": "send", "mokljo": "please send", "nakho": "put/place",
    "nakhjo": "please put", "batavo": "tell", "karo": "do",
    "banavo": "make", "kadhvo": "take out", "rakhvo": "keep",
    "mangaavo": "order/procure", "ladvo": "load", "utarvo": "unload",
    "tolvo": "weigh", "ghatadvu": "reduce", "vadharvu": "increase"
  },
  "postpositions": {
    "ne": "to/for", "no": "of (masc)", "ni": "of (fem)",
    "nu": "of (neut)", "na": "of (plural)", "ma": "in",
    "thi": "from/by", "par": "on/upon", "mate": "for/purpose",
    "sathe": "with", "jodhey": "with/alongside", "paase": "near",
    "upar": "above", "niche": "below", "pachhi": "after",
    "pehla": "before"
  },
  "particles": {
    "ne": "and/emphasis", "to": "then/so", "pan": "also/even",
    "ane": "and", "ke": "that/or", "j": "only/just",
    "bhai": "brother (honorific)", "saheb": "sir (honorific)"
  },
  "time": {
    "aaje": "today", "kal": "yesterday/tomorrow", "gaie kal": "day before yesterday",
    "aavti kal": "tomorrow", "parmo": "day after tomorrow",
    "aathvadiye": "weekly", "mahine": "monthly", "varsh": "year",
    "savare": "morning", "bapore": "afternoon", "saanje": "evening",
    "raate": "night", "haji": "still/yet", "have": "now",
    "tarat": "immediately", "jaldi": "quickly/soon", "dhire": "slowly"
  },
  "question_words": {
    "su": "what", "kem": "why/how", "kyare": "when",
    "kya": "where", "ketla": "how many", "ketlu": "how much",
    "kayo": "which (masc)", "kai": "which (fem)", "kon": "who"
  },
  "common_phrases": {
    "kem cho": "how are you", "saru che": "fine/good",
    "thik che": "ok/fine", "barabar": "correct/ok",
    "chalse": "it will work", "nai chalse": "won't work",
    "thai jashe": "it will happen", "nai thay": "won't happen",
    "khabar nathi": "don't know", "samjay nathi": "don't understand"
  }
}
```

### What Tier 1 does NOT contain
- Product names (those are in org aliases / industry dictionary)
- Customer names (those are in customer.aliases)
- Industry-specific jargon (that's Tier 3)
- Business transaction terms (that's Tier 2)

---

## Tier 2: Business Vocabulary (Static JSON)

**File:** `src/config/dialect/business.json`
**Maintained by:** VyaOps dev team, updated per release.
**Size:** ~200 entries.
**AI fallback:** If a word isn't found here, it's passed to AI with context flag: "likely business term, infer meaning." If AI resolves and owner confirms, term is flagged for manual addition.

### Structure
```json
{
  "transaction": {
    "order": {"gu": "ardar", "hi": "order", "meaning": "order"},
    "invoice": {"gu": "bil", "hi": "bill", "meaning": "invoice"},
    "challan": {"gu": "challan", "hi": "challan", "meaning": "delivery note"},
    "payment": {"gu": "chukvani", "hi": "payment", "meaning": "payment"},
    "advance": {"gu": "agantar", "hi": "advance", "meaning": "advance payment"},
    "credit": {"gu": "udhaar", "hi": "udhar", "meaning": "credit/on account"},
    "cash": {"gu": "rokad", "hi": "naqad", "meaning": "cash payment"},
    "balance": {"gu": "baaki", "hi": "baki", "meaning": "outstanding balance"},
    "deal": {"gu": "sauda", "hi": "sauda", "meaning": "deal/transaction"},
    "account": {"gu": "hisab", "hi": "hisaab", "meaning": "account/ledger"},
    "profit": {"gu": "nafa", "hi": "munafa", "meaning": "profit"},
    "loss": {"gu": "khasara", "hi": "nuksan", "meaning": "loss"}
  },
  "logistics": {
    "truck": {"gu": "gadi", "hi": "gaadi", "meaning": "truck/vehicle"},
    "freight": {"gu": "bhada", "hi": "bhada", "meaning": "freight/transport cost"},
    "loading": {"gu": "ladvu", "hi": "loading", "meaning": "loading goods"},
    "dispatch": {"gu": "dispatch", "hi": "dispatch", "meaning": "ship/send"},
    "packing": {"gu": "pekink", "hi": "packing", "meaning": "packaging"},
    "delivery": {"gu": "delivery", "hi": "delivery", "meaning": "delivery"},
    "return": {"gu": "paachu", "hi": "wapas", "meaning": "return goods"},
    "carton": {"gu": "peti", "hi": "peti", "meaning": "carton/box"},
    "sack": {"gu": "bori", "hi": "bori", "meaning": "sack/bag"},
    "weight": {"gu": "vazan", "hi": "vazan", "meaning": "weight"}
  },
  "quality": {
    "quality": {"gu": "jakaat", "hi": "quality", "meaning": "quality"},
    "sample": {"gu": "namuno", "hi": "sample", "meaning": "sample"},
    "defect": {"gu": "khaami", "hi": "nuqs", "meaning": "defect"},
    "rejection": {"gu": "nakaar", "hi": "rejection", "meaning": "rejected goods"},
    "good": {"gu": "saru", "hi": "achha", "meaning": "good quality"},
    "bad": {"gu": "kharab", "hi": "kharab", "meaning": "bad quality"}
  },
  "people": {
    "customer": {"gu": "party", "hi": "party", "meaning": "customer"},
    "vendor": {"gu": "supplier", "hi": "supplier", "meaning": "vendor/supplier"},
    "worker": {"gu": "kaamdar", "hi": "kaamgar", "meaning": "worker"},
    "owner": {"gu": "malik", "hi": "malik", "meaning": "owner"},
    "manager": {"gu": "manager", "hi": "manager", "meaning": "manager"}
  },
  "units": {
    "piece": {"gu": "nag", "hi": "piece", "meaning": "piece/unit"},
    "dozen": {"gu": "darjan", "hi": "darjan", "meaning": "dozen (12)"},
    "gross": {"gu": "gros", "hi": "gros", "meaning": "gross (144)"},
    "quintal": {"gu": "man", "hi": "quintal", "meaning": "quintal (100kg)"},
    "ton": {"gu": "tan", "hi": "ton", "meaning": "metric ton"},
    "kg": {"gu": "kilo", "hi": "kilo", "meaning": "kilogram"},
    "meter": {"gu": "mitar", "hi": "meter", "meaning": "meter"},
    "foot": {"gu": "fut", "hi": "foot", "meaning": "foot"},
    "inch": {"gu": "inchi", "hi": "inch", "meaning": "inch"}
  },
  "status": {
    "pending": {"gu": "baki", "hi": "pending", "meaning": "pending"},
    "done": {"gu": "thai gayu", "hi": "ho gaya", "meaning": "completed"},
    "urgent": {"gu": "tatkal", "hi": "urgent", "meaning": "urgent"},
    "stock": {"gu": "maal che", "hi": "stock", "meaning": "in stock"},
    "out_of_stock": {"gu": "maal nathi", "hi": "stock nahi", "meaning": "out of stock"}
  },
  "tax": {
    "gst": {"gu": "gst", "hi": "gst", "meaning": "GST tax"},
    "tax": {"gu": "tax", "hi": "tax", "meaning": "tax"},
    "without_gst": {"gu": "gst vagar", "hi": "gst ke bina", "meaning": "without GST"},
    "with_gst": {"gu": "gst sathe", "hi": "gst ke saath", "meaning": "with GST"}
  }
}
```

---

## Tier 3: Industry Dictionary (Database Table)

**Table:** `industry_dictionary`
**Maintained by:** VyaOps team (seeded) + auto-promoted from org corrections when threshold met.
**Size:** ~50 MSME segments x ~50-100 terms each = ~2,500-5,000 rows at launch.

### Table Schema
```sql
CREATE TABLE industry_dictionary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term            TEXT NOT NULL,              -- the Gujlish/Hindi/phonetic term
    term_normalized TEXT NOT NULL,              -- lowercase, stripped, for dedup
    canonical       TEXT NOT NULL,              -- resolved English meaning
    category        TEXT NOT NULL,              -- product | process | equipment | material | unit | defect
    industry_segment TEXT NOT NULL,             -- foundry | textiles | ceramics | chemicals | ...
    language        TEXT NOT NULL DEFAULT 'gujlish', -- gu | hi | gujlish | hinglish | en
    confidence      NUMERIC(3,2) DEFAULT 1.00, -- 1.00 = manually curated, <1 = auto-promoted
    source          TEXT NOT NULL DEFAULT 'seed', -- seed | promotion | manual
    promotion_count INTEGER DEFAULT 0,          -- how many orgs taught this independently
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_ind_dict_term_industry
    ON industry_dictionary(term_normalized, industry_segment) WHERE is_active = TRUE;
CREATE INDEX idx_ind_dict_segment ON industry_dictionary(industry_segment);
CREATE INDEX idx_ind_dict_term ON industry_dictionary USING gin(to_tsvector('simple', term));
```

**No organization_id.** This is a shared, platform-wide resource. No RLS — read-only for all authenticated users, write-only via service-role (promotion logic + admin).

### Promotion Logic
When 3+ orgs in the same `industry_segment` independently correct the same term→canonical mapping:
1. Check if `industry_dictionary` already has `(term_normalized, industry_segment)`
2. If not: INSERT with `source='promotion'`, `confidence=0.90`, `promotion_count=N`
3. If yes: UPDATE `promotion_count`, optionally increase `confidence`

### Seeded Industries (Top 50 Gujarat MSME Segments)
See `supabase/seed-industry-dictionary.sql` for full seed data.

Categories:
1. Foundry / Casting (Rajkot, Ahmedabad)
2. Textiles / Weaving (Surat, Ahmedabad)
3. Ceramics / Tiles (Morbi)
4. Chemicals (Ankleshwar, Vadodara)
5. Pharmaceuticals (Ahmedabad)
6. Auto Parts (Rajkot)
7. Plastics / Polymers (Ahmedabad, Rajkot)
8. Diamond / Jewelry (Surat)
9. Food Processing (Unjha, Rajkot)
10. Agriculture / Agri-Processing (Junagadh, Unjha)
11. Engineering / Machine Tools (Rajkot)
12. Brass Parts (Jamnagar)
13. Steel / Rolling Mills (Ahmedabad)
14. Packaging (Ahmedabad)
15. Electrical Equipment (Vadodara)
16. Paper / Printing (Ahmedabad, Vapi)
17. Rubber Products (Ahmedabad)
18. Glass / Glassware (Vadodara)
19. Wood / Furniture (Ahmedabad)
20. Leather / Footwear (Ahmedabad)
21-50. (Additional segments — see seed file)

---

## Tier 4: Org Dictionary (Database Table)

**Table:** `org_dictionary`
**Maintained by:** Populated during onboarding (AI-assisted) + owner corrections during use.
**Size:** Starts empty. Typical org: 50-200 entries after onboarding.

### Table Schema
```sql
CREATE TABLE org_dictionary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    term            TEXT NOT NULL,              -- the custom term/alias
    term_normalized TEXT NOT NULL,              -- lowercase, stripped
    canonical       TEXT NOT NULL,              -- what it resolves to
    category        TEXT NOT NULL,              -- product | customer | process | custom
    entity_id       UUID,                      -- FK to products(id) or customers(id) if applicable
    entity_type     TEXT,                       -- product | customer | vendor
    source          TEXT NOT NULL DEFAULT 'onboarding', -- onboarding | correction | manual
    confidence      NUMERIC(3,2) DEFAULT 1.00,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX idx_org_dict_term_org
    ON org_dictionary(organization_id, term_normalized) WHERE deleted_at IS NULL AND is_active = TRUE;
CREATE INDEX idx_org_dict_org ON org_dictionary(organization_id) WHERE deleted_at IS NULL;
```

**RLS enabled.** Standard tenant isolation — each org reads/writes only their own dictionary.

### Onboarding Flow
During onboarding, the system:
1. Imports the org's product catalog (names, codes, descriptions)
2. Imports customer list (names, company names)
3. AI generates likely aliases: phonetic Gujlish variants, abbreviations, common misspellings
4. Owner reviews the generated dictionary on a "Dictionary Review" screen
5. Owner corrects/adds/removes entries
6. Confirmed entries saved to `org_dictionary`

Example AI-generated entries for a foundry importing "Gear Box Housing":
```
gerboks → Gear Box Housing (product)
girboks → Gear Box Housing (product)
gbh → Gear Box Housing (product)
gerboks housing → Gear Box Housing (product)
gear box → Gear Box Housing (product)
```

### Correction Loop
When AI misclassifies during daily use:
1. Owner corrects the draft (e.g., changes product from "Valve Body" to "Pump Housing")
2. System checks: was this a fuzzy-match failure? (original token was "pamp bodi")
3. If yes: writes `{term: "pamp bodi", canonical: "Pump Housing", source: "correction"}` to `org_dictionary`
4. Next time "pamp bodi" appears for this org → instant Tier 4 hit, no AI needed

---

## Tier 5: Global Learning Pool (Database Table)

**Table:** `global_dictionary`
**Maintained by:** Auto-populated from confirmed AI resolutions + Tier 4 corrections.
**Size:** Starts empty. Grows with platform usage. Expected: 500-2,000 entries in year 1.

### Table Schema
```sql
CREATE TABLE global_dictionary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term            TEXT NOT NULL,
    term_normalized TEXT NOT NULL,
    canonical       TEXT NOT NULL,
    category        TEXT NOT NULL,              -- product | process | unit | general
    language        TEXT NOT NULL DEFAULT 'gujlish',
    taught_by_count INTEGER NOT NULL DEFAULT 1, -- how many distinct orgs confirmed this
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confidence      NUMERIC(3,2) DEFAULT 0.80,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_global_dict_term
    ON global_dictionary(term_normalized, canonical) WHERE is_active = TRUE;
CREATE INDEX idx_global_dict_confidence ON global_dictionary(confidence DESC);
```

**No organization_id.** Platform-wide. No RLS — read-only for authenticated users. Writes via service-role only.

**No org data leaks.** Only stores `term → canonical` mapping. No org name, no customer name, no phone number. "pamp bodi → Pump Housing" reveals nothing about who taught it.

### Learning Rules
1. **First occurrence:** AI resolves unknown token, owner confirms → INSERT into `global_dictionary` with `taught_by_count=1`, `confidence=0.80`
2. **Subsequent confirmations:** Different org confirms same mapping → UPDATE `taught_by_count`, `last_confirmed_at`, increase `confidence` (max 0.98)
3. **Contradictions:** If a different org maps the same term to a different canonical, both mappings coexist. Lookup returns all matches ranked by `taught_by_count * confidence`. The caller (dialect-lookup module) picks the best match considering industry context.
4. **No deletions:** Append-only philosophy. `is_active=FALSE` for deprecated terms.

### Graduation to Tier 3
When a `global_dictionary` entry has `taught_by_count >= 3` AND all teaching orgs share the same `industry_segment`:
- Auto-promote to `industry_dictionary` with `source='promotion'`
- Keep the `global_dictionary` entry active (it still serves cross-industry lookups)

---

## Normalization Function

All tiers use the same normalization for deduplication:

```typescript
function normalizeDialectTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/[।,;:!?'"()[\]{}]/g, '') // strip punctuation (keep Gujarati danda)
    .replace(/bhai$/i, '')            // strip trailing honorific
    .replace(/saheb$/i, '')
    .replace(/ben$/i, '')
    .normalize('NFC');               // Unicode normalization
}
```

---

## Integration with AI Pipeline

### Before (current)
```
Raw message → DeepSeek (intent + entity extraction) → Fuzzy match → Eval gate
```

### After (with dialect dictionary)
```
Raw message → Dialect Lookup (Tier 4→3→5→2→1) → Normalized message + resolved tokens
    → DeepSeek (with pre-resolved context) → Fuzzy match (fewer unknowns) → Eval gate
```

The dialect lookup module (`src/lib/ai/dialect-lookup.ts`) returns:
```typescript
type DialectLookupResult = {
  original: string;
  normalized: string;
  resolved_tokens: Array<{
    original: string;
    canonical: string;
    tier: 1 | 2 | 3 | 4 | 5;
    category: string;
    confidence: number;
  }>;
  unresolved_tokens: string[];
  pre_structured: {
    quantity?: number;
    customer_hint?: string;
    product_hint?: string;
    intent_hint?: string;
    verb?: string;
  };
};
```

This pre-structured data is passed alongside the raw message to DeepSeek, dramatically reducing ambiguity and token cost.

---

## Metrics to Track

| Metric | How | Target |
|--------|-----|--------|
| Tier hit rate | % of tokens resolved before AI | > 60% by month 3 |
| AI fallback rate | % of messages needing AI for any token | < 40% by month 6 |
| Correction rate | Owner corrections per 100 messages | < 5% by month 6 |
| Tier 5 growth | New entries per week | 10-50/week in growth phase |
| Tier 3 promotions | Entries promoted from global→industry per month | 5-20/month |
| Token cost savings | AI tokens saved by pre-resolution | Track via PostHog |

---

## Security Considerations

1. **Tier 4 (org_dictionary):** RLS enforced. Org A cannot read Org B's custom terms.
2. **Tier 3 & 5:** No org-identifying data. Only word↔meaning mappings.
3. **Tier 5 writes:** Service-role only. No user can directly write to global pool.
4. **Audit:** All dictionary writes logged to `audit_log` via standard `audit.ts` helper.
5. **Rate limiting:** Max 100 `org_dictionary` writes per org per day (prevents flooding).
6. **Normalization:** All terms normalized before storage to prevent injection via Unicode tricks.
