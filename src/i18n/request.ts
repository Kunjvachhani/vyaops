import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/constants'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value
  const locale: SupportedLocale =
    SUPPORTED_LOCALES.includes(raw as SupportedLocale)
      ? (raw as SupportedLocale)
      : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default as AbstractIntlMessages,
  }
})
