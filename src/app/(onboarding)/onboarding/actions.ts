'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { isIndustryValue } from '@/config/industries'
import { toCanonicalIndianMobile } from '@/lib/utils/phone'
import { finalizeEmbeddedSignup } from '@/lib/whatsapp/dualhook'
import {
  generateOnboardingDictionary,
  saveOnboardingDictionary,
  confirmOnboardingEntry,
} from '@/lib/ai/dialect-learner'
import type { ParsedContact } from '@/lib/utils/contact-import'
import type { OnboardingDictResult } from '@/types/ai'

// ---------------------------------------------------------------------------
// Shared result type (mirrors settings/actions.ts)
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

async function requireOwner() {
  const user = await getCurrentUser()
  if (!user) return { user: null, error: 'unauthorized' }
  if (user.role !== 'owner') return { user: null, error: 'forbidden' }
  return { user, error: '' }
}

// ---------------------------------------------------------------------------
// STEP 1 — Language preference (also drives the i18n cookie)
// ---------------------------------------------------------------------------

const LANGS = ['gu', 'hi', 'en'] as const

export async function saveLanguage(locale: string): Promise<ActionResult> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = z.enum(LANGS).safeParse(locale)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const cookieStore = await cookies()
  cookieStore.set('locale', parsed.data, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({ language_preference: parsed.data })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, { action: 'onboarding/saveLanguage', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// STEP 2 — Company details
// ---------------------------------------------------------------------------

const CompanySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable(),
  gstin: z.string().max(15).nullable(),
  industry_config: z.string().refine(isIndustryValue, 'invalid_industry'),
  logo_url: z.string().url().nullable().optional(),
})

export async function saveCompanyDetails(raw: unknown): Promise<ActionResult> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = CompanySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      gstin: parsed.data.gstin,
      industry_config: parsed.data.industry_config,
      ...(parsed.data.logo_url !== undefined ? { logo_url: parsed.data.logo_url } : {}),
    })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, { action: 'onboarding/saveCompanyDetails', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'organization',
    entity_id: user.org_id,
    changes: [{ field: 'onboarding_company', old_value: null, new_value: parsed.data.name }],
    source: 'web',
  })

  revalidatePath('/onboarding')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// STEP 3 — Customers
// ---------------------------------------------------------------------------

export type CreatedEntity = { id: string; name: string }

const CustomersSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(255),
      // Lenient on input (imports carry messy phones); canonicalized at save —
      // invalid numbers are stored as null rather than failing the whole batch.
      phone: z.string().max(20).optional(),
      city: z.string().max(100).optional(),
    })
  )
  .min(1)
  .max(50)

export async function addCustomers(raw: unknown): Promise<ActionResult<CreatedEntity[]>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = CustomersSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const rows = parsed.data.map((c) => ({
    organization_id: user.org_id,
    name: c.name.trim(),
    phone: toCanonicalIndianMobile(c.phone),
    city: c.city?.trim() || null,
    state: 'Gujarat',
  }))

  const { data, error: insertError } = await adminClient
    .from('customers')
    .insert(rows)
    .select('id, name')

  if (insertError || !data) {
    captureWithContext(insertError ?? new Error('customer insert returned null'), {
      action: 'onboarding/addCustomers',
      org_id: user.org_id,
    })
    return { ok: false, error: 'insert_failed' }
  }

  const created = data as CreatedEntity[]
  for (const c of created) {
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'create',
      entity_type: 'customer',
      entity_id: c.id,
      changes: [{ field: 'name', old_value: null, new_value: c.name }],
      source: 'web',
    })
  }

  return { ok: true, data: created }
}

// ---------------------------------------------------------------------------
// STEP 4 — Products
// ---------------------------------------------------------------------------

const ProductsSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(255),
      unit_price_paise: z.number().int().min(0).max(1_000_000_000),
    })
  )
  .min(1)
  .max(50)

export async function addProducts(raw: unknown): Promise<ActionResult<CreatedEntity[]>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = ProductsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const rows = parsed.data.map((p) => ({
    organization_id: user.org_id,
    name: p.name.trim(),
    unit_price_paise: p.unit_price_paise,
  }))

  const { data, error: insertError } = await adminClient
    .from('products')
    .insert(rows)
    .select('id, name')

  if (insertError || !data) {
    captureWithContext(insertError ?? new Error('product insert returned null'), {
      action: 'onboarding/addProducts',
      org_id: user.org_id,
    })
    return { ok: false, error: 'insert_failed' }
  }

  const created = data as CreatedEntity[]
  for (const p of created) {
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'create',
      entity_type: 'product',
      entity_id: p.id,
      changes: [{ field: 'name', old_value: null, new_value: p.name }],
      source: 'web',
    })
  }

  return { ok: true, data: created }
}

