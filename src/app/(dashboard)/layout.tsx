import { SignOutButton } from '@/components/shared/sign-out-button'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r bg-background p-4">
        <div className="flex-1">
          {/* Sidebar nav — Sprint 2 */}
        </div>
        <SignOutButton />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
