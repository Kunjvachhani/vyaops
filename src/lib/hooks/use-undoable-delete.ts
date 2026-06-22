'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { SoftDeletableTable } from '@/lib/utils/soft-delete'

// Window (ms) the "Undo" toast stays visible. After this it disappears and the
// delete stands (the record remains soft-deleted and recoverable via admin).
const UNDO_WINDOW_MS = 30_000

export type UndoableDeleteArgs = {
  /** REST endpoint whose DELETE handler soft-deletes the record, e.g. `/api/orders/${id}`. */
  endpoint: string
  /** Table the record lives in — used by the restore call. */
  table: SoftDeletableTable
  /** Record id — used by the restore call. */
  id: string
  /** Optional name shown in the toast, e.g. "Order #047". */
  label?: string
  /** Called after a successful delete (and again after a successful undo). Defaults to router.refresh(). */
  onChange?: () => void
}

/**
 * Soft-delete a record with an inline "Undo" toast.
 *
 * Calls DELETE on `endpoint`; on success shows "Deleted. [Undo]" for 30s. The
 * Undo button POSTs to /api/admin/restore to clear `deleted_at`. After the
 * window the toast dismisses itself — the record stays soft-deleted (still
 * recoverable by an owner via the admin recovery view).
 */
export function useUndoableDelete() {
  const router = useRouter()
  const t = useTranslations('softDelete')
  const [isPending, startTransition] = useTransition()

  const restore = useCallback(
    async (table: SoftDeletableTable, id: string, onChange?: () => void) => {
      try {
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table, id }),
        })
        if (!res.ok) throw new Error('restore failed')
        toast.success(t('restored'))
        if (onChange) onChange()
        else startTransition(() => router.refresh())
      } catch {
        toast.error(t('restoreFailed'))
      }
    },
    [router, t]
  )

  const deleteRecord = useCallback(
    async ({ endpoint, table, id, label, onChange }: UndoableDeleteArgs) => {
      try {
        const res = await fetch(endpoint, { method: 'DELETE' })
        if (!res.ok) throw new Error('delete failed')

        if (onChange) onChange()
        else startTransition(() => router.refresh())

        const message = label ? `${label} — ${t('deleted')}` : t('deleted')
        toast(message, {
          duration: UNDO_WINDOW_MS,
          action: {
            label: t('undo'),
            onClick: () => void restore(table, id, onChange),
          },
        })
      } catch {
        toast.error(t('deleteFailed'))
      }
    },
    [router, t, restore]
  )

  return { deleteRecord, isPending }
}
