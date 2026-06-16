import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  // Puppeteer / Chromium are native packages that must not be bundled by the
  // server compiler — they're loaded at runtime from node_modules instead.
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium'],
}

export default withNextIntl(nextConfig)
