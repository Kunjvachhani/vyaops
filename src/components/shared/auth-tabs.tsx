'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = { href: string; label: string }

export function AuthTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  return (
    <div className="flex rounded-lg border border-input bg-muted/50 p-1 gap-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium text-center transition-all min-h-[44px] flex items-center justify-center',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
