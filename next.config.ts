import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  // Native / heavy server-only packages that must not be bundled by the server
  // compiler — loaded at runtime from node_modules instead. Puppeteer/Chromium
  // for PDF generation; pdf-parse (+ its pdfjs-dist) and exceljs for the
  // onboarding contact-import parser.
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
    'pdf-parse',
    'pdfjs-dist',
    'exceljs',
  ],
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
