'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TiptapEditor, TemplateStarters, SOP_TEMPLATES } from '../_components/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = [
  { value: 'quality',     label: 'Quality Control' },
  { value: 'production',  label: 'Production Process' },
  { value: 'safety',      label: 'Safety' },
  { value: 'maintenance', label: 'Maintenance' },
]

const EMPTY_CONTENT = '<p></p>'

export default function NewSopPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState(EMPTY_CONTENT)
  const [saving, setSaving] = useState(false)

  function applyTemplate(key: string) {
    const tmpl = SOP_TEMPLATES[key]
    if (!tmpl) return
    setTitle(tmpl.title)
    setCategory(tmpl.category)
    setContent(tmpl.content)
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('SOP name is required')
      return
    }
    if (content === EMPTY_CONTENT || !content.trim()) {
      toast.error('SOP content cannot be empty')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category: category || undefined, content }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to create SOP')
      }
      const json = await res.json() as { sop: { id: string } }
      toast.success('SOP created')
      router.push(`/sop-builder/${json.sop.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create SOP')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sop-builder">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All SOPs
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save draft
        </Button>
      </div>

      {/* Meta fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-title">SOP Name *</Label>
          <Input
            id="new-title"
            placeholder="e.g., Daily Machine Startup"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template starters */}
      <TemplateStarters onSelect={applyTemplate} />

      {/* Editor */}
      <TiptapEditor content={content} onChange={setContent} />
    </div>
  )
}
