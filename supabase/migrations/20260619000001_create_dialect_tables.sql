-- Migration: Create dialect dictionary tables (3 tables)
-- Spec: docs/ai/DIALECT_DICTIONARY.md
-- RLS: docs/security/RLS_POLICIES.md

-- ============================================================
-- TABLE 1: industry_dictionary (platform-wide, no org_id)
-- Jargon for 50+ Gujarat MSME segments. Seeded + grows from
-- cross-org corrections. RLS: read-only for authenticated.
-- ============================================================
CREATE TABLE IF NOT EXISTS industry_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  canonical TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'product', 'unit', 'process', 'defect', 'material', 'tool', 'measurement'
  )),
  industry_segment TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'gujlish',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'seed',
  promotion_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: one active normalized term per industry segment
CREATE UNIQUE INDEX idx_industry_dict_unique_term
  ON industry_dictionary (term_normalized, industry_segment)
  WHERE is_active = TRUE;

-- Lookup index: segment + active
CREATE INDEX idx_industry_dict_segment
  ON industry_dictionary (industry_segment)
  WHERE is_active = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER set_industry_dictionary_updated_at
  BEFORE UPDATE ON industry_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: enabled, read-only for authenticated users
ALTER TABLE industry_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON industry_dictionary
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- No INSERT/UPDATE/DELETE policies — writes via service-role only


-- ============================================================
-- TABLE 2: org_dictionary (per-org, standard tenant isolation)
-- Custom aliases set during onboarding + learned from corrections.
-- ============================================================
CREATE TABLE IF NOT EXISTS org_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  canonical TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'product', 'customer', 'vendor', 'unit', 'alias', 'custom'
  )),
  entity_id UUID,
  entity_type TEXT CHECK (entity_type IN ('product', 'customer', 'vendor') OR entity_type IS NULL),
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Partial unique: one active normalized term per org
CREATE UNIQUE INDEX idx_org_dict_unique_term
  ON org_dictionary (organization_id, term_normalized)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Lookup index: org + active + not deleted
CREATE INDEX idx_org_dict_org_lookup
  ON org_dictionary (organization_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER set_org_dictionary_updated_at
  BEFORE UPDATE ON org_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: standard tenant isolation
ALTER TABLE org_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select" ON org_dictionary
  FOR SELECT
  USING (
    organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid
    AND deleted_at IS NULL
  );

CREATE POLICY "insert" ON org_dictionary
  FOR INSERT
  WITH CHECK (
    organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid
  );

CREATE POLICY "update" ON org_dictionary
  FOR UPDATE
  USING (
    organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid
  );


-- ============================================================
-- TABLE 3: global_dictionary (platform-wide, no org_id)
-- Crowd-sourced word mappings. Grows with every new user.
-- RLS: read-only for authenticated.
-- ============================================================
CREATE TABLE IF NOT EXISTS global_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  canonical TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'number', 'verb', 'noun', 'unit', 'greeting', 'slang'
  )),
  language TEXT NOT NULL DEFAULT 'gujlish',
  taught_by_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: one active normalized term→canonical pair
CREATE UNIQUE INDEX idx_global_dict_unique_term
  ON global_dictionary (term_normalized, canonical)
  WHERE is_active = TRUE;

-- Lookup index
CREATE INDEX idx_global_dict_lookup
  ON global_dictionary (term_normalized)
  WHERE is_active = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER set_global_dictionary_updated_at
  BEFORE UPDATE ON global_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: enabled, read-only for authenticated users
ALTER TABLE global_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON global_dictionary
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- No INSERT/UPDATE/DELETE policies — writes via service-role only
