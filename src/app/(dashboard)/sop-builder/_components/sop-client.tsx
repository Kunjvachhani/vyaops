'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  BookOpen,
  FilePlus,
  Layers,
  Loader2,
  Plus,
  Shield,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

type SopSummary = {
  id: string
  title: string
  category: string | null
  version: number
  status: string
  updated_at: string
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  quality:     { label: 'Quality Control',    icon: <Shield className="h-3.5 w-3.5" />,   color: 'bg-blue-100 text-blue-800' },
  production:  { label: 'Production Process', icon: <Wrench className="h-3.5 w-3.5" />,   color: 'bg-amber-100 text-amber-800' },
  safety:      { label: 'Safety',             icon: <Shield className="h-3.5 w-3.5" />,   color: 'bg-red-100 text-red-800' },
  maintenance: { label: 'Maintenance',        icon: <Settings2 className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-800' },
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived:  'bg-gray-100 text-gray-600',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SopClient() {
  const [sops, setSops] = useState<SopSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SopSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sop')
      if (!res.ok) throw new Error('Failed to fetch SOPs')
      const json = await res.json() as { sops: SopSummary[] }
      setSops(json.sops ?? [])
    } catch {
      toast.error('Failed to load SOPs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchSops() }, [fetchSops])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sop/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('SOP deleted')
      setSops((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete SOP')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>{sops.length} procedure{sops.length !== 1 ? 's' : ''}</span>
        </div>
        <Button asChild>
          <Link href="/sop-builder/new">
            <Plus className="mr-2 h-4 w-4" />
            Create SOP
          </Link>
        </Button>
      </div>

      {sops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No SOPs yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first standard operating procedure to get started.
              </p>
            </div>
            <Button asChild>
              <Link href="/sop-builder/new">
                <FilePlus className="mr-2 h-4 w-4" />
                Create your first SOP
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All SOPs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SOP Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sops.map((sop) => {
                  const cat = sop.category ? CATEGORY_META[sop.category] : null
                  return (
                    <TableRow key={sop.id} className="group">
                      <TableCell>
                        <Link
                          href={`/sop-builder/${sop.id}`}
                          className="font-medium hover:underline"
                        >
                          {sop.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.color}`}>
                            {cat.icon}
                            {cat.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">v{sop.version}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(sop.updated_at)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[sop.status] ?? 'bg-gray-100 text-gray-600'} variant="outline">
                          {sop.status.charAt(0).toUpperCase() + sop.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/sop-builder/${sop.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(sop)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SOP?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot; and all its versions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
