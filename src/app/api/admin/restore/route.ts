import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { getPlatformAdmin } from '@/lib/supabase/platform-admin'
import { captureWithContext } from '@/lib/utils/sentry'
import { restore, SoftDeleteError, SOFT_DELETABLE_TABLES } from '@/lib/utils/soft-delete'

const restoreSchema = z.object({
  table: z.enum(SOFT_DELETABLE_TABLES),
  id: z.string().uuid(),
  // Platform admins only: restore a record in another org. Ignored for tenant callers.
  org_id: z.string().uuid().optional(),
})

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// POST /api/admin/restore  { table, id, org_id? }
// Restores a soft-deleted record (clears deleted_at, audited).
//
// Two access modes:
//  - Tenant (owner/manager): restores a record in their OWN org. Backs the owner recovery
//    UI and the 30-second "Undo" toast. The 30s window is a client-side UX constraint —
//    restore itself has no time limit. Audit source: 'web'.
//  - Platform admin: may pass `org_id` to restore a record in ANY org. Audit source:
//    'platform_admin'. Must specify org_id (a platform admin may not belong to an org).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = restoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { table, id, org_id: requestedOrgId } = parsed.data

  const platformAdmin = await getPlatformAdmin()

  let targetOrgId: string
  let source: 'web' | 'platform_admin'
  if (platformAdmin) {
    if (!requestedOrgId) {
      return NextResponse.json(
        { error: 'Platform admins must specify an `org_id`', code: 'ORG_ID_REQUIRED' },
        { status: 400 }
      )
    }
    targetOrgId = requestedOrgId
    source = 'platform_admin'
  } else {
    if (user.role === 'worker' || user.role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
    }
    targetOrgId = user.org_id
    source = 'web'
  }

  try {
    await restore(table, id, targetOrgId, user.id, { ip: getIp(req), source })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      if (err.code === 'NOT_FOUND' || err.code === 'NOT_DELETED') {
        return NextResponse.json({ error: 'Record not found or not deleted', code: 'NOT_FOUND' }, { status: 404 })
      }
      captureWithContext(err, { action: 'POST /api/admin/restore', org_id: user.org_id, user_role: user.role })
      return NextResponse.json({ error: 'Failed to restore record', code: 'DB_ERROR' }, { status: 500 })
    }
    throw err
  }

  return NextResponse.json({ data: { id, table, restored: true } })
}
