'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { paiseToCurrency } from '@/lib/utils/currency'
import { RAZORPAY_PLANS } from '@/lib/billing/razorpay'

// Razorpay checkout SDK loaded dynamically
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

type BillingEvent = {
  id: string
  event_type: string
  created_at: string
}

type SubscriptionData = {
  tier: string
  planName: string | null
  billingStatus: string
  tierValidUntil: string | null
  subscriptionId: string | null
  razorpayStatus: string | null
  nextChargeAt: string | null
  availablePlans: Array<{
    tier: string
    planId: string
    name: string
    amountPaise: number
    isCurrent: boolean
  }>
}

type OrgBillingData = {
  tier: string
  billing_status: string
  tier_valid_until: string | null
  razorpay_subscription_id: string | null
}

type Props = {
  org: OrgBillingData
  billingEvents: BillingEvent[]
  isOwner: boolean
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  grace_period: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function eventLabel(
  eventType: string,
  t: (key: string) => string
): { label: string; color: string } {
  switch (eventType) {
    case 'subscription.charged':
      return { label: t('eventCharged'), color: 'text-green-600' }
    case 'payment.failed':
      return { label: t('eventFailed'), color: 'text-red-600' }
    case 'subscription.halted':
      return { label: t('eventHalted'), color: 'text-amber-600' }
    case 'subscription.cancelled':
      return { label: t('eventCancelled'), color: 'text-gray-600' }
    case 'subscription.authenticated':
      return { label: t('eventAuthenticated'), color: 'text-blue-600' }
    default:
      return { label: eventType, color: 'text-muted-foreground' }
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

async function openRazorpayCheckout(opts: {
  subscriptionId: string
  keyId: string
  planName: string
}) {
  await loadRazorpayScript()
  return new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: opts.keyId,
      subscription_id: opts.subscriptionId,
      name: 'VyaOps',
      description: opts.planName,
      handler: () => resolve(),
      modal: { ondismiss: () => reject(new Error('dismissed')) },
      theme: { color: '#7c3aed' },
    })
    rzp.open()
  })
}

export function BillingTab({ org, billingEvents, isOwner }: Props) {
  const t = useTranslations('pages.settings.billing')
  const [subData, setSubData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then((r) => r.json())
      .then((data: SubscriptionData) => setSubData(data))
      .catch(() => {/* use org data as fallback */})
      .finally(() => setLoading(false))
  }, [])

  const tier = subData?.tier ?? org.tier
  const planName =
    subData?.planName ?? RAZORPAY_PLANS[tier as keyof typeof RAZORPAY_PLANS]?.name ?? tier
  const billingStatus = subData?.billingStatus ?? org.billing_status
  const nextCharge = subData?.nextChargeAt
  const hasSubscription = !!(subData?.subscriptionId ?? org.razorpay_subscription_id)
  const availablePlans = subData?.availablePlans ?? []

  function handleCancelSubscription() {
    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      })
      if (!res.ok) {
        setError(t('cancelError'))
        return
      }
      setSubData((prev) =>
        prev ? { ...prev, billingStatus: 'cancelled', razorpayStatus: 'cancelled' } : prev
      )
    })
  }

  async function handleSelectPlan(planTier: string) {
    setError(null)
    const endpoint = hasSubscription ? '/api/billing/change-plan' : '/api/billing/checkout'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: planTier }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? t('cancelError'))
        return
      }
      const data = await res.json() as { subscriptionId: string; keyId: string; planName: string }
      setChangePlanOpen(false)
      await openRazorpayCheckout({
        subscriptionId: data.subscriptionId,
        keyId: data.keyId,
        planName: data.planName,
      }).catch(() => {/* user dismissed */})
    } catch {
      setError(t('cancelError'))
    }
  }

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!isOwner && (
            <p className="mb-4 text-sm text-muted-foreground">{t('ownerOnly')}</p>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loadingPlans')}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <InfoBlock label={t('currentPlan')} value={planName} />
                <InfoBlock
                  label={t('billingStatus')}
                  value={
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[billingStatus] ?? STATUS_BADGE.cancelled}`}
                    >
                      {t(`status${billingStatus.charAt(0).toUpperCase()}${billingStatus.slice(1).replace(/_./g, (m) => m[1].toUpperCase())}` as 'statusActive')}
                    </span>
                  }
                />
                <InfoBlock
                  label={t('nextBilling')}
                  value={nextCharge ? formatDate(nextCharge) : t('noNextBilling')}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {isOwner && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setChangePlanOpen(true)}
                    className="min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {hasSubscription ? t('changePlan') : t('subscribe')}
                  </button>

                  {hasSubscription && billingStatus !== 'cancelled' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={isPending}
                          className="min-h-[44px] rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {t('cancelPlan')}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('confirmCancelTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('confirmCancelDesc')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancelSubscription}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('confirmCancelButton')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {billingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
          ) : (
            <div className="divide-y">
              {billingEvents.map((ev) => {
                const { label, color } = eventLabel(ev.event_type, t)
                return (
                  <div key={ev.id} className="flex items-center justify-between py-2.5">
                    <span className={`text-sm ${color}`}>{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(ev.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change plan dialog */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('changePlanTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            {availablePlans.length > 0
              ? availablePlans.map((plan) => (
                  <PlanCard
                    key={plan.tier}
                    name={plan.name}
                    amountPaise={plan.amountPaise}
                    isCurrent={plan.isCurrent}
                    onSelect={() => handleSelectPlan(plan.tier)}
                    currentBadge={t('currentBadge')}
                    selectLabel={t('selectPlan')}
                    perMonth={t('perMonth')}
                  />
                ))
              : Object.entries(RAZORPAY_PLANS).map(([key, plan]) => (
                  <PlanCard
                    key={key}
                    name={plan.name}
                    amountPaise={plan.amountPaise}
                    isCurrent={key === tier}
                    onSelect={() => handleSelectPlan(key)}
                    currentBadge={t('currentBadge')}
                    selectLabel={t('selectPlan')}
                    perMonth={t('perMonth')}
                  />
                ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoBlock({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

function PlanCard({
  name,
  amountPaise,
  isCurrent,
  onSelect,
  currentBadge,
  selectLabel,
  perMonth,
}: {
  name: string
  amountPaise: number
  isCurrent: boolean
  onSelect: () => void
  currentBadge: string
  selectLabel: string
  perMonth: string
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className="text-sm font-semibold">{name}</p>
        {isCurrent && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            {currentBadge}
          </span>
        )}
      </div>
      <p className="mb-3 text-lg font-bold">
        {paiseToCurrency(amountPaise)}
        <span className="text-xs font-normal text-muted-foreground">{perMonth}</span>
      </p>
      {!isCurrent && (
        <button
          onClick={onSelect}
          className="w-full min-h-[44px] rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {selectLabel}
        </button>
      )}
    </div>
  )
}
