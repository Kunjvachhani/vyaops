export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-background p-4">
        {/* Sidebar — Sprint 2 */}
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
