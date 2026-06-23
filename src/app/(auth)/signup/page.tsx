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
import { INDUSTRIES } from '@/config/industries'
import { signupAction } from './actions'

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().min(1),
  gstin: z
    .string()
    .optional()
    .refine((v) => !v || GSTIN_REGEX.test(v.toUpperCase()), { message: 'gstin' }),
  industry: z.string().min(1),
})

type Fields = z.infer<typeof signupSchema>
type FieldErrors = Partial<Record<keyof Fields, string>>

const selectClass =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

type Tier = 'tier_1' | 'tier_2' | 'tier_3'

export default function SignupPage() {
  const t = useTranslations()
  const router = useRouter()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState<Tier>('tier_1')

  const tabs = [
    { href: '/login', label: t('auth.login') },
    { href: '/signup', label: t('auth.signup') },
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setServerError('')

    const formData = new FormData(e.currentTarget)
    const parsed = signupSchema.safeParse({
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      password: formData.get('password'),
      companyName: formData.get('companyName'),
      address: formData.get('address') || undefined,
      city: formData.get('city'),
      gstin: formData.get('gstin') || undefined,
      industry: formData.get('industry'),
    })

    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Fields
        if (field === 'email') {
          errors.email = t('auth.invalidEmail')
        } else if (field === 'password') {
          errors.password = t('auth.passwordMinLength')
        } else if (field === 'gstin') {
          errors.gstin = t('auth.invalidGstin')
        } else {
          errors[field] = t('auth.fieldRequired')
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const result = await signupAction(formData)
      if ('error' in result) {
        setServerError(result.error || t('auth.signupError'))
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
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t('common.appName')}</h1>
          <p className="text-sm text-muted-foreground">Business on WhatsApp</p>
        </div>

        <AuthTabs tabs={tabs} />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('auth.fullName')}</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
            />
            {fieldErrors.fullName && (
              <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          {/* Email */}
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

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">{t('auth.companyName')}</Label>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              autoComplete="off"
              placeholder="e.g. JM Ventures Lab"
              required
            />
            {fieldErrors.companyName && (
              <p className="text-xs text-destructive">{fieldErrors.companyName}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">
              {t('auth.address')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="address"
              name="address"
              type="text"
              autoComplete="off"
              placeholder="e.g. Plot 12, GIDC Estate, Rajkot"
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">{t('auth.city')}</Label>
            <Input
              id="city"
              name="city"
              type="text"
              autoComplete="off"
              placeholder="e.g. Rajkot"
              required
            />
            {fieldErrors.city && (
              <p className="text-xs text-destructive">{fieldErrors.city}</p>
            )}
          </div>

          {/* GSTIN */}
          <div className="space-y-2">
            <Label htmlFor="gstin">
              {t('auth.gstin')}{' '}
              <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="gstin"
              name="gstin"
              type="text"
              autoComplete="off"
              placeholder="e.g. 24AABCU9603R1ZX"
              maxLength={15}
              className="uppercase"
            />
            {fieldErrors.gstin && (
              <p className="text-xs text-destructive">{fieldErrors.gstin}</p>
            )}
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry">{t('auth.industry')}</Label>
            <select
              id="industry"
              name="industry"
              required
              defaultValue=""
              className={selectClass}
            >
              <option value="" disabled>
                {t('auth.selectIndustry')}
              </option>
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value} title={ind.examples}>
                  {ind.label}
                </option>
              ))}
            </select>
            {fieldErrors.industry && (
              <p className="text-xs text-destructive">{fieldErrors.industry}</p>
            )}
          </div>

          {/* Plan / Tier */}
          <div className="space-y-2">
            <Label>{t('auth.selectPlan')}</Label>
            <input type="hidden" name="tier" value={tier} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { value: 'tier_1', name: t('auth.tier1Name'), desc: t('auth.tier1Desc') },
                  { value: 'tier_2', name: t('auth.tier2Name'), desc: t('auth.tier2Desc') },
                  { value: 'tier_3', name: t('auth.tier3Name'), desc: t('auth.tier3Desc') },
                ] as { value: Tier; name: string; desc: string }[]
              ).map((plan) => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => setTier(plan.value)}
                  className={`rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    tier === plan.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-input hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth.creatingAccount') : t('auth.signup')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('auth.haveAccount')}{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('auth.login')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
