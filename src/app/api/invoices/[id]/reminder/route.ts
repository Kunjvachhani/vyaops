import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type RouteContext = { params: Promise<{ id: string }> }

// The caller (n8n payment-reminder workflow) reports what it just sent: the Meta
// wamid of the template message and which escalation tier it used. Both are
// optional and stored only for audit context — the source of truth for "did a
// reminder go out" is the invoice's last_reminder_at / reminder_count below.
// The owning org is NOT trusted from the caller: it is derived from the invoice
// row (the id is a globally-unique PK), which is safer than accepting an orgId.
const RequestSchema = z.object({
  message_id: z.string().optional(),
  reminder_tier: z.enum(['gentle', 'follow_up', 'urgent', 'final']).optional(),
})

// POST /api/invoices/[id]/reminder
// Internal-only (n8n payment-reminder workflow). Records that a payment reminder
// was just sent: stamps last_reminder_at = now() and bumps reminder_count. This is
// what stops the workflow re-reminding the same invoice more than once per day.
export async function POST(request: NextRequest, { params }: RouteContext) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params

  // A non-UUID path segment can never match a real invoice — treat as not found
  // (also avoids a Postgres 22P02 "invalid input syntax for uuid" 500).
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

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

  const { message_id, reminder_tier } = parsed.data

  // Look up by PK (globally unique) and derive the owning org for the audit entry.
  const { data: currentRaw, error: fetchErr } = await adminClient
    .from('invoices')
    .select('id, organization_id, reminder_count, last_reminder_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const current = currentRaw as unknown as Pick<
    InvoiceRow,
    'id' | 'organization_id' | 'reminder_count' | 'last_reminder_at'
  > | null

  if (fetchErr) {
    captureWithContext(fetchErr, { action: 'POST /api/invoices/[id]/reminder/fetch' })
    return NextResponse.json({ error: 'Failed to load invoice', code: 'DB_ERROR' }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const nextCount = current.reminder_count + 1

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('invoices')
    .update({ last_reminder_at: now, reminder_count: nextCount })
    .eq('id', id)
    .eq('organization_id', current.organization_id)
    .select('id, reminder_count, last_reminder_at')
    .single()

  if (updateErr || !updatedRaw) {
    captureWithContext(updateErr ?? new Error('reminder update returned null'), { action: 'POST /api/invoices/[id]/reminder/update', org_id: current.organization_id })
    return NextResponse.json({ error: 'Failed to record reminder', code: 'DB_ERROR' }, { status: 500 })
  }

  const updated = updatedRaw as unknown as Pick<
    InvoiceRow,
    'id' | 'reminder_count' | 'last_reminder_at'
  >

  // System action — no user_id (NULL changed_by). Tier + wamid kept as metadata.
  void logAudit({
    organization_id: current.organization_id,
    action: 'update',
    entity_type: 'invoice',
    entity_id: id,
    changes: [
      { field: 'reminder_count', old_value: current.reminder_count, new_value: nextCount },
      { field: 'last_reminder_at', old_value: current.last_reminder_at, new_value: now },
    ],
    metadata: { reminder_tier: reminder_tier ?? null, message_id: message_id ?? null },
  })

  return NextResponse.json({ data: updated })
}
