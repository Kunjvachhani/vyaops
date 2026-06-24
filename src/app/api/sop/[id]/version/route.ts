import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { requireTier } from '@/lib/utils/feature-gate'
import { z } from 'zod'

const createVersionSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(['production', 'quality', 'safety', 'maintenance']).nullable().optional(),
  content: z.string().min(1),
})

type SopVersionRow = {
  id: string
  organization_id: string
  title: string
  category: string | null
  content: string
  version: number
  status: string
  parent_id: string | null
  published_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

// POST /api/sop/[id]/version — create a new draft version of an SOP
// [id] must be the root document id
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const gate = await requireTier('tier_3', user.org_id)
  if (gate) return gate

  if (!['owner', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  const { id: rootId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = createVersionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = await createClient()

  // Verify root doc exists and belongs to this org
  const { data: rawRoot } = await supabase
    .from('sop_documents')
    .select('id, version')
    .eq('id', rootId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .filter('parent_id', 'is', null)
    .single()

  if (!rawRoot) {
    return NextResponse.json({ error: 'SOP not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const root = rawRoot as { id: string; version: number }

  // Find the current max version in the chain
  const { data: rawMaxRow } = await supabase
    .from('sop_documents')
    .select('version')
    .eq('organization_id', user.org_id)
    .eq('parent_id', rootId)
    .is('deleted_at', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxChild = rawMaxRow as { version: number } | null
  const nextVersion = (maxChild?.version ?? root.version) + 1

  // Use adminClient for insert to avoid self-referential FK type inference issues
  const { data: rawNewVersion, error } = await adminClient
    .from('sop_documents')
    .insert({
      organization_id: user.org_id,
      title: parsed.data.title,
      category: parsed.data.category ?? null,
      content: parsed.data.content,
      version: nextVersion,
      status: 'draft',
      parent_id: rootId,
    })
    .select('*')
    .single()

  if (error) {
    captureWithContext(error, { action: 'POST /api/sop/[id]/version', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to create version', code: 'DB_ERROR' }, { status: 500 })
  }

  const newRow = rawNewVersion as SopVersionRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'sop_document',
    entity_id: newRow.id,
    changes: [
      { field: 'version', old_value: null, new_value: newRow.version },
      { field: 'status', old_value: null, new_value: newRow.status },
      { field: 'parent_id', old_value: null, new_value: rootId },
    ],
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '',
  })

  return NextResponse.json({ version: newRow }, { status: 201 })
}
