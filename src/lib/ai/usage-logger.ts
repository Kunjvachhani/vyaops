import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

export type AiUsageProvider = 'deepseek' | 'openrouter'

export type AiUsageEntry = {
  provider: AiUsageProvider
  model: string
  feature?: string
  orgId?: string
  promptTokens?: number
  completionTokens?: number
  latencyMs: number
  success: boolean
  errorCode?: string
}

// Fire-and-forget AI-usage log. Writes one row per upstream LLM call to ai_usage
// (service-role, RLS-locked). NEVER throws and NEVER blocks the caller — a logging
// failure must not break an AI request. Skipped under test to keep benchmark runs
// out of production metrics.
export function logAiUsage(entry: AiUsageEntry): void {
  if (process.env.NODE_ENV === 'test') return

  const promptTokens = entry.promptTokens ?? 0
  const completionTokens = entry.completionTokens ?? 0

  void adminClient
    .from('ai_usage')
    .insert({
      provider: entry.provider,
      model: entry.model,
      feature: entry.feature ?? null,
      organization_id: entry.orgId ?? null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      latency_ms: Math.max(0, Math.round(entry.latencyMs)),
      success: entry.success,
      error_code: entry.errorCode ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // Best-effort: a console line (no PII) is enough; never escalate.
        console.error('[ai_usage] log failed:', error.message)
      }
    })
}
