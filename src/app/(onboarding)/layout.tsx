import { redirect } from 'next/navigation'
import { getCurrentUser, createClient } from '@/lib/supabase/server'

// Route-group layout for the onboarding wizard. Kept OUTSIDE the (dashboard)
// group so the wizard renders fullscreen (no dashboard shell) and so the
// dashboard layout can safely redirect here without a loop.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Onboarding is the owner's factory-setup flow. Team members never see it.
  if (user.role !== 'owner') redirect('/dashboard')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('onboarding_status')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !data) redirect('/login')

  if ((data as { onboarding_status: string }).onboarding_status === 'complete') {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/30 px-4 py-8 sm:items-center">
      {children}
    </main>
  )
}
