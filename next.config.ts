import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  // Puppeteer / Chromium are native packages that must not be bundled by the
  // server compiler — they're loaded at runtime from node_modules instead.
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium'],
}

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // Source map uploads require SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
