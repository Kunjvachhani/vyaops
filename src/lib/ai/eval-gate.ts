import type { AIResponse, EvalResult } from '@/types/ai'

export type EvalGateOutcome = 'pass' | 'fail' | 'guided_prompt'

export interface EvalGateResult {
  outcome: EvalGateOutcome
  score: number
  eval: EvalResult
}

/**
 * Stub — full implementation follows docs/ai/EVAL_LOOP.md.
 * All AI outputs must pass this gate before being written to the DB.
 */
export async function runEvalGate(
  _input: string,
  _response: AIResponse
): Promise<EvalGateResult> {
  throw new Error('eval-gate not yet implemented — see docs/ai/EVAL_LOOP.md')
}
