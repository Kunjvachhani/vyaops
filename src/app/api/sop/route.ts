import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { requireTier } from '@/lib/utils/feature-gate'
import { z } from 'zod'

const SOP_CATEGORIES = ['production', 'quality', 'safety', 'maintenance'] as const

const createSopSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(SOP_CATEGORIES).optional(),
  content: z.string().min(1),
})

type SopSummaryRow = {
  id: string
  title: string
  category: string | null
  version: number
  status: string
  updated_at: string
  created_at: string
  parent_id: string | null
}

// GET /api/sop — list all root SOPs with latest version info
export async function GET(req: NextRequest) {
  void req
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const gate = await requireTier('tier_3', user.org_id)
  if (gate) return gate

  const supabase = await createClient()

  // Fetch root documents (parent_id IS NULL = version 1 of each SOP)
  const { data: rawRoots, error: rootsError } = await supabase
    .from('sop_documents')
    .select('id, title, category, version, status, updated_at, created_at, parent_id')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .filter('parent_id', 'is', null)
    .order('created_at', { ascending: false })

  if (rootsError) {
    captureWithContext(rootsError, { action: 'GET /api/sop', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to fetch SOPs', code: 'DB_ERROR' }, { status: 500 })
  }

  const roots = (rawRoots ?? []) as SopSummaryRow[]

  if (roots.length === 0) {
    return NextResponse.json({ sops: [] })
  }

  // For each root, fetch latest child version info
  const rootIds = roots.map((r) => r.id)
  const { data: rawChildren } = await supabase
    .from('sop_documents')
    .select('id, parent_id, version, status, updated_at')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .in('parent_id', rootIds)
    .order('version', { ascending: false })

  type ChildRow = { id: string; parent_id: string; version: number; status: string; updated_at: string }
  const children = (rawChildren ?? []) as ChildRow[]

  // Build a map of rootId → latest child version
  const latestByRoot = new Map<string, { version: number; status: string; updated_at: string }>()
  for (const v of children) {
    const existing = latestByRoot.get(v.parent_id)
    if (!existing || v.version > existing.version) {
      latestByRoot.set(v.parent_id, { version: v.version, status: v.status, updated_at: v.updated_at })
    }
  }

  const sops = roots.map((root) => {
    const latest = latestByRoot.get(root.id)
    return {
      id: root.id,
      title: root.title,
      category: root.category,
      version: latest?.version ?? root.version,
      status: latest?.status ?? root.status,
      updated_at: latest?.updated_at ?? root.updated_at,
      created_at: root.created_at,
    }
  })

  return NextResponse.json({ sops })
}

// POST /api/sop — create a new SOP (version 1)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const gate = await requireTier('tier_3', user.org_id)
  if (gate) return gate

  if (!['owner', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = createSopSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const { title, category, content } = parsed.data

  // Use adminClient for insert to avoid Supabase self-referential FK type inference issues
  const { data: rawData, error } = await adminClient
    .from('sop_documents')
    .insert({
      organization_id: user.org_id,
      title,
      category: category ?? null,
      content,
      version: 1,
      status: 'draft',
      parent_id: null,
    })
    .select('id, title, category, version, status, created_at, updated_at, parent_id')
    .single()

  if (error) {
    captureWithContext(error, { action: 'POST /api/sop', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to create SOP', code: 'DB_ERROR' }, { status: 500 })
  }

  const row = rawData as SopSummaryRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'sop_document',
    entity_id: row.id,
    changes: [
      { field: 'title', old_value: null, new_value: row.title },
      { field: 'version', old_value: null, new_value: row.version },
      { field: 'status', old_value: null, new_value: row.status },
    ],
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '',
  })

  return NextResponse.json({ sop: row }, { status: 201 })
}
