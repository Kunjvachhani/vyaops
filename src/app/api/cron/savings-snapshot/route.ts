import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateRupeesSaved } from '@/lib/utils/rupees-saved'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type OrgIdRow = Pick<Database['public']['Tables']['organizations']['Row'], 'id'>

// Cron auth. Accepts either:
//  - Vercel Cron's `Authorization: Bearer ${CRON_SECRET}` header, or
//  - n8n's `x-internal-api-key: ${INTERNAL_API_KEY}` (lets the existing n8n scheduler trigger it too).
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return true

  const internalKey = process.env.INTERNAL_API_KEY
  if (internalKey && req.headers.get('x-internal-api-key') === internalKey) return true

  return false
}

// GET /api/cron/savings-snapshot
// Recomputes each org's all-time "₹ saved" via the full engine (service-role client →
// cross-org) and caches it on organizations.total_saved_paise. The platform-admin
// customer-overview then reads that single column instead of estimating per org.
//
// Per-org failures are isolated: one org erroring never aborts the rest.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { data: orgsRaw, error } = await adminClient
    .from('organizations')
    .select('id')
    .is('deleted_at', null)

  if (error) {
    captureWithContext(new Error(error.message), {
      action: 'cron/savings-snapshot/list',
      supabase_code: error.code,
    })
    return NextResponse.json({ error: 'Failed to list orgs', code: 'DB_ERROR' }, { status: 500 })
  }

  const orgs = (orgsRaw ?? []) as OrgIdRow[]
  const calculatedAt = new Date().toISOString()
  let updated = 0
  let failed = 0

  for (const org of orgs) {
    try {
      const breakdown = await calculateRupeesSaved(org.id, 'all_time', adminClient)
      const { error: updateErr } = await adminClient
        .from('organizations')
        .update({
          total_saved_paise: breakdown.totalSavedPaise,
          savings_calculated_at: calculatedAt,
        })
        .eq('id', org.id)
      if (updateErr) throw new Error(updateErr.message)
      updated += 1
    } catch (err) {
      failed += 1
      captureWithContext(err instanceof Error ? err : new Error(String(err)), {
        action: 'cron/savings-snapshot/org',
        org_id: org.id,
      })
    }
  }

  return NextResponse.json({ data: { orgs: orgs.length, updated, failed, calculatedAt } })
}
