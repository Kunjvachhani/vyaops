import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { routeAndProcess } from '@/lib/ai/model-router'

const RequestSchema = z.object({
  message: z.string().min(1).max(4096),
  orgId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get('x-internal-api-key')
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_ERROR' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'PARSE_ERROR' },
      { status: 400 }
    )
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { message, orgId } = parsed.data

  try {
    const [customersRes, productsRes, vendorsRes] = await Promise.all([
      adminClient
        .from('customers')
        .select('id, name')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      adminClient
        .from('products')
        .select('id, name')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      adminClient
        .from('vendors')
        .select('id, name')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

    const result = await routeAndProcess(message, {
      orgId,
      customers: customersRes.data ?? [],
      products: productsRes.data ?? [],
      vendors: vendorsRes.data ?? [],
    })

    return NextResponse.json({
      decision: result.decision,
      extraction: {
        intent: result.intent,
        entities: result.entities,
      },
      scores: result.evalResult,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AI processing failed',
        code: 'AI_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
