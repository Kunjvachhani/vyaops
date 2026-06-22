import * as Sentry from '@sentry/nextjs'

export async function register() {
  const { init } = await import('@sentry/nextjs')
  init({
    dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
  })
}

export const onRequestError = Sentry.captureRequestError
