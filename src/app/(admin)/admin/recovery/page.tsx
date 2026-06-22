import { getTranslations } from 'next-intl/server'
import { adminClient } from '@/lib/supabase/admin'
import { SOFT_DELETABLE_TABLES } from '@/lib/utils/soft-delete'
import { RecoveryClient } from '../_components/recovery-client'

type OrgOption = { id: string; name: string }

export default async function RecoveryPage() {
  const t = await getTranslations('admin')

  const { data } = await adminClient
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const orgs = (data ?? []) as unknown as OrgOption[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('recovery.title')}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t('recovery.description')}</p>
      </div>
      <RecoveryClient orgs={orgs} tables={[...SOFT_DELETABLE_TABLES]} />
    </div>
  )
}
