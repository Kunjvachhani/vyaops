'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { AuthTabs } from '@/components/shared/auth-tabs'
import { loginAction } from './actions'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type FieldErrors = Partial<Record<'email' | 'password', string>>

export default function LoginPage() {
  const t = useTranslations()
  const router = useRouter()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const tabs = [
    { href: '/login', label: t('auth.login') },
    { href: '/signup', label: t('auth.signup') },
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setServerError('')

    const formData = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    })

    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (field === 'email') errors.email = t('auth.invalidEmail')
        if (field === 'password') errors.password = t('auth.passwordMinLength')
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const result = await loginAction(formData)
      if ('error' in result) {
        setServerError(result.error || t('auth.loginError'))
      } else {
        router.replace('/dashboard')
      }
    } catch {
      setServerError(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="pt-6">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t('common.appName')}</h1>
          <p className="text-sm text-muted-foreground">Business on WhatsApp</p>
        </div>

        <AuthTabs tabs={tabs} />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth.signingIn') : t('auth.login')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('auth.signup')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
