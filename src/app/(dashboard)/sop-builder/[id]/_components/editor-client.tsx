'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TiptapEditor } from '../../_components/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  Globe,
  Loader2,
  Printer,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type SopVersion = {
  id: string
  title: string
  category: string | null
  content: string
  version: number
  status: string
  parent_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

type Props = {
  rootId: string
  versions: SopVersion[]
}

const CATEGORIES = [
  { value: 'quality',     label: 'Quality Control' },
  { value: 'production',  label: 'Production Process' },
  { value: 'safety',      label: 'Safety' },
  { value: 'maintenance', label: 'Maintenance' },
]

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived:  'bg-gray-100 text-gray-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Editor Client ────────────────────────────────────────────────────────────

export function EditorClient({ rootId, versions }: Props) {
  const router = useRouter()

  // Find latest non-archived version to show by default
  const defaultVersion = [...versions].reverse().find((v) => v.status !== 'archived') ?? versions[versions.length - 1]

  const [activeVersion, setActiveVersion] = useState<SopVersion>(defaultVersion)
  const [title, setTitle] = useState(activeVersion.title)
  const [category, setCategory] = useState(activeVersion.category ?? '')
  const [content, setContent] = useState(activeVersion.content)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const isReadOnly = activeVersion.status !== 'draft'

  function handleContentChange(html: string) {
    setContent(html)
    setIsDirty(true)
  }

  function switchToVersion(v: SopVersion) {
    setActiveVersion(v)
    setTitle(v.title)
    setCategory(v.category ?? '')
    setContent(v.content)
    setIsDirty(false)
  }

  const handleSave = useCallback(async () => {
    if (!isDirty || isReadOnly) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sop/${activeVersion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category: category || null, content }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const json = await res.json() as { sop: SopVersion }
      setActiveVersion(json.sop)
      setIsDirty(false)
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [isDirty, isReadOnly, activeVersion.id, title, category, content])

  async function handlePublish() {
    setPublishing(true)
    try {
      const res = await fetch(`/api/sop/${activeVersion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { sop: SopVersion }
      const updated = json.sop
      setActiveVersion(updated)
      // Update versions list in-place (re-fetch by reloading)
      toast.success('Published — workers can now view this SOP')
      router.refresh()
    } catch {
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  async function handleNewVersion() {
    setCreatingVersion(true)
    try {
      // Save current draft content first if dirty
      if (isDirty && !isReadOnly) await handleSave()

      const res = await fetch(`/api/sop/${rootId}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: activeVersion.title, category: activeVersion.category, content: activeVersion.content }),
      })
      if (!res.ok) throw new Error()
      toast.success('New draft version created')
      router.refresh()
    } catch {
      toast.error('Failed to create new version')
    } finally {
      setCreatingVersion(false)
    }
  }

  async function handleArchive() {
    try {
      const res = await fetch(`/api/sop/${activeVersion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Archived')
      router.refresh()
    } catch {
      toast.error('Failed to archive')
    }
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/sop-builder/${rootId}`
    : `/sop-builder/${rootId}`

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Check out this SOP: ${activeVersion.title}\n${shareUrl}`)}`

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:space-y-2">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sop-builder">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All SOPs
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Badge className={STATUS_BADGE[activeVersion.status] ?? ''} variant="outline">
            v{activeVersion.version} — {activeVersion.status.charAt(0).toUpperCase() + activeVersion.status.slice(1)}
          </Badge>

          {/* Share */}
          <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>

          {/* Print */}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>

          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || saving}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>

              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing || activeVersion.status === 'published'}
              >
                {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Publish
              </Button>
            </>
          )}

          {isReadOnly && activeVersion.status === 'published' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewVersion}
              disabled={creatingVersion}
            >
              {creatingVersion ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GitBranch className="mr-1.5 h-4 w-4" />}
              New version
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList className="print:hidden">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="versions">
            Version history
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{versions.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Editor tab ── */}
        <TabsContent value="editor" className="space-y-4 mt-4">
          {/* Meta fields */}
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sop-title">SOP Name</Label>
              <Input
                id="sop-title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setIsDirty(true) }}
                disabled={isReadOnly}
                className="font-medium print:border-none print:shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              {isReadOnly ? (
                <div className="flex h-10 items-center text-sm">
                  {CATEGORIES.find((c) => c.value === category)?.label ?? '—'}
                </div>
              ) : (
                <Select value={category} onValueChange={(v) => { setCategory(v); setIsDirty(true) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Archive option for published */}
          {activeVersion.status === 'published' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 print:hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-900">This version is published</p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Published on {activeVersion.published_at ? formatDate(activeVersion.published_at) : '—'}. Create a new version to make edits.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleArchive} className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100">
                  Archive this version
                </Button>
              </div>
            </div>
          )}

          {/* Rich text editor */}
          <TiptapEditor
            content={content}
            onChange={handleContentChange}
            readOnly={isReadOnly}
          />
        </TabsContent>

        {/* ── Versions tab ── */}
        <TabsContent value="versions" className="mt-4 print:hidden">
          <div className="space-y-2">
            {[...versions].reverse().map((v) => (
              <button
                key={v.id}
                onClick={() => switchToVersion(v)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${activeVersion.id === v.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Version {v.version}</span>
                    <Badge className={STATUS_BADGE[v.status] ?? ''} variant="outline">
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(v.updated_at)}
                  </div>
                </div>
                {v.status === 'published' && v.published_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Published {formatDate(v.published_at)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Share dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share SOP</DialogTitle>
            <DialogDescription>Share this SOP with your team or via WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Link</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl)
                    toast.success('Link copied')
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-[#25D366] text-white hover:bg-[#1ebe5d]" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                  Send via WhatsApp
                </a>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/sop-builder/${rootId}`} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in new tab
                </Link>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print\\:hidden { display: none !important; }
          main { display: block !important; }
          #sop-print-area { display: block !important; }
        }
      `}</style>
    </div>
  )
}
