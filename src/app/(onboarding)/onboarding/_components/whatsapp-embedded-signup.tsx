'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { connectWhatsApp } from '../actions'

// Dualhook's tech-provider Meta app credentials (public — inlined at build).
const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID
const FB_CONFIG_ID = process.env.NEXT_PUBLIC_FB_CONFIG_ID
const FB_GRAPH_VERSION = process.env.NEXT_PUBLIC_FB_GRAPH_VERSION || 'v21.0'

export const isEmbeddedSignupConfigured = Boolean(FB_APP_ID && FB_CONFIG_ID)

// ─── Facebook JS SDK typings (minimal surface we use) ────────────────────────

type FBLoginResponse = { authResponse?: { code?: string } | null; status?: string }
interface FBStatic {
  init(params: Record<string, unknown>): void
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    FB?: FBStatic
    fbAsyncInit?: () => void
  }
}

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js'

function loadFbSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'))
    if (window.FB) return resolve()

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: FB_APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: FB_GRAPH_VERSION,
      })
      resolve()
    }

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = SDK_SRC
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'
      script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
      document.body.appendChild(script)
    }
  })
}

type SessionInfo = { phoneNumberId: string; wabaId: string | null; displayPhoneNumber: string | null }
type Status = 'idle' | 'connecting' | 'connected' | 'error'

export function WhatsAppEmbeddedSignup({
  onConnected,
}: {
  onConnected: (displayNumber: string | null) => void
}) {
  const t = useTranslations('onboarding')
  const [status, setStatus] = useState<Status>('idle')
  const [display, setDisplay] = useState<string | null>(null)
  const sessionRef = useRef<SessionInfo | null>(null)

  // Capture the phone_number_id / waba_id that Meta posts back during signup.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return
      }
      try {
        const data = JSON.parse(event.data)
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
        if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
          sessionRef.current = {
            phoneNumberId: data.data?.phone_number_id ?? '',
            wabaId: data.data?.waba_id ?? null,
            displayPhoneNumber: data.data?.display_phone_number ?? null,
          }
        }
      } catch {
        // Non-JSON postMessage from FB — ignore.
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const start = useCallback(async () => {
    setStatus('connecting')
    sessionRef.current = null
    try {
      await loadFbSdk()
    } catch {
      setStatus('error')
      return
    }
    if (!window.FB) {
      setStatus('error')
      return
    }

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code
        const session = sessionRef.current
        if (!code || !session?.phoneNumberId) {
          // User closed the popup or signup did not complete.
          setStatus('idle')
          return
        }
        void (async () => {
          const res = await connectWhatsApp({
            code,
            phoneNumberId: session.phoneNumberId,
            wabaId: session.wabaId,
            displayPhoneNumber: session.displayPhoneNumber,
          })
          if (!res.ok) {
            setStatus('error')
            return
          }
          setDisplay(res.data.displayPhoneNumber)
          setStatus('connected')
          onConnected(res.data.displayPhoneNumber)
        })()
      },
      {
        config_id: FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    )
  }, [onConnected])

  if (status === 'connected') {
    return (
      <p className="text-sm font-medium text-primary">
        {t('step6.connected')}
        {display ? ` (${display})` : ''}
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={status === 'connecting'}
        className="min-h-[44px] rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status === 'connecting' ? t('step6.connecting') : t('step6.connect')}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-sm text-destructive">{t('step6.connectError')}</p>
      )}
    </div>
  )
}
