-- S8.2 follow-up: ai_usage — per-call AI usage log.
--
-- Powers the platform-admin dashboard's real System-health metrics (token spend,
-- latency, error rate, calls-per-provider). One row per upstream LLM call
-- (DeepSeek or OpenRouter/Qwen), written by the low-level call wrappers
-- (src/lib/ai/deepseek.ts, src/lib/ai/openrouter.ts) via src/lib/ai/usage-logger.ts.
--
-- Service-role-only, like audit_log / whatsapp_messages: it is written from server
-- contexts (webhook pipeline, /api/ai, cron) with the service-role client and is
-- never read by tenant users. organization_id is nullable because some calls have no
-- org context (e.g. benchmark runs, owner-reply classification before org resolution).

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL CHECK (provider IN ('deepseek', 'openrouter')),
  model             TEXT NOT NULL,
  feature           TEXT,                          -- 'classify_extract' | 'eval' | 'owner_reply' | ...
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  latency_ms        INTEGER NOT NULL DEFAULT 0,
  success           BOOLEAN NOT NULL DEFAULT true,
  error_code        TEXT,                          -- short error label when success = false
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard reads are "today" windows filtered by provider/success — index created_at.
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_created ON public.ai_usage (provider, created_at DESC);

-- RLS ENABLED with NO policies → anon/authenticated have ZERO access (same pattern as
-- platform_admins). Only the service-role client (which bypasses RLS) reads/writes it.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
