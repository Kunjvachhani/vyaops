import { Suspense } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { RupeesSavedHero } from './_components/rupees-saved-hero'
import { MetricCards } from './_components/metric-cards'
import { ActionItems } from './_components/action-items'
import { ActivityFeed } from './_components/activity-feed'
import { Plus, ClipboardList, FileText } from 'lucide-react'

// ─── Loading skeletons (stream while each section's server query runs) ──────────

function HeroSkeleton() {
  return <div className="h-40 animate-pulse rounded-xl bg-muted" />
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

function QuickActions({
  labels,
}: {
  labels: { newOrder: string; logProduction: string; createInvoice: string }
}) {
  const actions = [
    { href: '/orders', label: labels.newOrder, icon: Plus },
    { href: '/production', label: labels.logProduction, icon: ClipboardList },
    { href: '/invoices', label: labels.createInvoice, icon: FileText },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const t = await getTranslations('pages.dashboard')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        <QuickActions
          labels={{
            newOrder: t('quickActions.newOrder'),
            logProduction: t('quickActions.logProduction'),
            createInvoice: t('quickActions.createInvoice'),
          }}
        />
      </div>

      <Suspense fallback={<HeroSkeleton />}>
        <RupeesSavedHero />
      </Suspense>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricCards />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <ActionItems />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <ActivityFeed />
        </Suspense>
      </div>
    </div>
  )
}
