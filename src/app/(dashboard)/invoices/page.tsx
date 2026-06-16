import { getTranslations } from 'next-intl/server'
import { InvoicesClient } from './_components/invoices-client'

export default async function InvoicesPage() {
  const t = await getTranslations('pages.invoices')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <InvoicesClient />
    </div>
  )
}
