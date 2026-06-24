import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { TIER_HIERARCHY } from '@/config/features'
import type { Tier } from '@/config/features'

/**
 * Fetch the org's current tier directly from DB (authoritative — always fresh
 * after a Razorpay webhook updates organizations.tier).
 */
export async function fetchOrgTier(orgId: string): Promise<Tier> {
  const { data } = await adminClient
    .from('organizations')
    .select('tier')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single()
  const tier = data?.tier
  return tier && tier in TIER_HIERARCHY ? (tier as Tier) : 'tier_1'
}

/**
 * requireTier — call at the top of every gated API route handler.
 *
 * Usage:
 *   const user = await getCurrentUser()
 *   if (!user) return NextResponse.json(...)
 *   const gate = await requireTier('tier_2', user.org_id)
 *   if (gate) return gate
 *
 * Returns null when access is allowed, or a 403 NextResponse when the org's
 * tier is below the required tier. Uses adminClient so the check is not
 * bypassable via user-manipulated JWT claims.
 */
export async function requireTier(
  requiredTier: Tier,
  orgId: string
): Promise<NextResponse | null> {
  const orgTier = await fetchOrgTier(orgId)
  if (TIER_HIERARCHY[orgTier] >= TIER_HIERARCHY[requiredTier]) return null
  return NextResponse.json(
    {
      error: 'Feature not available on your plan.',
      code: 'TIER_REQUIRED',
      requiredTier,
    },
    { status: 403 }
  )
}
