import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type InventoryRow = Database['public']['Tables']['inventory']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

type AsList<T> = T[] | null

// GET /api/inventory/low-stock-alert
// Internal-only (n8n low-stock-alert workflow). Returns inventory items below
// their reorder_level across all tier_2+ orgs with proactive WhatsApp enabled.
//
// Deduplication: before returning, this route checks audit_log for a
// LOW_STOCK_ALERT_SENT entry for each candidate item in the last 24 hours. Items
// that were already alerted are dropped. The remaining items are written to
// audit_log (action = 'LOW_STOCK_ALERT_SENT') atomically before the response,
// so the next 6-hour run skips them automatically even if n8n fails mid-send.
//
// Feature gate: inventory is tier_2+. Orgs on tier_1 are excluded.
// days_supply is computed as floor(current_quantity / avg_daily_consumption)
// when avg_daily_consumption > 0; otherwise sent as "?" so the template still
// renders meaningfully.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [orgsRes, ownersRes, inventoryRes] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id, language_preference, whatsapp_proactive_enabled, tier')
      .eq('whatsapp_proactive_enabled', true)
      .in('tier', ['tier_2', 'tier_3'])
      .is('deleted_at', null),
    adminClient
      .from('users')
      .select('organization_id, phone')
      .eq('role', 'owner')
      .eq('is_active', true)
      .is('deleted_at', null),
    // Fetch all tracked inventory items (reorder_level > 0) — JS filters for
    // current_quantity <= reorder_level because Supabase JS client does not
    // support column-to-column comparisons.
    adminClient
      .from('inventory')
      .select('id, organization_id, item_name, current_quantity, unit, reorder_level, avg_daily_consumption')
      .is('deleted_at', null)
      .gt('reorder_level', 0),
  ])

  const firstError = orgsRes.error || ownersRes.error || inventoryRes.error
  if (firstError) {
    captureWithContext(firstError, { action: 'GET /api/inventory/low-stock-alert' })
    return NextResponse.json(
      { error: 'Failed to fetch low-stock candidates', code: 'DB_ERROR' },
      { status: 500 },
    )
  }

  type OrgFields = Pick<OrganizationRow, 'id' | 'language_preference'>
  type UserFields = Pick<UserRow, 'organization_id' | 'phone'>
  type InvFields = Pick<
    InventoryRow,
    'id' | 'organization_id' | 'item_name' | 'current_quantity' | 'unit' | 'reorder_level' | 'avg_daily_consumption'
  >

  const eligibleOrgIds = new Set((orgsRes.data as unknown as AsList<OrgFields> ?? []).map((o) => o.id))
  const orgMeta = new Map<string, Pick<OrganizationRow, 'language_preference'>>(
    (orgsRes.data as unknown as AsList<OrgFields> ?? []).map((o) => [o.id, { language_preference: o.language_preference }]),
  )

  const ownerPhone = new Map<string, string>()
  for (const u of (ownersRes.data as unknown as AsList<UserFields> ?? [])) {
    const phone = u.phone?.trim()
    if (phone && !ownerPhone.has(u.organization_id)) ownerPhone.set(u.organization_id, phone)
  }

  // Filter: eligible org + phone present + actually below reorder level.
  const candidates = (inventoryRes.data as unknown as AsList<InvFields> ?? []).filter(
    (item) =>
      eligibleOrgIds.has(item.organization_id) &&
      ownerPhone.has(item.organization_id) &&
      item.current_quantity <= item.reorder_level,
  )

  if (candidates.length === 0) {
    return NextResponse.json({ alerts: [], meta: { total_orgs_checked: eligibleOrgIds.size, alerts_issued: 0, skippedDedup: 0 } })
  }

  // Deduplication: skip items already alerted in the last 24 hours.
  const candidateIds = candidates.map((c) => c.id)
  const { data: recentAlertRows, error: auditErr } = await adminClient
    .from('audit_log')
    .select('record_id')
    .eq('action', 'LOW_STOCK_ALERT_SENT')
    .eq('table_name', 'inventory')
    .gte('created_at', cutoff)
    .in('record_id', candidateIds)

  if (auditErr) {
    captureWithContext(auditErr, { action: 'GET /api/inventory/low-stock-alert/audit-check' })
    return NextResponse.json(
      { error: 'Failed to check recent alerts', code: 'DB_ERROR' },
      { status: 500 },
    )
  }

  const alreadyAlerted = new Set(
    (recentAlertRows ?? []).map((r) => r.record_id as string),
  )

  const toAlert = candidates.filter((c) => !alreadyAlerted.has(c.id))
  const skippedDedup = candidates.length - toAlert.length

  if (toAlert.length === 0) {
    return NextResponse.json({
      alerts: [],
      meta: {
        total_orgs_checked: eligibleOrgIds.size,
        alerts_issued: 0,
        skippedDedup,
      },
    })
  }

  // Mark all items as alerted before responding (fire-and-forget style: we log
  // first so the next run skips them even if n8n fails mid-send).
  const auditRows = toAlert.map((item) => ({
    organization_id: item.organization_id,
    table_name: 'inventory' as const,
    record_id: item.id,
    action: 'LOW_STOCK_ALERT_SENT',
    changed_by: null as unknown as string,
    changed_by_source: 'scheduled' as const,
    old_values: null,
    new_values: {
      item_name: item.item_name,
      current_quantity: item.current_quantity,
      reorder_level: item.reorder_level,
      unit: item.unit,
    } as unknown as import('@/types/database').Json,
  }))

  const { error: insertErr } = await adminClient.from('audit_log').insert(auditRows)
  if (insertErr) {
    // Non-fatal: log the error but still return the alerts so n8n can send them.
    // Worst case: a duplicate alert may go out on the next 6-hour cycle.
    captureWithContext(insertErr, { action: 'GET /api/inventory/low-stock-alert/audit-insert' })
  }

  const alerts = toAlert.map((item) => {
    const lang = orgMeta.get(item.organization_id)?.language_preference
    const locale: 'en' | 'gu' | 'hi' =
      lang === 'gu' || lang === 'hi' ? lang : 'en'

    const daysSupply =
      item.avg_daily_consumption && item.avg_daily_consumption > 0
        ? String(Math.floor(item.current_quantity / item.avg_daily_consumption))
        : '?'

    return {
      organization_id: item.organization_id,
      owner_phone: ownerPhone.get(item.organization_id)!,
      language_preference: locale,
      inventory_id: item.id,
      item_name: item.item_name,
      current_quantity: String(Math.round(item.current_quantity)),
      reorder_level: item.reorder_level,
      unit: item.unit,
      days_supply: daysSupply,
    }
  })

  return NextResponse.json({
    alerts,
    meta: {
      total_orgs_checked: eligibleOrgIds.size,
      alerts_issued: alerts.length,
      skippedDedup,
    },
  })
}
