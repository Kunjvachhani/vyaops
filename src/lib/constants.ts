export const TIERS = {
  TIER_1: 'tier_1',
  TIER_2: 'tier_2',
  TIER_3: 'tier_3',
} as const

export type Tier = (typeof TIERS)[keyof typeof TIERS]

export const IST_TIMEZONE = 'Asia/Kolkata'

export const PAISE_PER_RUPEE = 100

export const SUPPORTED_LOCALES = ['en', 'hi', 'gu'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

export const APP_NAME = 'VyaOps'
