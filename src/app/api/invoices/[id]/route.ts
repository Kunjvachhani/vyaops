import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { diffChanges, logAudit } from '@/lib/utils/audit'
import {
  INVOICE_STATUS_TRANSITIONS,
  MANUAL_INVOICE_STATUSES,
  updateInvoiceSchema,
} from '@/lib/validations/invoice'
import type { ManualInvoiceStatus } from '@/lib/validations/invoice'
import { softDelete, SoftDeleteError } from '@/lib/utils/soft-delete'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type PaymentRow = Database['public']['Tables']['payments']['Row']

type RouteContext = { params: Promise<{ id: string }> }

const UNPAID_STATUSES = ['draft', 'sent', 'partially_paid']

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// GET /api/invoices/[id]
// Returns the full invoice with customer, order/product, and payment history.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: invoiceRaw, error } = await supabase
    .from('invoices')
    .select(
      `*,
       customers(id, name, company_name, phone, email, gstin, address),
       orders(id, order_number, quantity, unit_price_paise, products(id, name, unit, hsn_code))`
    )
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !invoiceRaw) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  type InvoiceWithRelations = InvoiceRow & {
    customers: Pick<
      CustomerRow,
      'id' | 'name' | 'company_name' | 'phone' | 'email' | 'gstin' | 'address'
    > | null
    orders:
      | (Pick<OrderRow, 'id' | 'order_number' | 'quantity' | 'unit_price_paise'> & {
          products: Pick<ProductRow, 'id' | 'name' | 'unit' | 'hsn_code'> | null
        })
      | null
  }
  const invoice = invoiceRaw as unknown as InvoiceWithRelations

  // Payment history (oldest first).
  const { data: paymentsRaw } = await supabase
    .from('payments')
    .select('id, amount_paise, payment_date, payment_method, reference_number, notes, created_at')
    .eq('invoice_id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .order('payment_date', { ascending: true })

  const payments = (paymentsRaw as unknown as PaymentRow[] | null) ?? []

  const isOverdue = UNPAID_STATUSES.includes(invoice.status) && invoice.due_date < istToday()

  return NextResponse.json({ data: { ...invoice, is_overdue: isOverdue }, payments })
}

