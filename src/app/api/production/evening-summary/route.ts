import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type ProductionBatchRow = Database['public']['Tables']['production_batches']['Row']

type AsList<T> = T[] | null

// Today's date in IST as YYYY-MM-DD
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// Human label e.g. "23 Jun 2026" (IST)
function dateLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// GET /api/production/evening-summary
// Internal-only (n8n evening-production-summary workflow). For each eligible org
// (tier_2+), returns today's production batch totals — pieces produced, rejected,
// yield % — and a high_rejection flag when rejection rate exceeds 10%. Orgs without
// an owner phone or with no batches logged today are excluded. All date math is IST.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const today = istToday()
  const todayStart = `${today}T00:00:00+05:30`
  const tomorrowStart = `${today}T23:59:59+05:30`

  const [orgsRes, ownersRes, batchesRes] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id, language_preference, tier, whatsapp_proactive_enabled')
      .eq('whatsapp_proactive_enabled', true)
      .in('tier', ['tier_2', 'tier_3'])
      .is('deleted_at', null),
    adminClient
      .from('users')
      .select('organization_id, phone')
      .eq('role', 'owner')
      .eq('is_active', true)
      .is('deleted_at', null),
    adminClient
      .from('production_batches')
      .select('organization_id, quantity_produced, quantity_rejected')
      .gte('created_at', todayStart)
      .lte('created_at', tomorrowStart)
      .is('deleted_at', null),
  ])

  const firstError = orgsRes.error || ownersRes.error || batchesRes.error
  if (firstError) {
    captureWithContext(firstError, { action: 'GET /api/production/evening-summary' })
    return NextResponse.json(
      { error: 'Failed to build evening production summaries', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const orgs =
    (orgsRes.data as unknown as AsList<
      Pick<OrganizationRow, 'id' | 'language_preference' | 'tier'>
    >) ?? []
  const owners =
    (ownersRes.data as unknown as AsList<Pick<UserRow, 'organization_id' | 'phone'>>) ?? []
  const batches =
    (batchesRes.data as unknown as AsList<
      Pick<ProductionBatchRow, 'organization_id' | 'quantity_produced' | 'quantity_rejected'>
    >) ?? []

  const ownerPhone = new Map<string, string>()
  for (const o of owners) {
    const phone = o.phone?.trim()
    if (phone && !ownerPhone.has(o.organization_id)) ownerPhone.set(o.organization_id, phone)
  }

  const producedByOrg = new Map<string, number>()
  const rejectedByOrg = new Map<string, number>()
  for (const b of batches) {
    producedByOrg.set(
      b.organization_id,
      (producedByOrg.get(b.organization_id) ?? 0) + (b.quantity_produced ?? 0)
    )
    rejectedByOrg.set(
      b.organization_id,
      (rejectedByOrg.get(b.organization_id) ?? 0) + (b.quantity_rejected ?? 0)
    )
  }

  let skippedNoOwner = 0
  let skippedNoData = 0

  const summaries = orgs
    .map((org) => {
      const phone = ownerPhone.get(org.id)
      if (!phone) {
        skippedNoOwner += 1
        return null
      }

      const produced = producedByOrg.get(org.id) ?? 0
      const rejected = rejectedByOrg.get(org.id) ?? 0
      const total = produced + rejected

      if (total === 0) {
        skippedNoData += 1
        return null
      }

      const yieldPct = ((produced / total) * 100).toFixed(1)
      const rejectionRatePct = (rejected / total) * 100

      const locale: 'en' | 'gu' | 'hi' =
        org.language_preference === 'gu' || org.language_preference === 'hi'
          ? org.language_preference
          : 'en'

      return {
        organization_id: org.id,
        owner_phone: phone,
        language_preference: locale,
        has_data: true,
        date_label: dateLabel(today),
        total_produced: String(produced),
        total_rejected: String(rejected),
        yield_pct: `${yieldPct}%`,
        rejection_rate_pct: rejectionRatePct,
        high_rejection: rejectionRatePct > 10,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({
    summaries,
    meta: {
      as_of: today,
      total_orgs: orgs.length,
      eligible: summaries.length,
      skipped_no_owner: skippedNoOwner,
      skipped_no_data: skippedNoData,
    },
  })
}
