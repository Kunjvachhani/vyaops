export const locales = ['en', 'hi', 'gu'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
