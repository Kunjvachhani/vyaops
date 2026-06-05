import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  featureName: string
  requiredTier: 'tier_2' | 'tier_3'
}

export async function FeatureGateCard({ featureName, requiredTier }: Props) {
  const t = await getTranslations('featureGate')
  const tierName = requiredTier === 'tier_2' ? t('tier2Name') : t('tier3Name')

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">
          🔒 {t('lockedTitle', { feature: featureName, tier: tierName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('upgradeMessage')}</p>
        <Button asChild size="sm">
          <Link href="/settings">{t('upgradeButton')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
