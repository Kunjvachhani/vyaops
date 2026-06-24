import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit, diffChanges } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { z } from 'zod'

const SOP_CATEGORIES = ['production', 'quality', 'safety', 'maintenance'] as const

const updateSopSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.enum(SOP_CATEGORIES).nullable().optional(),
  content: z.string().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

type SopRow = {
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
  deleted_at: string | null
}

async function checkTierAccess(orgId: string): Promise<{ allowed: boolean; tier: Tier }> {
  const { data } = await adminClient
    .from('organizations')
    .select('tier')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single()
  const tier = ((data as { tier: string } | null)?.tier ?? 'tier_1') as Tier
  return { allowed: hasAccess(tier, 'sop_builder'), tier }
}

// GET /api/sop/[id] — get a root SOP with all its versions
// [id] must be the root document id (parent_id IS NULL)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { allowed } = await checkTierAccess(user.org_id)
  if (!allowed) {
    return NextResponse.json({ error: 'Feature not available on your plan', code: 'TIER_GATE' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Fetch root document (parent_id IS NULL)
  const { data: rawRoot, error: rootError } = await supabase
    .from('sop_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .filter('parent_id', 'is', null)
    .single()

  if (rootError || !rawRoot) {
    return NextResponse.json({ error: 'SOP not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const root = rawRoot as SopRow

  // Fetch all versions (children)
  const { data: rawVersions } = await supabase
    .from('sop_documents')
    .select('*')
    .eq('organization_id', user.org_id)
    .eq('parent_id', id)
    .is('deleted_at', null)
    .order('version', { ascending: true })

  const versions = (rawVersions ?? []) as SopRow[]

  return NextResponse.json({ root, versions: [root, ...versions] })
}

// PATCH /api/sop/[id] — update a specific version row (by its own id)
// Accepts title/category/content updates (draft only) or status transitions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { allowed } = await checkTierAccess(user.org_id)
  if (!allowed) {
    return NextResponse.json({ error: 'Feature not available on your plan', code: 'TIER_GATE' }, { status: 403 })
  }

  if (!['owner', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = updateSopSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = await createClient()

  // Fetch existing row (must belong to this org)
  const { data: rawExisting, error: fetchError } = await supabase
    .from('sop_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !rawExisting) {
    return NextResponse.json({ error: 'SOP not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const existingRow = rawExisting as SopRow

  // Content edits only allowed on drafts
  const { title, category, content, status } = parsed.data
  if ((title || category !== undefined || content) && existingRow.status !== 'draft') {
    return NextResponse.json({ error: 'Cannot edit a published or archived SOP. Create a new version instead.', code: 'IMMUTABLE' }, { status: 409 })
  }

  type UpdatePayload = {
    title?: string
    category?: string | null
    content?: string
    status?: string
    published_by?: string | null
    published_at?: string | null
  }

  const updates: UpdatePayload = {}
  if (title) updates.title = title
  if (category !== undefined) updates.category = category
  if (content) updates.content = content
  if (status) {
    updates.status = status
    if (status === 'published') {
      // Look up internal user_id for published_by
      const { data: rawUserRow } = await supabase
        .from('users')
        .select('id')
        .eq('supabase_auth_id', user.id)
        .eq('organization_id', user.org_id)
        .is('deleted_at', null)
        .single()
      updates.published_by = (rawUserRow as { id: string } | null)?.id ?? null
      updates.published_at = new Date().toISOString()
    }
  }

  // Use adminClient for update to avoid self-referential FK type inference issues
  const { data: rawUpdated, error: updateError } = await adminClient
    .from('sop_documents')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select('*')
    .single()

  if (updateError) {
    captureWithContext(updateError, { action: 'PATCH /api/sop/[id]', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to update SOP', code: 'DB_ERROR' }, { status: 500 })
  }

  const updatedRow = rawUpdated as SopRow
  const changes = diffChanges(
    existingRow as unknown as Record<string, unknown>,
    updatedRow as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: status === 'published' ? 'status_change' : 'update',
    entity_type: 'sop_document',
    entity_id: id,
    changes,
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '',
  })

  return NextResponse.json({ sop: updatedRow })
}

// DELETE /api/sop/[id] — soft delete a root SOP and all its versions
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  if (!['owner', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Verify root doc belongs to this org
  const { data: rawExisting } = await supabase
    .from('sop_documents')
    .select('id, organization_id, title')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .filter('parent_id', 'is', null)
    .single()

  if (!rawExisting) {
    return NextResponse.json({ error: 'SOP not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Soft-delete all version rows (children) then root
  await adminClient
    .from('sop_documents')
    .update({ deleted_at: now })
    .eq('parent_id', id)
    .eq('organization_id', user.org_id)

  await adminClient
    .from('sop_documents')
    .update({ deleted_at: now })
    .eq('id', id)
    .eq('organization_id', user.org_id)

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'soft_delete',
    entity_type: 'sop_document',
    entity_id: id,
    changes: [{ field: 'deleted_at', old_value: null, new_value: now }],
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '',
  })

  return NextResponse.json({ success: true })
}
