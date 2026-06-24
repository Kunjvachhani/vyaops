'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Image as ImageIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'

type Props = {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`rounded p-1.5 transition-colors hover:bg-muted ${active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  )
}

export function TiptapEditor({ content, onChange, readOnly = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  })

  async function handleImageUpload(file: File) {
    if (!editor) return

    setUploading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('sop-images')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (error) {
        toast.error(`Image upload failed: ${error.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from('sop-images').getPublicUrl(path)
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run()
    } finally {
      setUploading(false)
    }
  }

  if (!editor) return null

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            active={false}
            title="Divider"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => { if (!uploading) fileInputRef.current?.click() }}
            active={false}
            title={uploading ? 'Uploading…' : 'Insert image'}
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ImageIcon className="h-4 w-4" />}
          </ToolbarButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) await handleImageUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

// Template starters
export const SOP_TEMPLATES: Record<string, { title: string; category: string; content: string }> = {
  quality_inspection: {
    title: 'Quality Inspection Checklist',
    category: 'quality',
    content: `<h1>Quality Inspection Checklist</h1>
<p>Use this checklist for every production batch before dispatch.</p>
<h2>Pre-Inspection Setup</h2>
<ul><li>Gather all required measuring instruments</li><li>Verify calibration date of instruments</li><li>Review customer specifications and drawings</li></ul>
<h2>Dimensional Checks</h2>
<ol><li>Measure outer diameter at 3 points — record all values</li><li>Check inner diameter tolerance (±0.05mm)</li><li>Verify length to specification</li><li>Check surface finish with profilometer</li></ol>
<h2>Visual Inspection</h2>
<ul><li>No cracks, porosity, or cold shuts on casting surfaces</li><li>No machining marks outside tolerance zones</li><li>Threads (if applicable) tested with go/no-go gauge</li></ul>
<h2>Documentation</h2>
<p>Record all readings in the inspection register. Sign and date the checklist. Attach to the dispatch challan.</p>`,
  },
  machine_startup: {
    title: 'Machine Startup Procedure',
    category: 'production',
    content: `<h1>Machine Startup Procedure</h1>
<p>Follow this procedure every morning before beginning production.</p>
<h2>Safety First</h2>
<ul><li>Wear PPE: safety glasses, gloves, safety shoes</li><li>Ensure emergency stop button is accessible and functional</li><li>Check that guards and shields are in place</li></ul>
<h2>Pre-Start Checks</h2>
<ol><li>Check lubricant oil level — top up if below minimum mark</li><li>Check coolant level and concentration</li><li>Inspect belts and pulleys for wear or damage</li><li>Clear chips and debris from work area</li></ol>
<h2>Startup Sequence</h2>
<ol><li>Turn on main power isolator</li><li>Start hydraulic unit — wait 2 minutes for pressure to build</li><li>Start spindle at minimum speed — listen for unusual noise</li><li>Run warm-up cycle for 5 minutes before production</li></ol>
<h2>First-Off Inspection</h2>
<p>Always inspect the first component of the day before running full production. Adjust offsets if required.</p>`,
  },
}

export function TemplateStarters({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Start from a template</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(SOP_TEMPLATES).map(([key, tmpl]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => onSelect(key)}
          >
            {tmpl.title}
          </Button>
        ))}
      </div>
    </div>
  )
}