// PATCH /api/invoices/[id]
// Two mutually-exclusive modes (enforced by the Zod schema):
//   1. Manual status/notes edit (draft → sent → cancelled), optimistic-locked.
//   2. Record a payment — inserts a payments row, recomputes paid total, and
//      sets status to paid (fully covered) or partially_paid.
// Requires: owner or manager role.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = updateInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { updated_at: clientUpdatedAt, status: newStatus, notes, payment } = parsed.data

  const supabase = await createClient()
  const { data: currentRaw, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const current = currentRaw as unknown as InvoiceRow

  // Optimistic locking — reject if a concurrent write happened since the client read.
  if (current.updated_at !== clientUpdatedAt) {
    return NextResponse.json(
      {
        error: 'Invoice was modified by another process. Refresh and try again.',
        code: 'CONFLICT',
      },
      { status: 409 }
    )
  }

  // ───────────────────────── Mode 2: record a payment ─────────────────────────
  if (payment) {
    if (current.status === 'cancelled' || current.status === 'paid') {
      return NextResponse.json(
        {
          error: `Cannot record a payment on a ${current.status} invoice`,
          code: 'INVALID_STATE',
        },
        { status: 422 }
      )
    }

    const newPaidTotal = current.paid_amount_paise + payment.amountPaise
    if (newPaidTotal > current.total_amount_paise) {
      return NextResponse.json(
        {
          error: 'Payment exceeds the outstanding balance',
          code: 'OVERPAYMENT',
          details: {
            outstandingPaise: current.total_amount_paise - current.paid_amount_paise,
          },
        },
        { status: 422 }
      )
    }

    const fullyPaid = newPaidTotal >= current.total_amount_paise
    const nextStatus = fullyPaid ? 'paid' : 'partially_paid'

    // Insert the payment record (history).
    const { data: payRaw, error: payErr } = await adminClient
      .from('payments')
      .insert({
        organization_id: user.org_id,
        invoice_id: id,
        amount_paise: payment.amountPaise,
        payment_date: payment.paymentDate,
        payment_method: payment.paymentMethod,
        reference_number: payment.referenceNumber ?? null,
        notes: payment.notes ?? null,
      })
      .select()
      .single()

    if (payErr || !payRaw) {
      console.error('[PATCH /api/invoices/[id]] payment insert failed', payErr)
      return NextResponse.json(
        { error: 'Failed to record payment', code: 'DB_ERROR' },
        { status: 500 }
      )
    }
    const createdPayment = payRaw as unknown as PaymentRow

    // Roll the payment up onto the invoice.
    const { data: updatedRaw, error: updateErr } = await adminClient
      .from('invoices')
      .update({
        paid_amount_paise: newPaidTotal,
        paid_date: fullyPaid ? payment.paymentDate : current.paid_date,
        payment_method: payment.paymentMethod,
        status: nextStatus,
      })
      .eq('id', id)
      .eq('organization_id', user.org_id)
      .select()
      .single()

    if (updateErr || !updatedRaw) {
      console.error('[PATCH /api/invoices/[id]] invoice update after payment failed', updateErr)
      return NextResponse.json(
        { error: 'Failed to update invoice', code: 'DB_ERROR' },
        { status: 500 }
      )
    }
    const updated = updatedRaw as unknown as InvoiceRow

    void logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'status_change',
      entity_type: 'invoice',
      entity_id: id,
      changes: [
        {
          field: 'paid_amount_paise',
          old_value: current.paid_amount_paise,
          new_value: newPaidTotal,
        },
        { field: 'status', old_value: current.status, new_value: nextStatus },
        { field: 'payment_recorded_paise', old_value: null, new_value: payment.amountPaise },
        { field: 'payment_method', old_value: current.payment_method, new_value: payment.paymentMethod },
      ],
      ip_address: getIp(req),
    })

    return NextResponse.json({ data: updated, payment: createdPayment })
  }

  // ───────────────────────── Mode 1: status / notes edit ──────────────────────
  if (newStatus !== undefined) {
    const currentStatus = current.status
    if (!(MANUAL_INVOICE_STATUSES as readonly string[]).includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot manually change status from '${currentStatus}'`,
          code: 'INVALID_TRANSITION',
        },
        { status: 422 }
      )
    }
    const allowed = INVOICE_STATUS_TRANSITIONS[currentStatus as ManualInvoiceStatus]
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
          code: 'INVALID_TRANSITION',
          details: { current: currentStatus, allowed },
        },
        { status: 422 }
      )
    }
  }

  const payload: InvoiceUpdate = {}
  if (newStatus !== undefined) payload.status = newStatus
  if (notes !== undefined) payload.notes = notes

  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('invoices')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    console.error('[PATCH /api/invoices/[id]]', updateErr)
    return NextResponse.json(
      { error: 'Failed to update invoice', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const updated = updatedRaw as unknown as InvoiceRow

  const changes = diffChanges(
    current as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  )

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: newStatus !== undefined ? 'status_change' : 'update',
    entity_type: 'invoice',
    entity_id: id,
    changes,
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/invoices/[id]
// Soft-deletes the invoice (stamps deleted_at, audited). Never hard deletes.
// Refuses invoices with recorded payments — those must be cancelled, not deleted.
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

  const supabase = await createClient()
  const { data: currentRaw, error: fetchErr } = await supabase
    .from('invoices')
    .select('status, paid_amount_paise')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !currentRaw) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const current = currentRaw as unknown as Pick<InvoiceRow, 'status' | 'paid_amount_paise'>
  if (current.status === 'paid' || (current.paid_amount_paise ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'Cannot delete an invoice with recorded payments. Cancel it instead.',
        code: 'HAS_PAYMENTS',
      },
      { status: 409 }
    )
  }

  try {
    await softDelete('invoices', id, user.org_id, user.id, { ip: getIp(req) })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      if (err.code === 'NOT_FOUND' || err.code === 'ALREADY_DELETED') {
        return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
      }
      console.error('[DELETE /api/invoices/[id]]', err)
      return NextResponse.json({ error: 'Failed to delete invoice', code: 'DB_ERROR' }, { status: 500 })
    }
    throw err
  }

  return NextResponse.json({ data: { id, table: 'invoices', deleted: true } })
}
