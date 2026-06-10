import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'VyaOps',
  description: 'Business on WhatsApp — AI-powered operations for Indian MSMEs',
  other: {
    'facebook-domain-verification': 'ig4cll0ipyk8bkxh2qwrftvqlovnws',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()])

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
