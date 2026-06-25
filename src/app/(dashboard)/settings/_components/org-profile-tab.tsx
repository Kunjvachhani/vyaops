'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRIES } from '@/config/industries'
import { updateOrgProfile } from '../actions'

type OrgData = {
  id: string
  name: string
  gstin: string | null
  address: string | null
  city: string
  state: string
  phone: string
  email: string | null
  industry_config: string
  logo_url: string | null
}

type Props = {
  org: OrgData
  isOwner: boolean
}

export function OrgProfileTab({ org, isOwner }: Props) {
  const t = useTranslations('pages.settings.orgProfile')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(org.logo_url)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: org.name,
    gstin: org.gstin ?? '',
    address: org.address ?? '',
    city: org.city,
    state: org.state,
    phone: org.phone,
    email: org.email ?? '',
    industry_config: org.industry_config,
  })

  function onFieldChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSuccess(false)
    setError(null)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function uploadLogo(file: File): Promise<string | null> {
    setLogoUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${org.id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        setError(t('uploadError'))
        return null
      }

      const { data } = supabase.storage.from('org-logos').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setLogoUploading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)
    setError(null)

    startTransition(async () => {
      let logo_url: string | null | undefined = undefined
      if (logoFile) {
        logo_url = await uploadLogo(logoFile)
        if (logo_url === null) return // upload error already set
      }

      const result = await updateOrgProfile({
        name: form.name,
        gstin: form.gstin || null,
        address: form.address || null,
        city: form.city,
        state: form.state,
        phone: form.phone,
        email: form.email || null,
        industry_config: form.industry_config,
        ...(logo_url !== undefined ? { logo_url } : {}),
      })

      if (!result.ok) {
        setError(t('saveError'))
        return
      }
      setLogoFile(null)
      setSuccess(true)
    })
  }

  const busy = isPending || logoUploading

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!isOwner && (
          <p className="mb-4 text-sm text-muted-foreground">{t('ownerOnly')}</p>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
              {logoPreview ? (
                <Image src={logoPreview} alt="Logo" fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                  {form.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('logo')}</p>
              <p className="text-xs text-muted-foreground">{t('logoHelp')}</p>
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                    disabled={busy}
                  >
                    {t('changeLogo')}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </>
              )}
            </div>
          </div>

          {/* Fields grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('companyName')} required>
              <input
                name="name"
                value={form.name}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                required
                className="input-field"
              />
            </Field>

            <Field label={t('gstin')} hint={t('gstinHelp')}>
              <input
                name="gstin"
                value={form.gstin}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                maxLength={15}
                className="input-field uppercase"
              />
            </Field>

            <Field label={t('phone')} required>
              <input
                name="phone"
                value={form.phone}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                required
                className="input-field"
              />
            </Field>

            <Field label={t('email')}>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                className="input-field"
              />
            </Field>

            <Field label={t('address')} className="sm:col-span-2">
              <textarea
                name="address"
                value={form.address}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                rows={2}
                className="input-field resize-none"
              />
            </Field>

            <Field label={t('city')} required>
              <input
                name="city"
                value={form.city}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                required
                className="input-field"
              />
            </Field>

            <Field label={t('state')} required>
              <input
                name="state"
                value={form.state}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                required
                className="input-field"
              />
            </Field>

            <Field label={t('industry')} className="sm:col-span-2">
              <select
                name="industry_config"
                value={form.industry_config}
                onChange={onFieldChange}
                disabled={!isOwner || busy}
                className="input-field"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {success && (
            <p className="text-sm text-green-600">{t('saveSuccess')}</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {isOwner && (
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? t('saving') : t('saveChanges')}
            </button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tiny layout helper — keeps field + label paired
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
