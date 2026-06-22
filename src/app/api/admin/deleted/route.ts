import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { getPlatformAdmin } from '@/lib/supabase/platform-admin'
import { isSoftDeletableTable } from '@/lib/utils/soft-delete'

// GET /api/admin/deleted?table=orders[&limit=50][&org_id=<uuid>]
// Lists soft-deleted records (deleted_at IS NOT NULL) for review/recovery.
//
// Two access modes:
//  - Org owner: lists soft-deleted records in their OWN org. `org_id` param ignored.
//  - Platform admin: may pass `?org_id=<uuid>` to list ANY org's deleted records. A
//    platform admin MUST specify org_id (they may not belong to any org), so the request
//    is rejected without it.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const table = req.nextUrl.searchParams.get('table')
  if (!table || !isSoftDeletableTable(table)) {
    return NextResponse.json(
      { error: 'Missing or unsupported `table` parameter', code: 'INVALID_TABLE' },
      { status: 400 }
    )
  }

  const platformAdmin = await getPlatformAdmin()
  const requestedOrgId = req.nextUrl.searchParams.get('org_id')

  let targetOrgId: string
  if (platformAdmin) {
    if (!requestedOrgId) {
      return NextResponse.json(
        { error: 'Platform admins must specify an `org_id`', code: 'ORG_ID_REQUIRED' },
        { status: 400 }
      )
    }
    targetOrgId = requestedOrgId
  } else {
    // Tenant path: owner-only, strictly scoped to their own org.
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required', code: 'FORBIDDEN' }, { status: 403 })
    }
    targetOrgId = user.org_id
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

  const { data, error } = await adminClient
    .from(table)
    .select('*')
    .eq('organization_id', targetOrgId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[GET /api/admin/deleted]', error)
    return NextResponse.json({ error: 'Failed to load deleted records', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({
    data: { table, org_id: targetOrgId, records: data ?? [], count: data?.length ?? 0 },
  })
}
