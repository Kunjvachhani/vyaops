import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { InvoicesClient } from './_components/invoices-client'

export default async function InvoicesPage() {
  const t = await getTranslations('pages.invoices')
  const user = await getCurrentUser()
  const canDelete = user?.role === 'owner' || user?.role === 'manager'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <InvoicesClient canDelete={canDelete} />
    </div>
  )
}
