import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import { softDelete, SoftDeleteError } from '@/lib/utils/soft-delete'
import { captureWithContext } from '@/lib/utils/sentry'
import { updateComplianceTaskSchema } from '@/lib/validations/compliance'
import { requireTier } from '@/lib/utils/feature-gate'
import type { Database } from '@/types/database'

type ComplianceTaskRow = Database['public']['Tables']['compliance_tasks']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// PATCH /api/compliance/[id]
// Updates a compliance task (status, completed_date, task_name, due_date, notes, etc.).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  const gate = await requireTier('tier_3', user.org_id)
  if (gate) return gate

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = updateComplianceTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { data: existingRaw, error: fetchErr } = await adminClient
    .from('compliance_tasks')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !existingRaw) {
    return NextResponse.json({ error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const existing = existingRaw as unknown as ComplianceTaskRow
  const updates = parsed.data

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('compliance_tasks')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    captureWithContext(updateErr ?? new Error('update returned null'), {
      action: 'PATCH /api/compliance/[id]',
      org_id: user.org_id,
    })
    return NextResponse.json({ error: 'Failed to update task', code: 'DB_ERROR' }, { status: 500 })
  }

  const updated = updatedRaw as unknown as ComplianceTaskRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'compliance_task',
    entity_id: id,
    changes: diffChanges(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    ),
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/compliance/[id]
// Soft-deletes a compliance task.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const gateDelete = await requireTier('tier_3', user.org_id)
  if (gateDelete) return gateDelete
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    await softDelete('compliance_tasks', id, user.org_id, user.id, { ip: getIp(req) })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'ALREADY_DELETED' ? 409 : 500
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    captureWithContext(err as Error, { action: 'DELETE /api/compliance/[id]', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to delete task', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
