import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { formatIST } from '@/lib/utils/date'
import { PreferencesForm } from './_components/preferences-form'

export default async function SettingsPage() {
  const t = await getTranslations('pages.settings')

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('whatsapp_proactive_enabled, whatsapp_proactive_set_at')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !data) redirect('/login')

  const org = data as {
    whatsapp_proactive_enabled: boolean
    whatsapp_proactive_set_at: string | null
  }

  const lastChangedLabel = org.whatsapp_proactive_set_at
    ? formatIST(new Date(org.whatsapp_proactive_set_at))
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      {/* Tab bar — Preferences is the only tab for now; more tabs (Profile,
          Billing, Team) land in later sprints. */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6" aria-label="Settings tabs">
          <span
            aria-current="page"
            className="border-b-2 border-primary px-1 pb-3 text-sm font-medium text-foreground"
          >
            {t('tabs.preferences')}
          </span>
        </nav>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('preferences.whatsappTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            initialEnabled={org.whatsapp_proactive_enabled}
            lastChangedLabel={lastChangedLabel}
          />
        </CardContent>
      </Card>
    </div>
  )
}
