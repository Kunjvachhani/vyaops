'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { inviteUser, changeUserRole, removeUser } from '../actions'

type OrgUser = {
  id: string
  full_name: string
  email: string | null
  role: string
  last_login_at: string | null
  is_active: boolean
}

type Props = {
  users: OrgUser[]
  isOwner: boolean
  tier: string
  currentUserId: string
}

const USER_LIMITS: Record<string, number> = {
  tier_1: 2,
  tier_2: 5,
  tier_3: 10,
}

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  worker: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
}

function formatLastActive(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export function TeamManagementTab({ users, isOwner, tier, currentUserId }: Props) {
  const t = useTranslations('pages.settings.team')
  const [localUsers, setLocalUsers] = useState(users)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const limit = USER_LIMITS[tier] ?? 2
  const atLimit = localUsers.length >= limit

  function showFeedback(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  function onRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const result = await changeUserRole({ userId, role })
      if (!result.ok) {
        showFeedback('err', t('changeRoleError'))
        return
      }
      setLocalUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      )
      showFeedback('ok', t('changeRoleSuccess'))
    })
  }

  function onRemove(userId: string) {
    startTransition(async () => {
      const result = await removeUser(userId)
      if (!result.ok) {
        showFeedback('err', t('removeError'))
        return
      }
      setLocalUsers((prev) => prev.filter((u) => u.id !== userId))
      showFeedback('ok', t('removeSuccess'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <button
                disabled={atLimit}
                title={atLimit ? t('userLimitTitle') : undefined}
                className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {t('inviteButton')}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('inviteTitle')}</DialogTitle>
              </DialogHeader>
              <InviteForm
                onSuccess={(newUser) => {
                  setLocalUsers((prev) => [...prev, newUser])
                  setInviteOpen(false)
                  showFeedback('ok', t('inviteSuccess', { email: newUser.email ?? '' }))
                }}
                onError={() => showFeedback('err', t('inviteError'))}
              />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!isOwner && (
          <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
        )}

        {atLimit && isOwner && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('userLimitDesc', { tier, max: limit })}
          </div>
        )}

        {feedback && (
          <p
            className={
              feedback.type === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'
            }
          >
            {feedback.msg}
          </p>
        )}

        {/* Mobile-friendly card list */}
        <div className="space-y-2">
          {localUsers.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.full_name}
                  {u.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({t('you')})
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {t('lastActive')}:{' '}
                  {u.last_login_at ? formatLastActive(u.last_login_at) : t('never')}
                </p>
              </div>

              {/* Role badge / select */}
              <div className="flex items-center gap-2">
                {u.role === 'owner' || !isOwner ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? ROLE_BADGE.viewer}`}
                  >
                    {t(`role${u.role.charAt(0).toUpperCase()}${u.role.slice(1)}` as 'roleOwner')}
                  </span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                    disabled={isPending}
                    aria-label={t('changeRole')}
                    className="input-field py-1 text-xs"
                  >
                    <option value="manager">{t('roleManager')}</option>
                    <option value="worker">{t('roleWorker')}</option>
                    <option value="viewer">{t('roleViewer')}</option>
                  </select>
                )}

                {/* Remove — owner can remove anyone except themselves and other owners */}
                {isOwner && u.role !== 'owner' && u.id !== currentUserId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={isPending}
                        className="min-h-[44px] min-w-[44px] rounded-md px-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        aria-label={t('removeUser')}
                      >
                        {t('removeUser')}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirmRemoveTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('confirmRemoveDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onRemove(u.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('confirmRemoveButton')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Invite form (rendered inside Dialog)
// ---------------------------------------------------------------------------

type InviteFormProps = {
  onSuccess: (user: OrgUser) => void
  onError: () => void
}

function InviteForm({ onSuccess, onError }: InviteFormProps) {
  const t = useTranslations('pages.settings.team')
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ email: '', full_name: '', role: 'worker' })
  const [fieldError, setFieldError] = useState<string | null>(null)

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setFieldError(null)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.full_name) return

    startTransition(async () => {
      const result = await inviteUser({
        email: form.email,
        full_name: form.full_name,
        role: form.role as 'manager' | 'worker' | 'viewer',
      })

      if (!result.ok) {
        setFieldError(
          result.error === 'user_limit_reached'
            ? t('userLimitTitle')
            : t('inviteError')
        )
        onError()
        return
      }

      onSuccess({
        id: crypto.randomUUID(),
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        last_login_at: null,
        is_active: false,
      })
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div>
        <label className="mb-1 block text-sm font-medium">{t('inviteFullName')}</label>
        <input
          name="full_name"
          value={form.full_name}
          onChange={onChange}
          required
          disabled={isPending}
          className="input-field"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t('inviteEmail')}</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          required
          disabled={isPending}
          className="input-field"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t('inviteRole')}</label>
        <select
          name="role"
          value={form.role}
          onChange={onChange}
          disabled={isPending}
          className="input-field"
        >
          <option value="manager">{t('roleManager')}</option>
          <option value="worker">{t('roleWorker')}</option>
          <option value="viewer">{t('roleViewer')}</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{t('inviteRoleHelp')}</p>
      </div>

      {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[44px] rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? t('sendingInvite') : t('sendInvite')}
      </button>
    </form>
  )
}
