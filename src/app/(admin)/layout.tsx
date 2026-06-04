export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background p-4">
        <span className="font-semibold text-sm text-muted-foreground">VyaOps Admin</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
