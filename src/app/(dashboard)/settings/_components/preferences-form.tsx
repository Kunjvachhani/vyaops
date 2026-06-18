'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { updateProactivePreference } from '../actions'

type Props = {
  initialEnabled: boolean
  // Pre-formatted IST string, or null when the owner has never set it.
  lastChangedLabel: string | null
}

export function PreferencesForm({ initialEnabled, lastChangedLabel }: Props) {
  const t = useTranslations('pages.settings.preferences')
  const [enabled, setEnabled] = useState(initialEnabled)
  const [lastChanged, setLastChanged] = useState<string | null>(lastChangedLabel)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onToggle() {
    const next = !enabled
    // Optimistic flip; revert on failure.
    setEnabled(next)
    setError(null)
    startTransition(async () => {
      const result = await updateProactivePreference(next)
      if (!result.ok) {
        setEnabled(!next)
        setError(t('updateError'))
        return
      }
      setLastChanged(
        new Date(result.setAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      )
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('notificationsLabel')}</p>
          <p className="text-sm text-muted-foreground">{t('notificationsHelp')}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('notificationsLabel')}
          disabled={isPending}
          onClick={onToggle}
          // 44x44 minimum tap target (mobile-first): the hit area is the full
          // button; the visible track sits centered inside it.
          className={cn(
            'relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-flex h-6 w-11 items-center rounded-full transition-colors',
              enabled ? 'bg-primary' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform',
                enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
              )}
            />
          </span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {lastChanged
          ? t('lastChanged', { when: lastChanged })
          : t('usingDefault')}
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
