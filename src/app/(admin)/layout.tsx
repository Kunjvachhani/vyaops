import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Toaster } from 'sonner'
import { getPlatformAdmin } from '@/lib/supabase/platform-admin'

// Authoritative platform-admin gate. Middleware already blocks /admin for users without the
// app_metadata.is_platform_admin flag (fast path); this is the hard DB check (defense in depth).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getPlatformAdmin()
  if (!admin) redirect('/dashboard')

  const t = await getTranslations('admin')

  return (
    // Deliberately distinct from the tenant dashboard (dark, amber accent) so it is never
    // ambiguous that you are in the cross-org platform-admin plane.
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-amber-500/30 bg-zinc-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-zinc-950">
            {t('badge')}
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-zinc-300 hover:text-white">
              {t('nav.home')}
            </Link>
            <Link href="/admin/recovery" className="text-zinc-300 hover:text-white">
              {t('nav.recovery')}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{admin.label || t('platformAdmin')}</span>
          <Link href="/dashboard" className="text-amber-400 hover:text-amber-300">
            {t('nav.exitToDashboard')}
          </Link>
        </div>
      </header>
      <main className="p-6">{children}</main>
      <Toaster position="bottom-center" theme="dark" richColors />
    </div>
  )
}
