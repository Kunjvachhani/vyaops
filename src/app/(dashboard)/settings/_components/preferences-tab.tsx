'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { updatePreferences, updateProactivePreference } from '../actions'

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

type Props = {
  orgId: string
  languagePreference: string
  timezone: string
  proactiveEnabled: boolean
  proactiveSetAt: string | null
}

export function PreferencesTab({
  languagePreference,
  timezone,
  proactiveEnabled,
  proactiveSetAt,
}: Props) {
  const t = useTranslations('pages.settings.preferences')

  // --- Language + timezone state ---
  const [lang, setLang] = useState(languagePreference)
  const [tz, setTz] = useState(timezone)
  const [prefsPending, startPrefsTransition] = useTransition()
  const [prefsSuccess, setPrefsSuccess] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)

  // --- WhatsApp proactive state ---
  const [proactive, setProactive] = useState(proactiveEnabled)
  const [lastChanged, setLastChanged] = useState<string | null>(
    proactiveSetAt
      ? new Date(proactiveSetAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : null
  )
  const [proactivePending, startProactiveTransition] = useTransition()
  const [proactiveError, setProactiveError] = useState<string | null>(null)

  function onToggleProactive() {
    const next = !proactive
    setProactive(next)
    setProactiveError(null)
    startProactiveTransition(async () => {
      const result = await updateProactivePreference(next)
      if (!result.ok) {
        setProactive(!next)
        setProactiveError(t('updateError'))
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

  function onSavePrefs(e: React.FormEvent) {
    e.preventDefault()
    setPrefsSuccess(false)
    setPrefsError(null)
    startPrefsTransition(async () => {
      const result = await updatePreferences({ language_preference: lang, timezone: tz })
      if (!result.ok) {
        setPrefsError(t('prefsError'))
        return
      }
      setPrefsSuccess(true)
    })
  }

  return (
    <div className="space-y-4">
      {/* Language + Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('languageTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSavePrefs} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{t('languageLabel')}</label>
                <select
                  value={lang}
                  onChange={(e) => { setLang(e.target.value); setPrefsSuccess(false) }}
                  disabled={prefsPending}
                  className="input-field"
                >
                  <option value="gu">{t('langGu')}</option>
                  <option value="hi">{t('langHi')}</option>
                  <option value="en">{t('langEn')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t('timezoneLabel')}</label>
                <select
                  value={tz}
                  onChange={(e) => { setTz(e.target.value); setPrefsSuccess(false) }}
                  disabled={prefsPending}
                  className="input-field"
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
            </div>

            {prefsSuccess && (
              <p className="text-sm text-green-600">{t('prefsSuccess')}</p>
            )}
            {prefsError && (
              <p className="text-sm text-destructive">{prefsError}</p>
            )}

            <button
              type="submit"
              disabled={prefsPending}
              className="min-h-[44px] rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {prefsPending ? t('savingPrefs') : t('savePrefs')}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* WhatsApp notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('whatsappTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('notificationsLabel')}</p>
                <p className="text-sm text-muted-foreground">{t('notificationsHelp')}</p>
              </div>

              {/* 44×44 px minimum tap target */}
              <button
                type="button"
                role="switch"
                aria-checked={proactive}
                aria-label={t('notificationsLabel')}
                disabled={proactivePending}
                onClick={onToggleProactive}
                className={cn(
                  'relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    proactive ? 'bg-primary' : 'bg-input'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform',
                      proactive ? 'translate-x-[22px]' : 'translate-x-[2px]'
                    )}
                  />
                </span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {lastChanged ? t('lastChanged', { when: lastChanged }) : t('usingDefault')}
            </p>

            {proactiveError && (
              <p className="text-sm text-destructive">{proactiveError}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
