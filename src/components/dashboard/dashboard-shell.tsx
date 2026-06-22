'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  Truck,
  Factory,
  Shield,
  Package,
  IndianRupee,
  Scale,
  BookOpen,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { signOutAction } from '@/app/(dashboard)/actions'
import { TIER_HIERARCHY } from '@/config/features'
import type { Tier } from '@/config/features'
import { cn } from '@/lib/utils'

type NavItem = {
  key: string
  href: string
  icon: React.ElementType
  tier: Tier
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, tier: 'tier_1' },
  { key: 'orders', href: '/orders', icon: ShoppingCart, tier: 'tier_1' },
  { key: 'invoices', href: '/invoices', icon: FileText, tier: 'tier_1' },
  { key: 'customers', href: '/customers', icon: Users, tier: 'tier_1' },
  { key: 'vendors', href: '/vendors', icon: Truck, tier: 'tier_1' },
  { key: 'production', href: '/production', icon: Factory, tier: 'tier_2' },
  { key: 'quality', href: '/quality', icon: Shield, tier: 'tier_2' },
  { key: 'inventory', href: '/inventory', icon: Package, tier: 'tier_2' },
  { key: 'cashFlow', href: '/cash-flow', icon: IndianRupee, tier: 'tier_2' },
  { key: 'compliance', href: '/compliance', icon: Scale, tier: 'tier_3' },
  { key: 'sopBuilder', href: '/sop-builder', icon: BookOpen, tier: 'tier_3' },
]

type Props = {
  orgName: string
  orgTier: Tier
  userEmail: string | null
  children: React.ReactNode
}

export function DashboardShell({ orgName, orgTier, userEmail, children }: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [userMenuOpen])

  const orgTierNum = TIER_HIERARCHY[orgTier]
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => TIER_HIERARCHY[item.tier] <= orgTierNum
  )
  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'U'

  function closeSidebar() {
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center border-b px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={closeSidebar}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold select-none">
              V
            </div>
            <span className="text-lg font-semibold tracking-tight">VyaOps</span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col overflow-y-auto p-3">
          <div className="flex flex-1 flex-col gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{t(item.key as Parameters<typeof t>[0])}</span>
                </Link>
              )
            })}
          </div>

          {/* Settings pinned at bottom */}
          <div className="mt-auto border-t pt-2">
            <Link
              href="/settings"
              onClick={closeSidebar}
              className={cn(
                'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/settings' || pathname.startsWith('/settings/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Settings size={18} aria-hidden="true" />
              <span>{t('settings')}</span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
          {/* Hamburger (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('openMenu')}
          >
            <Menu size={20} />
          </Button>

          {/* Org name */}
          <span className="max-w-[180px] truncate text-sm font-semibold md:max-w-xs">
            {orgName}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />

            {/* User dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md px-2 transition-colors hover:bg-accent"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-semibold select-none">
                  {userInitial}
                </div>
                <span className="hidden max-w-[120px] truncate text-sm md:block">
                  {userEmail}
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform',
                    userMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border bg-background shadow-md">
                  <div className="truncate border-b px-3 py-2 text-xs text-muted-foreground">
                    {userEmail}
                  </div>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <LogOut size={14} aria-hidden="true" />
                      {t('signOut')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Toasts (incl. undo-delete). Large tap targets for factory-floor phones. */}
      <Toaster position="bottom-center" richColors closeButton toastOptions={{ duration: 5000 }} />
    </div>
  )
}
