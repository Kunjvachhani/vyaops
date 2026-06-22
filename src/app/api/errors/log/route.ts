import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'

// Error sink for the n8n Error Trigger branch. Writes a structured log line
// (the hook point for Sentry once @sentry/nextjs is wired in Sprint 4) and
// acknowledges so the error-handler branch can still notify the user.
const RequestSchema = z.object({
  source: z.string().optional(),
  error: z.string().optional(),
  workflow: z.string().optional(),
  node: z.string().optional(),
  executionId: z.union([z.string(), z.number()]).optional(),
  orgId: z.string().uuid().optional(),
  timestamp: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { source, error, workflow, node, executionId, orgId } = parsed.data

  captureWithContext(new Error(error ?? 'n8n workflow error'), {
    action: 'n8n/error-trigger',
    org_id: orgId,
    source: source ?? 'unknown',
    workflow: workflow ?? 'unknown',
    node: node ?? 'unknown',
    execution_id: String(executionId ?? ''),
  })

  return NextResponse.json({ logged: true })
}
