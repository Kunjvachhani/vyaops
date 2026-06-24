import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { FeatureGateCard } from '@/components/dashboard/feature-gate-card'
import { ComplianceClient } from './_components/compliance-client'

export default async function CompliancePage() {
  const t = await getTranslations('pages.compliance')

  const user = await getCurrentUser()
  let orgTier: Tier = 'tier_1'
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', user.org_id)
      .is('deleted_at', null)
      .single()
    const row = data as { tier: string } | null
    if (row?.tier) orgTier = row.tier as Tier
  }

  const canAccess = hasAccess(orgTier, 'compliance')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      {canAccess ? (
        <ComplianceClient />
      ) : (
        <FeatureGateCard featureName={t('title')} requiredTier="tier_3" />
      )}
    </div>
  )
}
