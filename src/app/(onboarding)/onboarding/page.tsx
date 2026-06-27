import { redirect } from 'next/navigation'
import { getCurrentUser, createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './_components/onboarding-wizard'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, address, gstin, industry_config, language_preference, logo_url')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !org) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('supabase_auth_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const ownerName =
    (profile as { full_name: string | null } | null)?.full_name ??
    (org as { name: string }).name

  return (
    <OnboardingWizard
      org={org as React.ComponentProps<typeof OnboardingWizard>['org']}
      ownerName={ownerName}
    />
  )
}