// ---------------------------------------------------------------------------
// STEP 5 — Dialect dictionary generation + review
// ---------------------------------------------------------------------------

export type ReviewEntry = {
  id: string
  term: string
  canonical: string
  category: string
}

// Deterministic alias guesses used when the AI is unavailable. e.g.
// "Valve Body" → ["valve body", "valvebody", "vb", "valve"].
function heuristicAliases(name: string): string[] {
  const lower = name.trim().toLowerCase()
  if (!lower) return []
  const words = lower.split(/\s+/).filter(Boolean)
  const out = new Set<string>([lower])
  if (words.length > 1) {
    out.add(words.join(''))
    out.add(words.map((w) => w[0]).join(''))
    out.add(words[0])
  }
  return [...out].filter((a) => a.length >= 2)
}

function buildHeuristicDict(
  products: CreatedEntity[],
  customers: CreatedEntity[]
): OnboardingDictResult {
  return {
    products: products
      .map((p) => ({ name: p.name, aliases: heuristicAliases(p.name) }))
      .filter((x) => x.aliases.length > 0),
    customers: customers
      .map((c) => ({ name: c.name, aliases: heuristicAliases(c.name) }))
      .filter((x) => x.aliases.length > 0),
  }
}

export async function generateDictionary(): Promise<
  ActionResult<ReviewEntry[]> | { ok: false; error: 'need_data' }
> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const { data: org } = await adminClient
    .from('organizations')
    .select('industry_config, language_preference')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!org) return { ok: false, error: 'not_found' }

  const [{ data: products }, { data: customers }] = await Promise.all([
    adminClient
      .from('products')
      .select('id, name')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .limit(100),
    adminClient
      .from('customers')
      .select('id, name')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .limit(100),
  ])

  const productList = (products ?? []) as CreatedEntity[]
  const customerList = (customers ?? []) as CreatedEntity[]

  if (productList.length === 0 && customerList.length === 0) {
    return { ok: false, error: 'need_data' }
  }

  try {
    const result = await generateOnboardingDictionary({
      orgId: user.org_id,
      industrySegment: org.industry_config,
      languagePreference: org.language_preference,
      products: productList.map((p) => ({ id: p.id, name: p.name })),
      customers: customerList.map((c) => ({ id: c.id, name: c.name })),
    })

    const productIdMap = new Map(productList.map((p) => [p.name, p.id]))
    const customerIdMap = new Map(customerList.map((c) => [c.name, c.id]))

    // The AI returns nothing when the model is unreachable/misconfigured or
    // declines. Fall back to deterministic heuristic aliases so the review step
    // is never empty when products/customers exist.
    const aiAliasCount =
      result.products.reduce((n, p) => n + p.aliases.length, 0) +
      result.customers.reduce((n, c) => n + c.aliases.length, 0)
    const dict = aiAliasCount > 0 ? result : buildHeuristicDict(productList, customerList)

    await saveOnboardingDictionary(user.org_id, dict, productIdMap, customerIdMap)
  } catch (e) {
    captureWithContext(e, { action: 'onboarding/generateDictionary', org_id: user.org_id })
    return { ok: false, error: 'generate_failed' }
  }

  // Pull back the freshly-saved, not-yet-reviewed entries (source = 'onboarding_ai').
  const { data: entries, error: readError } = await adminClient
    .from('org_dictionary')
    .select('id, term, canonical, category')
    .eq('organization_id', user.org_id)
    .eq('source', 'onboarding_ai')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('term', { ascending: true })
    .limit(200)

  if (readError) {
    captureWithContext(readError, { action: 'onboarding/generateDictionary/read', org_id: user.org_id })
    return { ok: false, error: 'read_failed' }
  }

  return { ok: true, data: (entries ?? []) as ReviewEntry[] }
}

const ConfirmSchema = z.object({
  entryId: z.string().uuid(),
  confirmed: z.boolean(),
})

