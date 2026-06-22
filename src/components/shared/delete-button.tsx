'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUndoableDelete } from '@/lib/hooks/use-undoable-delete'
import type { SoftDeletableTable } from '@/lib/utils/soft-delete'

type Props = {
  /** DELETE endpoint, e.g. `/api/orders/${id}`. */
  endpoint: string
  /** Table the record lives in (for the undo/restore call). */
  table: SoftDeletableTable
  /** Record id (for the undo/restore call). */
  id: string
  /** Human label shown in the confirm dialog + undo toast, e.g. "Order #047". */
  label?: string
  /** Optional callback after delete/undo. Defaults to a router refresh. */
  onChange?: () => void
  /** Visual size of the trigger button. */
  size?: 'sm' | 'default' | 'icon'
  /**
   * When true the user must type `label` exactly before the Confirm button
   * enables. Use for extra-dangerous deletions (e.g. customers with orders).
   */
  requireTypedName?: boolean
}

/**
 * Destructive delete control: explicit confirm dialog (CLAUDE.md rule #4) then
 * a soft-delete with a 30-second "Undo" toast. Nothing is ever hard-deleted.
 */
export function DeleteButton({ endpoint, table, id, label, onChange, size = 'sm', requireTypedName = false }: Props) {
  const t = useTranslations('common')
  const tsd = useTranslations('softDelete')
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const { deleteRecord, isPending } = useUndoableDelete()

  function handleOpen() {
    setTyped('')
    setOpen(true)
  }

  async function handleConfirm() {
    setOpen(false)
    setTyped('')
    await deleteRecord({ endpoint, table, id, label, onChange })
  }

  const confirmDisabled = isPending || (requireTypedName && typed.trim() !== (label ?? ''))

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={handleOpen}
        aria-label={t('delete')}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
        {size !== 'icon' ? <span className="ml-1">{t('delete')}</span> : null}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setTyped(''); setOpen(v) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label ? `${t('delete')} — ${label}` : t('delete')}</DialogTitle>
            <DialogDescription>{tsd('undoHint')}</DialogDescription>
          </DialogHeader>

          {requireTypedName && label && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {tsd('typeNameHint', { label })}
              </p>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={label}
                autoFocus
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setTyped(''); setOpen(false) }}>
              {t('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm} disabled={confirmDisabled}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
