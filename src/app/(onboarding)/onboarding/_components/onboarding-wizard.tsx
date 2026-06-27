'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRIES, productTemplatesFor } from '@/config/industries'
import {
  saveLanguage,
  saveCompanyDetails,
  addCustomers,
  addProducts,
  parseContactsFile,
  generateDictionary,
  confirmEntry,
  completeOnboarding,
  type ReviewEntry,
} from '../actions'
import {
  WhatsAppEmbeddedSignup,
  isEmbeddedSignupConfigured,
} from './whatsapp-embedded-signup'

type OrgData = {
  id: string
  name: string
  address: string | null
  gstin: string | null
  industry_config: string
  language_preference: string
  logo_url: string | null
}

type Lang = 'gu' | 'hi' | 'en'
const TOTAL_STEPS = 7

type CustomerRow = { name: string; phone: string; city: string }
type ProductRow = { name: string; price: string } // price in rupees (string for input)
type ReviewState = ReviewEntry & { status: 'pending' | 'confirmed' | 'rejected' }

export function OnboardingWizard({ org, ownerName }: { org: OrgData; ownerName: string }) {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const next = () => {
    setError(null)
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }
  const back = () => {
    setError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <ProgressHeader step={step} label={t('stepOf', { current: step, total: TOTAL_STEPS })} />

      <div className="mt-6 min-h-[320px]">
        {step === 1 && (
          <StepLanguage
            t={t}
            ownerName={ownerName}
            initial={(org.language_preference as Lang) ?? 'gu'}
            busy={isPending}
            onError={setError}
            startTransition={startTransition}
            router={router}
            onNext={next}
          />
        )}
        {step === 2 && (
          <StepCompany
            t={t}
            org={org}
            busy={isPending}
            onError={setError}
            startTransition={startTransition}
            onNext={next}
          />
        )}
        {step === 3 && (
          <StepCustomers
            t={t}
            busy={isPending}
            onError={setError}
            startTransition={startTransition}
            onNext={next}
          />
        )}
        {step === 4 && (
          <StepProducts
            t={t}
            industry={org.industry_config}
            busy={isPending}
            onError={setError}
            startTransition={startTransition}
            onNext={next}
          />
        )}
        {step === 5 && <StepDictionary t={t} onNext={next} />}
        {step === 6 && <StepWhatsApp t={t} onNext={next} />}
        {step === 7 && (
          <StepDone
            t={t}
            busy={isPending}
            onError={setError}
            startTransition={startTransition}
            router={router}
          />
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {step > 1 && step < 7 && (
        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <button
            type="button"
            onClick={back}
            disabled={isPending}
            className="min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {t('back')}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

type TFn = ReturnType<typeof useTranslations>

function ProgressHeader({ step, label }: { step: number; label: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function SkipButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// STEP 1 — Welcome + language
// ---------------------------------------------------------------------------

function StepLanguage({
  t,
  ownerName,
  initial,
  busy,
  onError,
  startTransition,
  router,
  onNext,
}: {
  t: TFn
  ownerName: string
  initial: Lang
  busy: boolean
  onError: (e: string | null) => void
  startTransition: React.TransitionStartFunction
  router: ReturnType<typeof useRouter>
  onNext: () => void
}) {
  const [lang, setLang] = useState<Lang>(initial)

  function choose(value: Lang) {
    setLang(value)
    onError(null)
    startTransition(async () => {
      const res = await saveLanguage(value)
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      // Re-render server components so next-intl picks up the new locale cookie.
      router.refresh()
    })
  }

  const options: Lang[] = ['gu', 'hi', 'en']

  return (
    <div>
      <h1 className="text-xl font-semibold">{t('step1.title', { name: ownerName })}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('step1.subtitle')}</p>

      <p className="mt-6 text-sm font-medium">{t('step1.languageLabel')}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            disabled={busy}
            className={`min-h-[44px] rounded-md border px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
              lang === value
                ? 'border-primary bg-primary/5 text-primary'
                : 'hover:border-primary/40'
            }`}
          >
            {t(`step1.${value}`)}
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <PrimaryButton onClick={onNext} disabled={busy}>
          {t('next')}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 2 — Company details (with logo upload)
// ---------------------------------------------------------------------------

function StepCompany({
  t,
  org,
  busy,
  onError,
  startTransition,
  onNext,
}: {
  t: TFn
  org: OrgData
  busy: boolean
  onError: (e: string | null) => void
  startTransition: React.TransitionStartFunction
  onNext: () => void
}) {
  const [form, setForm] = useState({
    name: org.name,
    address: org.address ?? '',
    gstin: org.gstin ?? '',
    industry_config: org.industry_config,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(org.logo_url)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function onField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    onError(null)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    onError(null)
  }

  async function uploadLogo(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${org.id}/logo.${ext}`
      const { error } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) {
        onError(t('step2.logoError'))
        return null
      }
      return supabase.storage.from('org-logos').getPublicUrl(path).data.publicUrl
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    onError(null)
    startTransition(async () => {
      let logo_url: string | null | undefined = undefined
      if (logoFile) {
        logo_url = await uploadLogo(logoFile)
        if (logo_url === null) return
      }
      const res = await saveCompanyDetails({
        name: form.name,
        address: form.address || null,
        gstin: form.gstin || null,
        industry_config: form.industry_config,
        ...(logo_url !== undefined ? { logo_url } : {}),
      })
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      onNext()
    })
  }

  const disabled = busy || uploading

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('step2.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step2.subtitle')}</p>

      {/* Logo */}
      <div className="mt-6 flex items-center gap-4">
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
          <p className="text-sm font-medium">{t('step2.logo')}</p>
          <p className="text-xs text-muted-foreground">{t('step2.logoHint')}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs text-primary underline-offset-2 hover:underline"
            disabled={disabled}
          >
            {t('step2.uploadLogo')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t('step2.companyName')}</label>
          <input name="name" value={form.name} onChange={onField} disabled={disabled} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t('step2.address')}</label>
          <textarea name="address" value={form.address} onChange={onField} disabled={disabled} rows={2} className="input-field resize-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('step2.gstin')}</label>
          <input name="gstin" value={form.gstin} onChange={onField} disabled={disabled} maxLength={15} className="input-field uppercase" />
          <p className="mt-0.5 text-xs text-muted-foreground">{t('step2.gstinHint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('step2.industry')}</label>
          <select name="industry_config" value={form.industry_config} onChange={onField} disabled={disabled} className="input-field">
            {INDUSTRIES.map((ind) => (
              <option key={ind.value} value={ind.value}>
                {ind.label}
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('step2.industryHint')}</p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <PrimaryButton onClick={submit} disabled={disabled || !form.name.trim()}>
          {disabled ? t('saving') : t('next')}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 3 — Customers
// ---------------------------------------------------------------------------

function StepCustomers({
  t,
  busy,
  onError,
  startTransition,
  onNext,
}: {
  t: TFn
  busy: boolean
  onError: (e: string | null) => void
  startTransition: React.TransitionStartFunction
  onNext: () => void
}) {
  const [rows, setRows] = useState<CustomerRow[]>([
    { name: '', phone: '', city: '' },
    { name: '', phone: '', city: '' },
    { name: '', phone: '', city: '' },
  ])
  const fileRef = useRef<HTMLInputElement>(null)

  function update(i: number, field: keyof CustomerRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
    onError(null)
  }

  function addRow() {
    setRows((prev) => [...prev, { name: '', phone: '', city: '' }])
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    onError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await parseContactsFile(fd)
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      const parsed = res.data.map((c) => ({ name: c.name, phone: c.phone, city: c.city }))
      if (parsed.length > 0) {
        setRows((prev) => [...prev.filter((r) => r.name.trim()), ...parsed])
      }
    })
  }

  function proceed(skip: boolean) {
    onError(null)
    const filled = rows.filter((r) => r.name.trim())
    if (skip || filled.length === 0) {
      onNext()
      return
    }
    startTransition(async () => {
      const res = await addCustomers(
        filled.map((r) => ({ name: r.name.trim(), phone: r.phone.trim(), city: r.city.trim() }))
      )
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      onNext()
    })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('step3.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step3.subtitle')}</p>

      <div className="mt-6 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              placeholder={t('step3.name')}
              value={row.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              disabled={busy}
              className="input-field"
            />
            <input
              placeholder={t('step3.phone')}
              value={row.phone}
              onChange={(e) => update(i, 'phone', e.target.value)}
              disabled={busy}
              className="input-field"
            />
            <input
              placeholder={t('step3.city')}
              value={row.city}
              onChange={(e) => update(i, 'city', e.target.value)}
              disabled={busy}
              className="input-field"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={addRow} disabled={busy} className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-50">
          + {t('step3.addRow')}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-50">
          {t('step3.importCsv')}
        </button>
        <span className="text-xs text-muted-foreground">{t('step3.importHint')}</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onFile}
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-2">
        <SkipButton onClick={() => proceed(true)} disabled={busy}>
          {t('skip')}
        </SkipButton>
        <PrimaryButton onClick={() => proceed(false)} disabled={busy}>
          {busy ? t('saving') : t('next')}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 4 — Products
// ---------------------------------------------------------------------------

function StepProducts({
  t,
  industry,
  busy,
  onError,
  startTransition,
  onNext,
}: {
  t: TFn
  industry: string
  busy: boolean
  onError: (e: string | null) => void
  startTransition: React.TransitionStartFunction
  onNext: () => void
}) {
  const templates = productTemplatesFor(industry)
  const [products, setProducts] = useState<ProductRow[]>([])

  const addedNames = new Set(products.map((p) => p.name.toLowerCase()))

  function addTemplate(name: string) {
    if (addedNames.has(name.toLowerCase())) return
    setProducts((prev) => [...prev, { name, price: '' }])
    onError(null)
  }

  function addCustom() {
    setProducts((prev) => [...prev, { name: '', price: '' }])
  }

  function update(i: number, field: keyof ProductRow, value: string) {
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
    onError(null)
  }

  function remove(i: number) {
    setProducts((prev) => prev.filter((_, idx) => idx !== i))
  }

  function proceed(skip: boolean) {
    onError(null)
    const filled = products.filter((p) => p.name.trim())
    if (skip || filled.length === 0) {
      onNext()
      return
    }
    startTransition(async () => {
      const res = await addProducts(
        filled.map((p) => {
          const rupees = parseFloat(p.price)
          const paise = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0
          return { name: p.name.trim(), unit_price_paise: paise }
        })
      )
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      onNext()
    })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('step4.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step4.subtitle')}</p>

      {templates.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium">{t('step4.templates')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {templates.map((name) => {
              const added = addedNames.has(name.toLowerCase())
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => addTemplate(name)}
                  disabled={busy || added}
                  className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-default ${
                    added ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
                  }`}
                >
                  {added ? '✓ ' : '+ '}
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {products.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              placeholder={t('step4.productName')}
              value={p.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              disabled={busy}
              className="input-field flex-1"
            />
            <input
              placeholder={t('step4.price')}
              value={p.price}
              onChange={(e) => update(i, 'price', e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              disabled={busy}
              className="input-field w-28"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={busy}
              aria-label={t('step4.remove')}
              className="min-h-[44px] px-2 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('step4.empty')}</p>
        )}
      </div>

      <button type="button" onClick={addCustom} disabled={busy} className="mt-3 text-sm text-primary underline-offset-2 hover:underline disabled:opacity-50">
        + {t('step4.addCustom')}
      </button>

      <div className="mt-8 flex items-center justify-end gap-2">
        <SkipButton onClick={() => proceed(true)} disabled={busy}>
          {t('skip')}
        </SkipButton>
        <PrimaryButton onClick={() => proceed(false)} disabled={busy}>
          {busy ? t('saving') : t('next')}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 5 — Dialect dictionary review
// ---------------------------------------------------------------------------

function StepDictionary({ t, onNext }: { t: TFn; onNext: () => void }) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<ReviewState[]>([])
  const [genError, setGenError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    ;(async () => {
      const res = await generateDictionary()
      if (!res.ok) {
        if (res.error === 'need_data') setGenError(t('step5.needData'))
        else setGenError(t('step5.generateFailed'))
        setLoading(false)
        return
      }
      setEntries(res.data.map((e) => ({ ...e, status: 'pending' as const })))
      setLoading(false)
    })()
  }, [t])

  function review(entryId: string, confirmed: boolean) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, status: confirmed ? 'confirmed' : 'rejected' } : e
      )
    )
    // Fire-and-forget; the local state already reflects the choice.
    void confirmEntry({ entryId, confirmed })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('step5.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step5.subtitle')}</p>

      <div className="mt-6 min-h-[160px]">
        {loading && <p className="text-sm text-muted-foreground">{t('step5.generating')}</p>}

        {!loading && genError && <p className="text-sm text-muted-foreground">{genError}</p>}

        {!loading && !genError && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('step5.noEntries')}</p>
        )}

        {!loading && entries.length > 0 && (
          <ul className="divide-y rounded-md border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {t('step5.weThink', { term: e.term, canonical: e.canonical })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.category === 'product' ? t('step5.product') : t('step5.customer')}
                  </p>
                </div>
                {e.status === 'pending' ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => review(e.id, true)}
                      className="min-h-[36px] rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      {t('step5.confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => review(e.id, false)}
                      className="min-h-[36px] rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      {t('step5.reject')}
                    </button>
                  </div>
                ) : (
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      e.status === 'confirmed' ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {e.status === 'confirmed' ? t('step5.confirmed') : t('step5.rejected')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex items-center justify-end gap-2">
        <SkipButton onClick={onNext}>{t('step5.reviewLater')}</SkipButton>
        <PrimaryButton onClick={onNext}>{t('next')}</PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 6 — Connect WhatsApp
// ---------------------------------------------------------------------------

function StepWhatsApp({ t, onNext }: { t: TFn; onNext: () => void }) {
  const [connected, setConnected] = useState(false)

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('step6.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('step6.subtitle')}</p>

      <div className="mt-6 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t('step6.instructions')}
      </div>

      <div className="mt-4">
        {isEmbeddedSignupConfigured ? (
          <WhatsAppEmbeddedSignup onConnected={() => setConnected(true)} />
        ) : (
          // Credentials not yet provisioned — let the owner finish onboarding and
          // connect later from Settings rather than hit a broken SDK call.
          <p className="text-xs text-muted-foreground">{t('step6.connectingSoon')}</p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-end gap-2">
        {!connected && <SkipButton onClick={onNext}>{t('step6.later')}</SkipButton>}
        <PrimaryButton onClick={onNext}>{t('next')}</PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STEP 7 — Done
// ---------------------------------------------------------------------------

function StepDone({
  t,
  busy,
  onError,
  startTransition,
  router,
}: {
  t: TFn
  busy: boolean
  onError: (e: string | null) => void
  startTransition: React.TransitionStartFunction
  router: ReturnType<typeof useRouter>
}) {
  function finish() {
    onError(null)
    startTransition(async () => {
      const res = await completeOnboarding()
      if (!res.ok) {
        onError(t('saveFailed'))
        return
      }
      router.replace('/dashboard')
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">{t('step7.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('step7.subtitle')}</p>

      <ul className="mt-6 space-y-3">
        {(['tour1', 'tour2', 'tour3'] as const).map((k) => (
          <li key={k} className="flex gap-3 text-sm">
            <span className="text-primary">●</span>
            <span>{t(`step7.${k}`)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex justify-end">
        <PrimaryButton onClick={finish} disabled={busy}>
          {busy ? t('step7.finishing') : t('step7.goToDashboard')}
        </PrimaryButton>
      </div>
    </div>
  )
}
