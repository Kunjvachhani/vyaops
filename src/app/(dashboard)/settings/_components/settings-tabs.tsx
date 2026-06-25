'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrgProfileTab } from './org-profile-tab'
import { TeamManagementTab } from './team-management-tab'
import { BillingTab } from './billing-tab'
import { PreferencesTab } from './preferences-tab'
import { DataTab } from './data-tab'

type OrgUser = {
  id: string
  full_name: string
  email: string | null
  role: string
  last_login_at: string | null
  is_active: boolean
}

type BillingEvent = {
  id: string
  event_type: string
  created_at: string
}

type Props = {
  org: {
    id: string
    name: string
    gstin: string | null
    address: string | null
    city: string
    state: string
    phone: string
    email: string | null
    industry_config: string
    logo_url: string | null
    tier: string
    billing_status: string
    tier_valid_until: string | null
    razorpay_subscription_id: string | null
    language_preference: string
    timezone: string
    whatsapp_proactive_enabled: boolean
    whatsapp_proactive_set_at: string | null
  }
  users: OrgUser[]
  billingEvents: BillingEvent[]
  currentUserId: string
  currentUserRole: string
}

export function SettingsTabs({
  org,
  users,
  billingEvents,
  currentUserId,
  currentUserRole,
}: Props) {
  const t = useTranslations('pages.settings.tabs')
  const isOwner = currentUserRole === 'owner'

  return (
    <Tabs defaultValue="orgProfile">
      <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-none border-b bg-transparent p-0">
        {(
          [
            ['orgProfile', t('orgProfile')],
            ['team', t('team')],
            ['billing', t('billing')],
            ['preferences', t('preferences')],
            ['data', t('data')],
          ] as const
        ).map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="pt-6">
        <TabsContent value="orgProfile" className="mt-0">
          <OrgProfileTab
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
            }}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="team" className="mt-0">
          <TeamManagementTab
            users={users}
            isOwner={isOwner}
            tier={org.tier}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-0">
          <BillingTab
            org={{
              tier: org.tier,
              billing_status: org.billing_status,
              tier_valid_until: org.tier_valid_until,
              razorpay_subscription_id: org.razorpay_subscription_id,
            }}
            billingEvents={billingEvents}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="preferences" className="mt-0">
          <PreferencesTab
            orgId={org.id}
            languagePreference={org.language_preference}
            timezone={org.timezone}
            proactiveEnabled={org.whatsapp_proactive_enabled}
            proactiveSetAt={org.whatsapp_proactive_set_at}
          />
        </TabsContent>

        <TabsContent value="data" className="mt-0">
          <DataTab orgName={org.name} isOwner={isOwner} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
