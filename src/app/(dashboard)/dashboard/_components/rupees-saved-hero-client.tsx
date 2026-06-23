'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { paiseToCurrency } from '@/lib/utils/currency'
import type { RupeesSavedBreakdown } from '@/lib/utils/rupees-saved'
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ShieldCheck,
  Banknote,
  Copy,
  Clock,
} from 'lucide-react'

interface Props {
  breakdown: RupeesSavedBreakdown
  previousTotalPaise: number
}

// Counts up to `target` over ~900ms with an ease-out curve. Respects
// prefers-reduced-motion by snapping straight to the final value.
function useCountUp(target: number): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || target === 0) {
      setValue(target)
      return
    }

    const duration = 900
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target])

  return value
}

function BreakdownRow({
  icon,
  label,
  description,
  amountPaise,
}: {
  icon: React.ReactNode
  label: string
  description: string
  amountPaise: number
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-emerald-100">{icon}</div>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-emerald-100/80">{description}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
        {paiseToCurrency(amountPaise)}
      </p>
    </div>
  )
}

export function RupeesSavedHeroClient({ breakdown, previousTotalPaise }: Props) {
  const t = useTranslations('pages.dashboard.hero')
  const [expanded, setExpanded] = useState(false)
  const animated = useCountUp(breakdown.totalSavedPaise)

  const { quality, paymentSpeed, duplicatePrevention, time } = breakdown

  // Trend vs previous full month. Skip when there's no prior baseline to compare.
  const hasTrend = previousTotalPaise > 0
  const trendPct = hasTrend
    ? Math.round(
        ((breakdown.totalSavedPaise - previousTotalPaise) / previousTotalPaise) * 100,
      )
    : 0
  const trendUp = trendPct >= 0

  const hasSavings = breakdown.totalSavedPaise > 0

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-100">
              {t('savedThisMonth')}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
              {paiseToCurrency(animated)}
            </p>
          </div>

          {hasTrend && (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                trendUp ? 'bg-emerald-500/40' : 'bg-red-500/30'
              }`}
            >
              {trendUp ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="tabular-nums">
                {trendUp ? '+' : ''}
                {trendPct}%
              </span>
              <span className="font-normal text-emerald-100">{t('vsLastMonth')}</span>
            </div>
          )}
        </div>

        {!hasSavings && (
          <p className="mt-3 text-sm text-emerald-100">{t('noSavings')}</p>
        )}

        {hasSavings && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-4 flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-emerald-50 hover:text-white"
            >
              {expanded ? t('hideBreakdown') : t('breakdown')}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>

            {expanded && (
              <div className="mt-2 divide-y divide-white/15 border-t border-white/15 pt-1">
                <BreakdownRow
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label={t('quality')}
                  description={t('qualityDesc')}
                  amountPaise={quality.savedPaise}
                />
                <BreakdownRow
                  icon={<Banknote className="h-5 w-5" />}
                  label={t('payments')}
                  description={t('paymentsDesc')}
                  amountPaise={paymentSpeed.savedPaise}
                />
                <BreakdownRow
                  icon={<Copy className="h-5 w-5" />}
                  label={t('duplicates')}
                  description={t('duplicatesDesc')}
                  amountPaise={duplicatePrevention.savedPaise}
                />
                <BreakdownRow
                  icon={<Clock className="h-5 w-5" />}
                  label={t('time')}
                  description={t('timeDesc')}
                  amountPaise={time.savedPaise}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
