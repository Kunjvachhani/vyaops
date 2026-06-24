import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { createComplianceTaskSchema } from '@/lib/validations/compliance'
import { requireTier } from '@/lib/utils/feature-gate'
import type { Database } from '@/types/database'

type ComplianceTaskRow = Database['public']['Tables']['compliance_tasks']['Row']

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/compliance
// Returns all compliance tasks for the org sorted by due_date ascending.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const gate = await requireTier('tier_3', user.org_id)
  if (gate) return gate

  const sp = req.nextUrl.searchParams
  const statusFilter = sp.get('status')
  const categoryFilter = sp.get('category')

  const supabase = await createClient()

  let query = supabase
    .from('compliance_tasks')
    .select('*')
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (statusFilter) query = query.eq('status', statusFilter)
  if (categoryFilter) query = query.eq('category', categoryFilter)

  const { data, error } = await query

  if (error) {
    captureWithContext(error, { action: 'GET /api/compliance', org_id: user.org_id })
    return NextResponse.json({ error: 'Failed to fetch compliance tasks', code: 'DB_ERROR' }, { status: 500 })
  }

  const tasks = (data ?? []) as ComplianceTaskRow[]

  // Auto-mark pending tasks as overdue if due_date has passed.
  const today = new Date().toISOString().split('T')[0]
  const overdueIds = tasks
    .filter((t) => t.due_date < today && t.status === 'pending')
    .map((t) => t.id)

  if (overdueIds.length > 0) {
    void adminClient
      .from('compliance_tasks')
      .update({ status: 'overdue' })
      .in('id', overdueIds)
      .eq('organization_id', user.org_id)

    for (const t of tasks) {
      if (overdueIds.includes(t.id)) (t as Record<string, unknown>).status = 'overdue'
    }
  }

  return NextResponse.json({ data: tasks })
}

// POST /api/compliance
// Creates a new compliance task. Body { action: 'seed_defaults' } seeds standard tasks instead.
export async function POST(req: NextRequest) {
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

  const bodyObj = body as Record<string, unknown>
  if (bodyObj?.action === 'seed_defaults') {
    return seedDefaultTasks(user.org_id)
  }

  const parsed = createComplianceTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { task_name, category, frequency, due_date, notes } = parsed.data

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('compliance_tasks')
    .insert({
      organization_id: user.org_id,
      task_name,
      category,
      frequency,
      due_date,
      notes: notes ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    captureWithContext(insertErr ?? new Error('insert returned null'), {
      action: 'POST /api/compliance',
      org_id: user.org_id,
    })
    return NextResponse.json({ error: 'Failed to create task', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as ComplianceTaskRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'compliance_task',
    entity_id: created.id,
    changes: [
      { field: 'task_name', old_value: null, new_value: task_name },
      { field: 'due_date', old_value: null, new_value: due_date },
      { field: 'status', old_value: null, new_value: 'pending' },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

// Seeds standard Indian regulatory compliance tasks for a new org.
async function seedDefaultTasks(orgId: string) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const thisMonthDate = (day: number) =>
    new Date(year, month, day).toISOString().split('T')[0]
  const nextMonthDate = (day: number) =>
    new Date(year, month + 1, day).toISOString().split('T')[0]

  // Check if defaults already seeded to avoid duplicates.
  const { count } = await adminClient
    .from('compliance_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Compliance tasks already exist', code: 'ALREADY_SEEDED' }, { status: 409 })
  }

  const defaults = [
    { task_name: 'GSTR-1 Filing', category: 'gst', frequency: 'monthly', due_date: thisMonthDate(11) },
    { task_name: 'GSTR-3B Filing', category: 'gst', frequency: 'monthly', due_date: thisMonthDate(20) },
    { task_name: 'TDS Deposit', category: 'tds', frequency: 'monthly', due_date: nextMonthDate(7) },
    { task_name: 'PF Deposit', category: 'pf', frequency: 'monthly', due_date: thisMonthDate(15) },
    { task_name: 'ESI Deposit', category: 'esi', frequency: 'monthly', due_date: thisMonthDate(15) },
    { task_name: 'Factory License Renewal', category: 'factory', frequency: 'annual', due_date: `${year}-12-31` },
    { task_name: 'Pollution Control Certificate', category: 'pollution', frequency: 'annual', due_date: `${year}-03-31` },
    { task_name: 'Fire Safety Certificate', category: 'fire', frequency: 'annual', due_date: `${year}-12-31` },
  ]

  const rows = defaults.map((d) => ({ ...d, organization_id: orgId, status: 'pending' as const }))

  const { data, error } = await adminClient
    .from('compliance_tasks')
    .insert(rows)
    .select()

  if (error) {
    captureWithContext(error, { action: 'seed_defaults /api/compliance', org_id: orgId })
    return NextResponse.json({ error: 'Failed to seed default tasks', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ data, seeded: true }, { status: 201 })
}
