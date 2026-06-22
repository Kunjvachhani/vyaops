-- Migration: Create corrections table
-- Spec: VYAOPS_PROMPT_PLAYBOOK.md — "Correction → new test case pipeline"
--
-- Captures every owner correction of an AI extraction (the WhatsApp "✏️ Edit"
-- loop). Each row is the seed for two downstream loops:
--   1. Benchmark growth  — scripts/corrections-to-benchmark.ts converts new
--      corrections into tests/ai/benchmark.json cases (1000 → 2000+ over time).
--   2. Dialect learning   — analyzeCorrection()/learnFromCorrection() in
--      src/lib/ai/dialect-learner.ts mine dialect mappings into org_dictionary.
--
-- NOTE ON FILENAME: the playbook names this 20260615000001_*, but that timestamp
-- is already taken by 20260615000001_create_invoices_storage_bucket.sql. Bumped
-- to 20260621000002 (after the latest 20260621000001 seed) to keep ordering and
-- uniqueness intact.

CREATE TABLE corrections (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID         NOT NULL REFERENCES organizations(id),

  -- Who corrected it: the owner (users row). Null if the correction is system-
  -- attributed (e.g. backfilled) rather than tied to a known user.
  user_id             UUID         REFERENCES users(id),

  -- Chat context: the customer whose message was mis-extracted. Canonical chat
  -- identity (normalized, no +). Optional — present for WhatsApp-sourced rows.
  customer_phone      TEXT,

  -- The raw customer message that the AI got wrong.
  original_message    TEXT         NOT NULL,

  -- What the AI extracted (DeepSeekClassifyResponse-shaped) vs. what the owner
  -- corrected it to. Stored as-is so the benchmark/dialect loops can replay both.
  wrong_extraction    JSONB        NOT NULL,
  correct_extraction  JSONB        NOT NULL,

  -- Denormalized corrected intent for fast benchmark conversion / filtering.
  intent              TEXT,

  -- Where the correction came from. 'whatsapp_edit' = the ✏️ Edit button loop.
  source              TEXT         NOT NULL DEFAULT 'whatsapp_edit',

  -- Link back to the pending_order this correction amended (if any).
  pending_order_id    UUID         REFERENCES pending_orders(id),

  -- ── Dialect-learning loop bookkeeping ──────────────────────────────────────
  -- Set by analyzeCorrection(). NULL = not yet analyzed.
  is_dialect_issue    BOOLEAN,
  -- Full CorrectionAnalysis result (mappings + reasoning) for audit/replay.
  dialect_analysis    JSONB,
  dialect_processed_at TIMESTAMPTZ,

  -- ── Benchmark-growth loop bookkeeping ──────────────────────────────────────
  -- TRUE once this correction has been emitted as a benchmark.json case.
  benchmarked         BOOLEAN      NOT NULL DEFAULT FALSE,
  -- The id assigned to the generated case (e.g. "corr-foundry-0007").
  benchmark_case_id   TEXT,
  benchmarked_at      TIMESTAMPTZ,

  -- Standard columns
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- Standard updated_at trigger
CREATE TRIGGER set_corrections_updated_at
  BEFORE UPDATE ON corrections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Org-scoped recency listing (dashboard "recent corrections").
CREATE INDEX idx_corrections_org_recent
  ON corrections (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Benchmark sweep: find corrections not yet turned into cases.
CREATE INDEX idx_corrections_unbenchmarked
  ON corrections (created_at)
  WHERE benchmarked = FALSE AND deleted_at IS NULL;

-- Dialect sweep: find corrections not yet analyzed for dialect mappings.
CREATE INDEX idx_corrections_undialected
  ON corrections (created_at)
  WHERE is_dialect_issue IS NULL AND deleted_at IS NULL;

-- Standard RLS: same tenant-isolation pattern as pending_orders. Service-role
-- (the flow + the benchmark/dialect scripts) writes; the dashboard reads its own
-- org's corrections for display.
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrections_org_isolation ON corrections
  USING (organization_id = (
    SELECT organization_id FROM users
    WHERE supabase_auth_id = auth.uid()
    LIMIT 1
  ));
