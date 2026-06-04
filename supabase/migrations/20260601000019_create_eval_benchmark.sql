-- Test cases for the AI eval loop. Global table — not per-organization.
-- Grows over time as production corrections are captured.
-- test_case_id format: TC-001, TC-002, etc.

CREATE TABLE eval_benchmark (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id       TEXT        NOT NULL UNIQUE,
  source             TEXT        NOT NULL
                                   CHECK (source IN ('manual', 'production_correction', 'production_failure')),
  raw_message        TEXT        NOT NULL,
  expected_intent    TEXT        NOT NULL,
  expected_entities  JSONB       NOT NULL,
  expected_matches   JSONB,
  actual_output      JSONB,
  correction_details TEXT,
  difficulty         TEXT        NOT NULL DEFAULT 'medium'
                                   CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags               TEXT[]      NOT NULL DEFAULT '{}',
  industry           TEXT        NOT NULL DEFAULT 'foundry',
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eval_benchmark_active ON eval_benchmark(industry, difficulty) WHERE is_active = TRUE;
CREATE INDEX idx_eval_benchmark_tags ON eval_benchmark USING GIN(tags);
