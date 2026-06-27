import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { TIER_HIERARCHY } from '@/config/features'
import type { Tier } from '@/config/features'
import type { Database } from '@/types/database'

type OrgRow = Database['public']['Tables']['organizations']['Row']

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !data) redirect('/login')

  // Safe cast: Supabase's query builder types require assistance here when
  // the result is narrowed through control-flow after redirect().
  const org = data as OrgRow

  // Owners who have not finished the onboarding wizard are routed to it. The
  // (onboarding) route group lives outside this layout, so there is no redirect
  // loop. Team members are never gated on onboarding.
  if (user.role === 'owner' && org.onboarding_status !== 'complete') {
    redirect('/onboarding')
  }

  const orgTier: Tier =
    org.tier in TIER_HIERARCHY ? (org.tier as Tier) : 'tier_1'

  return (
    <DashboardShell orgName={org.name} orgTier={orgTier} userEmail={user.email}>
      {children}
    </DashboardShell>
  )
}