export async function confirmEntry(raw: unknown): Promise<ActionResult> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = ConfirmSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  try {
    await confirmOnboardingEntry(user.org_id, parsed.data.entryId, parsed.data.confirmed)
  } catch (e) {
    captureWithContext(e, { action: 'onboarding/confirmEntry', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// STEP 3 — Contact-file import (CSV / XLSX / PDF) → parsed rows for review
// ---------------------------------------------------------------------------

const MAX_IMPORT_BYTES = 5 * 1024 * 1024 // 5 MB

export async function parseContactsFile(
  formData: FormData
): Promise<ActionResult<ParsedContact[]>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no_file' }
  if (file.size === 0) return { ok: false, error: 'empty_file' }
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: 'file_too_large' }

  try {
    const buffer = await file.arrayBuffer()
    // Heavy parser deps (exceljs / pdf-parse) are loaded lazily so they never
    // touch the other, lighter onboarding actions.
    const { parseContacts } = await import('@/lib/utils/contact-import')
    const contacts = await parseContacts(file.name, file.type, buffer)
    return { ok: true, data: contacts }
  } catch (e) {
    captureWithContext(e, { action: 'onboarding/parseContactsFile', org_id: user.org_id })
    return { ok: false, error: 'parse_failed' }
  }
}

// ---------------------------------------------------------------------------
// STEP 6 — Connect WhatsApp (Dualhook Embedded Signup finalize)
// ---------------------------------------------------------------------------

const ConnectSchema = z.object({
  code: z.string().min(1).max(2000),
  phoneNumberId: z.string().min(1).max(64),
  wabaId: z.string().max(64).nullable().optional(),
  displayPhoneNumber: z.string().max(32).nullable().optional(),
})

export async function connectWhatsApp(
  raw: unknown
): Promise<ActionResult<{ displayPhoneNumber: string | null }>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = ConnectSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  if (!process.env.DUALHOOK_API_KEY) return { ok: false, error: 'not_configured' }

  let result
  try {
    result = await finalizeEmbeddedSignup({
      code: parsed.data.code,
      phoneNumberId: parsed.data.phoneNumberId,
      wabaId: parsed.data.wabaId ?? null,
    })
  } catch {
    // finalizeEmbeddedSignup already reported to Sentry with context.
    return { ok: false, error: 'connect_failed' }
  }

  const display = result.displayPhoneNumber ?? parsed.data.displayPhoneNumber ?? null

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({
      whatsapp_phone_number_id: result.phoneNumberId,
      whatsapp_display_number: display,
      whatsapp_phone: display,
      whatsapp_connected: true,
    })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, { action: 'onboarding/connectWhatsApp', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  // Audit the connection flag only — never the phone number (security rule #8).
  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'organization',
    entity_id: user.org_id,
    changes: [{ field: 'whatsapp_connected', old_value: false, new_value: true }],
    source: 'web',
  })

  return { ok: true, data: { displayPhoneNumber: display } }
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

const VendorsSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(255),
      phone: z.string().max(20).optional(),
      material: z.string().max(255).optional(),
    })
  )
  .min(1)
  .max(50)

export async function addVendors(raw: unknown): Promise<ActionResult<CreatedEntity[]>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = VendorsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const rows = parsed.data.map((v) => ({
    organization_id: user.org_id,
    name: v.name.trim(),
    phone: toCanonicalIndianMobile(v.phone),
    materials_supplied: v.material?.trim() ? [v.material.trim()] : [],
  }))

  const { data, error: insertError } = await adminClient
    .from('vendors')
    .insert(rows)
    .select('id, name')

  if (insertError || !data) {
    captureWithContext(insertError ?? new Error('vendor insert returned null'), {
      action: 'onboarding/addVendors',
      org_id: user.org_id,
    })
    return { ok: false, error: 'insert_failed' }
  }

  const created = data as CreatedEntity[]
  for (const v of created) {
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'create',
      entity_type: 'vendor',
      entity_id: v.id,
      changes: [{ field: 'name', old_value: null, new_value: v.name }],
      source: 'web',
    })
  }

  return { ok: true, data: created }
}

// ---------------------------------------------------------------------------
// Entity lister — customers + products for the open-orders / open-invoices steps
// ---------------------------------------------------------------------------

export type OnboardingEntities = {
  customers: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; unit_price_paise: number }>
}

export async function listOnboardingEntities(): Promise<ActionResult<OnboardingEntities>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const [{ data: customers }, { data: products }] = await Promise.all([
    adminClient
      .from('customers')
      .select('id, name')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .order('name')
      .limit(200),
    adminClient
      .from('products')
      .select('id, name, unit_price_paise')
      .eq('organization_id', user.org_id)
      .is('deleted_at', null)
      .order('name')
      .limit(200),
  ])

  return {
    ok: true,
    data: {
      customers: (customers ?? []) as OnboardingEntities['customers'],
      products: (products ?? []) as OnboardingEntities['products'],
    },
  }
}

// Generate ORD-/INV- numbers via the existing DB sequence functions.
type NumberRpc = (
  fn: 'generate_order_number' | 'generate_invoice_number'
) => Promise<{ data: string | null; error: { message: string } | null }>

// ---------------------------------------------------------------------------
// Open orders
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const OrdersSchema = z
  .array(
    z.object({
      customerId: z.string().uuid(),
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(1_000_000),
      unitPricePaise: z.number().int().min(0).max(1_000_000_000),
      deliveryDate: z.string().regex(ISO_DATE).optional().or(z.literal('')),
    })
  )
  .min(1)
  .max(50)

