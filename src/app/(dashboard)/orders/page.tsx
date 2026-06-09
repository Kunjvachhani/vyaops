import { getTranslations } from 'next-intl/server'
import { OrdersClient } from './_components/orders-client'

export default async function OrdersPage() {
  const t = await getTranslations('pages.orders')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <OrdersClient />
    </div>
  )
}
