import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import { updateCustomerSchema } from '@/lib/validations/customer'
import { softDelete, SoftDeleteError } from '@/lib/utils/soft-delete'
import { captureWithContext } from '@/lib/utils/sentry'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']
type OrderRow = Database['public']['Tables']['orders']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// GET /api/customers/[id]
// Returns full customer record, recent orders (with product names), and outstanding balance.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: customerRaw, error: customerErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (customerErr || !customerRaw) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const customer = customerRaw as unknown as CustomerRow

  // Recent orders with product name (last 10)
  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('*, products(id, name)')
    .eq('organization_id', user.org_id)
    .eq('customer_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  type OrderWithProduct = OrderRow & { products: Pick<ProductRow, 'id' | 'name'> | null }
  const orders = (ordersRaw ?? []) as unknown as OrderWithProduct[]

  // Outstanding balance from unpaid invoices
  const { data: invoicesRaw } = await supabase
    .from('invoices')
    .select('total_amount_paise, paid_amount_paise, status')
    .eq('organization_id', user.org_id)
    .eq('customer_id', id)
    .in('status', ['sent', 'partially_paid', 'overdue'])
    .is('deleted_at', null)

  type InvoiceSummary = Pick<InvoiceRow, 'total_amount_paise' | 'paid_amount_paise' | 'status'>
  const invoices = (invoicesRaw ?? []) as unknown as InvoiceSummary[]

  const outstanding_amount_paise = invoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount_paise - (inv.paid_amount_paise ?? 0)),
    0
  )

  return NextResponse.json({
    data: {
      customer,
      orders,
      outstanding_amount_paise,
      orders_count: orders.length,
    },
  })
}

// PATCH /api/customers/[id]
// Updates customer fields. Uses optimistic locking via updated_at.
// Requires owner or manager role.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = updateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { updated_at: clientUpdatedAt, ...fields } = parsed.data

  const supabase = await createClient()
  const { data: currentRaw, error: fetchErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const current = currentRaw as unknown as CustomerRow

  if (current.updated_at !== clientUpdatedAt) {
    return NextResponse.json(
      { error: 'Customer was modified by another process. Refresh and try again.', code: 'CONFLICT' },
      { status: 409 }
    )
  }

  const payload: CustomerUpdate = {}
  if (fields.name !== undefined) payload.name = fields.name
  if (fields.company_name !== undefined) payload.company_name = fields.company_name
  if (fields.phone !== undefined) payload.phone = fields.phone
  if (fields.email !== undefined) payload.email = fields.email || null
  if (fields.city !== undefined) payload.city = fields.city
  if (fields.state !== undefined) payload.state = fields.state
  if (fields.gstin !== undefined) payload.gstin = fields.gstin || null
  if (fields.aliases !== undefined) payload.aliases = fields.aliases
  if (fields.credit_limit_paise !== undefined) payload.credit_limit_paise = fields.credit_limit_paise
  if (fields.payment_terms_days !== undefined) payload.payment_terms_days = fields.payment_terms_days
  if (fields.notes !== undefined) payload.notes = fields.notes

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('customers')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    captureWithContext(updateErr ?? new Error('update returned null'), { action: 'PATCH /api/customers/[id]', org_id: user.org_id, user_role: user.role })
    return NextResponse.json({ error: 'Failed to update customer', code: 'DB_ERROR' }, { status: 500 })
  }

  const updated = updatedRaw as unknown as CustomerRow

  const changes = diffChanges(
    current as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'customer',
    entity_id: id,
    changes,
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/customers/[id]
// Soft-deletes the customer (stamps deleted_at, audited). Never hard deletes.
// Requires: owner or manager role. Restore via POST /api/admin/restore.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    await softDelete('customers', id, user.org_id, user.id, { ip: getIp(req) })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      if (err.code === 'NOT_FOUND' || err.code === 'ALREADY_DELETED') {
        return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
      }
      captureWithContext(err, { action: 'DELETE /api/customers/[id]', org_id: user.org_id, user_role: user.role })
      return NextResponse.json({ error: 'Failed to delete customer', code: 'DB_ERROR' }, { status: 500 })
    }
    throw err
  }

  return NextResponse.json({ data: { id, table: 'customers', deleted: true } })
}