export async function addOrders(raw: unknown): Promise<ActionResult<{ count: number }>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = OrdersSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  // Verify every referenced customer/product belongs to this org (adminClient
  // bypasses RLS, so ownership must be checked explicitly).
  const [{ data: custs }, { data: prods }] = await Promise.all([
    adminClient.from('customers').select('id').eq('organization_id', user.org_id).is('deleted_at', null),
    adminClient.from('products').select('id').eq('organization_id', user.org_id).is('deleted_at', null),
  ])
  const validCust = new Set((custs ?? []).map((c) => (c as { id: string }).id))
  const validProd = new Set((prods ?? []).map((p) => (p as { id: string }).id))

  let count = 0
  for (const o of parsed.data) {
    if (!validCust.has(o.customerId) || !validProd.has(o.productId)) continue

    const { data: num, error: seqErr } = await (adminClient.rpc as unknown as NumberRpc)(
      'generate_order_number'
    )
    if (seqErr || !num) {
      captureWithContext(seqErr ?? new Error('generate_order_number null'), {
        action: 'onboarding/addOrders/seq',
        org_id: user.org_id,
      })
      continue
    }

    const total = o.quantity * o.unitPricePaise
    const { data: created, error: insertError } = await adminClient
      .from('orders')
      .insert({
        organization_id: user.org_id,
        order_number: num,
        customer_id: o.customerId,
        product_id: o.productId,
        quantity: o.quantity,
        unit_price_paise: o.unitPricePaise,
        total_amount_paise: total,
        status: 'confirmed',
        source: 'manual',
        delivery_date: o.deliveryDate ? o.deliveryDate : null,
      })
      .select('id, order_number')
      .single()

    if (insertError || !created) {
      captureWithContext(insertError ?? new Error('order insert null'), {
        action: 'onboarding/addOrders',
        org_id: user.org_id,
      })
      continue
    }

    count++
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'create',
      entity_type: 'order',
      entity_id: (created as { id: string }).id,
      changes: [
        { field: 'order_number', old_value: null, new_value: (created as { order_number: string }).order_number },
      ],
      source: 'web',
    })
  }

  return { ok: true, data: { count } }
}

// ---------------------------------------------------------------------------
// Open invoices
// ---------------------------------------------------------------------------

const InvoicesSchema = z
  .array(
    z.object({
      customerId: z.string().uuid(),
      totalPaise: z.number().int().positive().max(1_000_000_000_000),
      dueDate: z.string().regex(ISO_DATE),
    })
  )
  .min(1)
  .max(50)

export async function addInvoices(raw: unknown): Promise<ActionResult<{ count: number }>> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const parsed = InvoicesSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { data: custs } = await adminClient
    .from('customers')
    .select('id')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
  const validCust = new Set((custs ?? []).map((c) => (c as { id: string }).id))

  let count = 0
  for (const inv of parsed.data) {
    if (!validCust.has(inv.customerId)) continue

    const { data: num, error: seqErr } = await (adminClient.rpc as unknown as NumberRpc)(
      'generate_invoice_number'
    )
    if (seqErr || !num) {
      captureWithContext(seqErr ?? new Error('generate_invoice_number null'), {
        action: 'onboarding/addInvoices/seq',
        org_id: user.org_id,
      })
      continue
    }

    // Onboarding captures the outstanding total only — no tax breakdown.
    const { data: created, error: insertError } = await adminClient
      .from('invoices')
      .insert({
        organization_id: user.org_id,
        invoice_number: num,
        customer_id: inv.customerId,
        subtotal_paise: inv.totalPaise,
        tax_rate: 0,
        tax_amount_paise: 0,
        total_amount_paise: inv.totalPaise,
        status: 'sent',
        due_date: inv.dueDate,
      })
      .select('id, invoice_number')
      .single()

    if (insertError || !created) {
      captureWithContext(insertError ?? new Error('invoice insert null'), {
        action: 'onboarding/addInvoices',
        org_id: user.org_id,
      })
      continue
    }

    count++
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'create',
      entity_type: 'invoice',
      entity_id: (created as { id: string }).id,
      changes: [
        { field: 'invoice_number', old_value: null, new_value: (created as { invoice_number: string }).invoice_number },
      ],
      source: 'web',
    })
  }

  return { ok: true, data: { count } }
}

// ---------------------------------------------------------------------------
// STEP 7 — Complete onboarding
// ---------------------------------------------------------------------------

export async function completeOnboarding(): Promise<ActionResult> {
  const { user, error } = await requireOwner()
  if (!user) return { ok: false, error }

  const now = new Date().toISOString()

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({ onboarding_status: 'complete', onboarded_at: now })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, { action: 'onboarding/completeOnboarding', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'organization',
    entity_id: user.org_id,
    changes: [{ field: 'onboarding_status', old_value: 'pending', new_value: 'complete' }],
    source: 'web',
  })

  revalidatePath('/dashboard')
  return { ok: true }
}
