import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { matchCustomer, matchProduct } from '@/lib/utils/fuzzy-match'
import type { Database } from '@/types/database'

// Builds a targeted clarification WhatsApp message based on what went wrong
// in the eval gate. Returns a ready-to-send payload for /api/whatsapp/send.
//
// Priority: missing/ambiguous customer > missing/ambiguous product > missing quantity > generic

type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

const EntitySchema = z.object({
  type: z.string(),
  rawValue: z.string(),
  normalizedValue: z.string().optional(),
  confidence: z.number(),
})

const RequestSchema = z.object({
  orgId: z.string().uuid(),
  sender: z.string().min(5),
  failureCodes: z.array(z.string()).default([]),
  entities: z.array(EntitySchema).default([]),
  intent: z.string().optional(),
})

type TextPayload = { to: string; type: 'text'; text: { body: string } }
type InteractivePayload = { to: string; type: 'interactive'; interactive: Record<string, unknown> }
type WASendPayload = TextPayload | InteractivePayload

function customerListMessage(
  sender: string,
  customers: CustomerRow[],
  rawName?: string
): WASendPayload {
  const bodyText = rawName
    ? `I couldn't find "${rawName}". Which customer did you mean?`
    : 'Which customer is this order for?'

  const rows = customers.slice(0, 10).map((c) => ({
    id: `customer_${c.id}`,
    title: c.name.slice(0, 24),
    ...(c.company_name ? { description: c.company_name.slice(0, 72) } : {}),
  }))

  return {
    to: sender,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Select Customer' },
      body: { text: bodyText },
      footer: { text: 'Tap to select the correct customer' },
      action: {
        button: 'Choose Customer',
        sections: [{ title: 'Customers', rows }],
      },
    },
  }
}

function productListMessage(
  sender: string,
  products: ProductRow[],
  rawName?: string
): WASendPayload {
  const bodyText = rawName
    ? `I couldn't find "${rawName}". Which product did you mean?`
    : 'Which product is this order for?'

  const rows = products.slice(0, 10).map((p) => ({
    id: `product_${p.id}`,
    title: p.name.slice(0, 24),
    description: p.unit.slice(0, 72),
  }))

  return {
    to: sender,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Select Product' },
      body: { text: bodyText },
      footer: { text: 'Tap to select the correct product' },
      action: {
        button: 'Choose Product',
        sections: [{ title: 'Products', rows }],
      },
    },
  }
}

function customerButtonsMessage(
  sender: string,
  alternatives: CustomerRow[],
  rawName: string
): WASendPayload {
  const buttons = alternatives.slice(0, 3).map((c) => ({
    type: 'reply' as const,
    reply: { id: `customer_${c.id}`, title: c.name.slice(0, 20) },
  }))

  return {
    to: sender,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: `Did you mean one of these for "${rawName}"?` },
      action: { buttons },
    },
  }
}

function productButtonsMessage(
  sender: string,
  alternatives: ProductRow[],
  rawName: string
): WASendPayload {
  const buttons = alternatives.slice(0, 3).map((p) => ({
    type: 'reply' as const,
    reply: { id: `product_${p.id}`, title: p.name.slice(0, 20) },
  }))

  return {
    to: sender,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: `Which product did you mean for "${rawName}"?` },
      action: { buttons },
    },
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { orgId, sender, failureCodes, entities } = parsed.data

  const hasMissingCustomer = failureCodes.includes('MISSING_CUSTOMER')
  const hasMissingProduct = failureCodes.includes('MISSING_PRODUCT')
  const hasUnresolvable = failureCodes.includes('UNRESOLVABLE_NAME')
  const hasMissingQty = failureCodes.includes('MISSING_QUANTITY') || failureCodes.includes('BAD_QUANTITY')

  const customerEntity = entities.find((e) => e.type === 'customer_name')
  const productEntity = entities.find((e) => e.type === 'product_name')

  // Customer is unresolved if: explicitly missing, or UNRESOLVABLE_NAME and no normalizedValue
  const customerUnresolved =
    hasMissingCustomer || (hasUnresolvable && customerEntity && !customerEntity.normalizedValue)
  // Product is unresolved only if customer is already resolved
  const productUnresolved =
    !customerUnresolved &&
    (hasMissingProduct || (hasUnresolvable && productEntity && !productEntity.normalizedValue))

  let message: WASendPayload

  try {
    if (customerUnresolved) {
      if (hasUnresolvable && customerEntity) {
        const matchResult = await matchCustomer(orgId, customerEntity.rawValue)
        if (matchResult.alternatives.length > 0) {
          message = customerButtonsMessage(sender, matchResult.alternatives, customerEntity.rawValue)
        } else {
          const { data } = await adminClient
            .from('customers')
            .select('*')
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .order('name', { ascending: true })
            .limit(10)
          message = customerListMessage(
            sender,
            (data ?? []) as CustomerRow[],
            customerEntity.rawValue
          )
        }
      } else {
        const { data } = await adminClient
          .from('customers')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .limit(10)
        message = customerListMessage(sender, (data ?? []) as CustomerRow[])
      }
    } else if (productUnresolved) {
      if (hasUnresolvable && productEntity) {
        const matchResult = await matchProduct(orgId, productEntity.rawValue)
        if (matchResult.alternatives.length > 0) {
          message = productButtonsMessage(sender, matchResult.alternatives, productEntity.rawValue)
        } else {
          const { data } = await adminClient
            .from('products')
            .select('*')
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .order('name', { ascending: true })
            .limit(10)
          message = productListMessage(
            sender,
            (data ?? []) as ProductRow[],
            productEntity.rawValue
          )
        }
      } else {
        const { data } = await adminClient
          .from('products')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .limit(10)
        message = productListMessage(sender, (data ?? []) as ProductRow[])
      }
    } else if (hasMissingQty) {
      const productLabel =
        productEntity?.normalizedValue ?? productEntity?.rawValue ?? 'the product'
      message = {
        to: sender,
        type: 'text',
        text: { body: `How many ${productLabel} would you like to order?` },
      }
    } else {
      message = {
        to: sender,
        type: 'text',
        text: {
          body: 'Could you please clarify your order? Mention the customer name, product, and quantity.',
        },
      }
    }
  } catch (err) {
    console.error('[ai/clarify] error building clarification:', err instanceof Error ? err.message : String(err))
    message = {
      to: sender,
      type: 'text',
      text: {
        body: 'Could you clarify your order? Please mention the customer, product, and quantity.',
      },
    }
  }

  return NextResponse.json({ message })
}
