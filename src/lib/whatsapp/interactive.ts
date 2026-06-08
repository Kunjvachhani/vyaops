import { adminClient } from '@/lib/supabase/admin'
import { paiseToCurrency } from '@/lib/utils/currency'
import { hasAccess } from '@/config/features'
import { ALL_MENU_ITEMS } from '@/config/whatsapp-menus'
import type { Tier } from '@/lib/constants'
import type { Button, InteractiveMessage, ClarificationOption } from '@/types/whatsapp'

export type { InteractiveMessage, ClarificationOption }

// WhatsApp hard limits
const LIST_TITLE_MAX = 24
const LIST_DESC_MAX = 72
const BUTTON_TITLE_MAX = 20
const MAX_LIST_ROWS = 10

function trunc(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

// ─── 1. Main menu ─────────────────────────────────────────────────────────────

export function buildMainMenu(orgTier: Tier): InteractiveMessage {
  const rows = ALL_MENU_ITEMS.filter((item) => hasAccess(orgTier, item.featureKey))
    .slice(0, MAX_LIST_ROWS)
    .map((item) => ({
      id: item.id,
      title: trunc(item.title, LIST_TITLE_MAX),
      description: trunc(item.description, LIST_DESC_MAX),
    }))

  return {
    type: 'list',
    body: 'VyaOps — What would you like to do today?',
    sections: [{ title: 'Features', rows }],
  }
}

// ─── 2. Customer list (sorted by order frequency) ────────────────────────────

export async function buildCustomerList(orgId: string): Promise<InteractiveMessage> {
  const [{ data: orders, error: ordersErr }, { data: customers, error: custErr }] =
    await Promise.all([
      adminClient
        .from('orders')
        .select('customer_id')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      adminClient
        .from('customers')
        .select('id, name, address')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

  if (ordersErr) throw new Error(`buildCustomerList orders: ${ordersErr.message}`)
  if (custErr) throw new Error(`buildCustomerList customers: ${custErr.message}`)

  const freq = new Map<string, number>()
  for (const o of orders ?? []) {
    freq.set(o.customer_id, (freq.get(o.customer_id) ?? 0) + 1)
  }

  const rows = (customers ?? [])
    .sort((a, b) => {
      const diff = (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'hi')
    })
    .slice(0, MAX_LIST_ROWS)
    .map((c) => ({
      id: c.id,
      title: trunc(c.name, LIST_TITLE_MAX),
      description: c.address ? trunc(c.address, LIST_DESC_MAX) : undefined,
    }))

  return {
    type: 'list',
    body: 'Select a customer:',
    sections: [{ title: 'Customers', rows }],
  }
}

// ─── 3. Product list (sorted by order frequency, optionally per customer) ─────

export async function buildProductList(
  orgId: string,
  customerId?: string
): Promise<InteractiveMessage> {
  const ordersQuery = customerId !== undefined
    ? adminClient
        .from('orders')
        .select('product_id')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('customer_id', customerId)
    : adminClient
        .from('orders')
        .select('product_id')
        .eq('organization_id', orgId)
        .is('deleted_at', null)

  const [{ data: orders, error: ordersErr }, { data: products, error: prodErr }] =
    await Promise.all([
      ordersQuery,
      adminClient
        .from('products')
        .select('id, name, unit_price_paise, unit')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

  if (ordersErr) throw new Error(`buildProductList orders: ${ordersErr.message}`)
  if (prodErr) throw new Error(`buildProductList products: ${prodErr.message}`)

  const freq = new Map<string, number>()
  for (const o of orders ?? []) {
    freq.set(o.product_id, (freq.get(o.product_id) ?? 0) + 1)
  }

  const rows = (products ?? [])
    .sort((a, b) => {
      const diff = (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'hi')
    })
    .slice(0, MAX_LIST_ROWS)
    .map((p) => ({
      id: p.id,
      title: trunc(p.name, LIST_TITLE_MAX),
      description: trunc(`${paiseToCurrency(p.unit_price_paise)} / ${p.unit}`, LIST_DESC_MAX),
    }))

  const body = customerId !== undefined
    ? 'Select a product (top picks for this customer):'
    : 'Select a product:'

  return {
    type: 'list',
    body,
    sections: [{ title: 'Products', rows }],
  }
}

// ─── 4. Vendor list (alphabetical) ───────────────────────────────────────────

export async function buildVendorList(orgId: string): Promise<InteractiveMessage> {
  const { data: vendors, error } = await adminClient
    .from('vendors')
    .select('id, name, address')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(MAX_LIST_ROWS)

  if (error) throw new Error(`buildVendorList: ${error.message}`)

  const rows = (vendors ?? []).map((v) => ({
    id: v.id,
    title: trunc(v.name, LIST_TITLE_MAX),
    description: v.address ? trunc(v.address, LIST_DESC_MAX) : undefined,
  }))

  return {
    type: 'list',
    body: 'Select a vendor:',
    sections: [{ title: 'Vendors', rows }],
  }
}

// ─── 5. Confirmation ──────────────────────────────────────────────────────────

export function buildConfirmation(
  type: string,
  data: Record<string, unknown>
): InteractiveMessage {
  return {
    type: 'button',
    body: formatConfirmationBody(type, data),
    buttons: [
      { id: `confirm_${type}`, title: '✅ Confirm' },
      { id: `edit_${type}`, title: '✏️ Edit' },
      { id: `cancel_${type}`, title: '❌ Cancel' },
    ],
  }
}

function formatConfirmationBody(type: string, data: Record<string, unknown>): string {
  if (type === 'order') {
    const customer = (data.customer as string | undefined) ?? 'Unknown'
    const product = (data.product as string | undefined) ?? 'Unknown'
    const quantity = (data.quantity as number | undefined) ?? 0
    const unit = (data.unit as string | undefined) ?? 'pcs'
    const amountPaise = (data.amount_paise as number | undefined) ?? 0
    return [
      '📋 New Order:',
      '',
      `Customer: ${customer}`,
      `Product: ${product}`,
      `Quantity: ${quantity} ${unit}`,
      `Amount: ${paiseToCurrency(amountPaise)}`,
    ].join('\n')
  }

  if (type === 'invoice') {
    const customer = (data.customer as string | undefined) ?? 'Unknown'
    const amountPaise = (data.amount_paise as number | undefined) ?? 0
    const dueDate = (data.due_date as string | undefined) ?? ''
    return [
      '🧾 New Invoice:',
      '',
      `Customer: ${customer}`,
      `Amount: ${paiseToCurrency(amountPaise)}`,
      ...(dueDate ? [`Due Date: ${dueDate}`] : []),
    ].join('\n')
  }

  // Generic fallback: render all key-value pairs
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const lines = [`📋 ${label}:`, '']
  for (const [key, value] of Object.entries(data)) {
    const k = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    lines.push(`${k}: ${String(value ?? '')}`)
  }
  return lines.join('\n')
}

// ─── 6. Clarification ("Did you mean?") ──────────────────────────────────────

export function buildClarification(options: ClarificationOption[]): InteractiveMessage {
  const top = options.slice(0, 3)

  const buttons: Button[] = top.map((opt) => ({
    id: opt.id,
    title: trunc(opt.label, BUTTON_TITLE_MAX),
  }))

  // Fill remaining slot (up to 3) with "Type again"
  if (buttons.length < 3) {
    buttons.push({ id: 'clarify_retype', title: '↩️ Type again' })
  }

  const optionLines = top
    .map((opt, i) => {
      const suffix = opt.description ? `, ${opt.description}` : ''
      return `${i + 1}) ${opt.label}${suffix}`
    })
    .join('\n')

  return {
    type: 'button',
    body: `Did you mean?\n\n${optionLines}`,
    buttons,
  }
}
