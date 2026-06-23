import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type AsList<T> = T[] | null

type OrderForPlan = {
  organization_id: string
  order_number: string
  quantity: number
  quantity_produced: number
  products: { name: string } | null
}

// Today's date in IST as YYYY-MM-DD
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// Human label e.g. "23 Jun 2026" (IST)
function dateLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// GET /api/production/morning-plan
// Internal-only (n8n morning-production-plan workflow). For each eligible org,
// returns today's in-production orders formatted as a list for the
// `morning_production_plan` Meta template. Orgs with no owner phone or no active
// production orders are excluded. Tier gating: tier_1+ (all orgs).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const today = istToday()

  const [orgsRes, ownersRes, ordersRes] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id, language_preference, whatsapp_proactive_enabled')
      .eq('whatsapp_proactive_enabled', true)
      .is('deleted_at', null),
    adminClient
      .from('users')
      .select('organization_id, phone')
      .eq('role', 'owner')
      .eq('is_active', true)
      .is('deleted_at', null),
    adminClient
      .from('orders')
      .select('organization_id, order_number, quantity, quantity_produced, products(name)')
      .eq('status', 'in_production')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])

  const firstError = orgsRes.error || ownersRes.error || ordersRes.error
  if (firstError) {
    captureWithContext(firstError, { action: 'GET /api/production/morning-plan' })
    return NextResponse.json(
      { error: 'Failed to build morning production plans', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const orgs =
    (orgsRes.data as unknown as AsList<Pick<OrganizationRow, 'id' | 'language_preference'>>) ?? []
  const owners =
    (ownersRes.data as unknown as AsList<Pick<UserRow, 'organization_id' | 'phone'>>) ?? []
  const orders = (ordersRes.data as unknown as AsList<OrderForPlan>) ?? []

  const ownerPhone = new Map<string, string>()
  for (const o of owners) {
    const phone = o.phone?.trim()
    if (phone && !ownerPhone.has(o.organization_id)) ownerPhone.set(o.organization_id, phone)
  }

  const ordersByOrg = new Map<string, OrderForPlan[]>()
  for (const order of orders) {
    const list = ordersByOrg.get(order.organization_id) ?? []
    list.push(order)
    ordersByOrg.set(order.organization_id, list)
  }

  let skippedNoOwner = 0
  let skippedNoData = 0

  const summaries = orgs
    .map((org) => {
      const phone = ownerPhone.get(org.id)
      if (!phone) {
        skippedNoOwner += 1
        return null
      }

      const orgOrders = ordersByOrg.get(org.id) ?? []
      if (orgOrders.length === 0) {
        skippedNoData += 1
        return null
      }

      const locale: 'en' | 'gu' | 'hi' =
        org.language_preference === 'gu' || org.language_preference === 'hi'
          ? org.language_preference
          : 'en'

      // Show up to 5 orders; append a count for any hidden ones
      const visible = orgOrders.slice(0, 5)
      const overflow = orgOrders.length - visible.length
      const lines = visible.map((o) => {
        const productName = o.products?.name ?? 'Unknown'
        const remaining = Math.max(0, o.quantity - (o.quantity_produced ?? 0))
        return `• ${productName} — ${remaining} pcs (${o.order_number})`
      })
      if (overflow > 0) lines.push(`  ...and ${overflow} more`)

      return {
        organization_id: org.id,
        owner_phone: phone,
        language_preference: locale,
        has_data: true,
        date_label: dateLabel(today),
        order_count: String(orgOrders.length),
        orders_formatted: lines.join('\n'),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({
    summaries,
    meta: {
      as_of: today,
      total_orgs: orgs.length,
      eligible: summaries.length,
      skipped_no_owner: skippedNoOwner,
      skipped_no_data: skippedNoData,
    },
  })
}
