import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'
import { SettingsTabs } from './_components/settings-tabs'

type OrgRow = Database['public']['Tables']['organizations']['Row']
type UserRow = {
  id: string
  full_name: string
  email: string | null
  role: string
  last_login_at: string | null
  is_active: boolean
}
type BillingEventRow = {
  id: string
  event_type: string
  created_at: string
}

export default async function SettingsPage() {
  const t = await getTranslations('pages.settings')

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: orgRaw, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (orgError || !orgRaw) redirect('/login')

  const org = orgRaw as OrgRow

  const { data: usersRaw } = await adminClient
    .from('users')
    .select('id, full_name, email, role, last_login_at, is_active')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const { data: billingRaw } = await adminClient
    .from('billing_events')
    .select('id, event_type, created_at')
    .eq('organization_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const users = (usersRaw ?? []) as UserRow[]
  const billingEvents = (billingRaw ?? []) as BillingEventRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      <SettingsTabs
        org={{
          id: org.id,
          name: org.name,
          gstin: org.gstin,
          address: org.address,
          city: org.city,
          state: org.state,
          phone: org.phone,
          email: org.email,
          industry_config: org.industry_config,
          logo_url: org.logo_url,
          tier: org.tier,
          billing_status: org.billing_status,
          tier_valid_until: org.tier_valid_until,
          razorpay_subscription_id: org.razorpay_subscription_id,
          language_preference: org.language_preference,
          timezone: org.timezone,
          whatsapp_proactive_enabled: org.whatsapp_proactive_enabled,
          whatsapp_proactive_set_at: org.whatsapp_proactive_set_at,
        }}
        users={users}
        billingEvents={billingEvents}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  )
}
