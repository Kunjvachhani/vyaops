'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteAccount } from '../actions'

type Props = {
  orgName: string
  isOwner: boolean
}

export function DataTab({ orgName, isOwner }: Props) {
  const t = useTranslations('pages.settings.data')
  const [exporting, setExporting] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function onExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vyaops-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* silently fail — user can retry */
    } finally {
      setExporting(false)
    }
  }

  function onDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteAccount(confirmName)
      if (result && !result.ok) {
        setDeleteError(
          result.error === 'name_mismatch' ? t('deleteNameMismatch') : t('deleteError')
        )
      }
      // On success, deleteAccount calls redirect('/login') — no client handling needed
    })
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('exportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('exportDesc')}</p>
          <button
            onClick={onExport}
            disabled={exporting}
            className="min-h-[44px] rounded-md border px-6 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {exporting ? t('exporting') : t('exportButton')}
          </button>
        </CardContent>
      </Card>

      {/* Delete account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t('deleteTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('deleteDesc')}</p>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {t('deleteWarning')}
              </div>

              <form onSubmit={onDelete} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {t('deleteConfirmLabel')}
                  </label>
                  <input
                    value={confirmName}
                    onChange={(e) => {
                      setConfirmName(e.target.value)
                      setDeleteError(null)
                    }}
                    placeholder={orgName}
                    disabled={isPending}
                    className="input-field"
                  />
                </div>

                {deleteError && (
                  <p className="text-sm text-destructive">{deleteError}</p>
                )}

                <button
                  type="submit"
                  disabled={isPending || confirmName !== orgName}
                  className="min-h-[44px] rounded-md bg-destructive px-6 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPending ? t('deletingButton') : t('deleteButton')}
                </button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
