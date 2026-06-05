'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SUPPORTED_LOCALES } from '@/lib/constants'

export function LanguageSwitcher() {
  const router = useRouter()

  function switchLocale(locale: string) {
    document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`
    router.refresh()
  }

  return (
    <div className="flex gap-1">
      {SUPPORTED_LOCALES.map((locale) => (
        <Button
          key={locale}
          variant="ghost"
          size="sm"
          onClick={() => switchLocale(locale)}
          className="min-h-[44px] min-w-[44px] uppercase text-xs font-semibold"
        >
          {locale}
        </Button>
      ))}
    </div>
  )
}
