import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { getPlatformAdmin } from '@/lib/supabase/platform-admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

const setTierSchema = z.object({
  org_id: z.string().uuid(),
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
})

type OrgTierRow = Pick<Database['public']['Tables']['organizations']['Row'], 'tier' | 'tier_source'>

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// POST /api/admin/set-tier  { org_id, tier }
//
// Platform-admin-only manual tier override for beta users / comps. This is the ONE
// authorized exception to "tier is set ONLY by the Razorpay webhook" (CLAUDE.md security
// rule 7) — it is gated by getPlatformAdmin() and audited with source 'platform_admin'.
// Tenants can never reach it (they are not platform admins). It does NOT touch billing_status
// or any Razorpay subscription; it only flips the access key for a comped org.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const platformAdmin = await getPlatformAdmin()
  if (!platformAdmin) {
    return NextResponse.json({ error: 'Forbidden', code: 'NOT_PLATFORM_ADMIN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = setTierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { org_id, tier } = parsed.data

  const { data: orgRaw, error: fetchErr } = await adminClient
    .from('organizations')
    .select('tier, tier_source')
    .eq('id', org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchErr) {
    captureWithContext(new Error(fetchErr.message), {
      action: 'POST /api/admin/set-tier',
      org_id,
      supabase_code: fetchErr.code,
    })
    return NextResponse.json({ error: 'Failed to load org', code: 'DB_ERROR' }, { status: 500 })
  }
  const org = orgRaw as OrgTierRow | null
  if (!org) {
    return NextResponse.json({ error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (org.tier === tier) {
    return NextResponse.json({ data: { org_id, tier, changed: false } })
  }

  const { error: updateErr } = await adminClient
    .from('organizations')
    // Mark as a comp so a later Razorpay webhook (which resets tier_source → 'billing')
    // transparently reclaims the org, and the dashboard can flag it as comped.
    .update({ tier, tier_source: 'comp' })
    .eq('id', org_id)
    .is('deleted_at', null)

  if (updateErr) {
    captureWithContext(new Error(updateErr.message), {
      action: 'POST /api/admin/set-tier',
      org_id,
      supabase_code: updateErr.code,
    })
    return NextResponse.json({ error: 'Failed to update tier', code: 'DB_ERROR' }, { status: 500 })
  }

  await logAudit({
    organization_id: org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'organization',
    entity_id: org_id,
    changes: [
      { field: 'tier', old_value: org.tier, new_value: tier },
      { field: 'tier_source', old_value: org.tier_source, new_value: 'comp' },
    ],
    metadata: { reason: 'platform_admin_manual_override' },
    ip_address: getIp(req),
    source: 'platform_admin',
  })

  return NextResponse.json({ data: { org_id, tier, changed: true } })
}
