import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { InvoiceRenderError, renderInvoice } from '@/lib/invoices/render'
import { sendRawMessage } from '@/lib/whatsapp/meta-cloud-api'
import { paiseToInvoiceAmount } from '@/lib/utils/currency'
import { formatISTDate } from '@/lib/utils/date'
import { logAudit } from '@/lib/utils/audit'
import type { MessageType } from '@/types/whatsapp'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

type RouteContext = { params: Promise<{ id: string }> }

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

// POST /api/invoices/[id]/send-whatsapp
// Owner-initiated: delivers the invoice PDF to the customer's WhatsApp as a
// document message and marks the invoice sent. This is an explicit owner action
// (not the bot auto-replying), so it does not violate the bot-silence rule.
// Note: WhatsApp requires an open 24h customer-service window for free-form
// document delivery; outside it, an approved template is required.
// Requires: owner or manager role.
export async function POST(req: NextRequest, { params }: RouteContext) {
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

  // Render (or reuse cached) PDF and obtain a fresh signed URL + customer details.
  let rendered
  try {
    rendered = await renderInvoice(user.org_id, id)
  } catch (err) {
    if (err instanceof InvoiceRenderError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'DATA_INTEGRITY_ERROR' ? 422 : 500
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    console.error('[POST /api/invoices/[id]/send-whatsapp] render', err)
    return NextResponse.json(
      { error: 'Failed to prepare invoice PDF', code: 'PDF_GENERATION_ERROR' },
      { status: 500 }
    )
  }

  if (!rendered.customerPhone) {
    return NextResponse.json(
      { error: 'Customer has no WhatsApp number on file', code: 'NO_CUSTOMER_PHONE' },
      { status: 422 }
    )
  }
  if (!rendered.signedUrl) {
    return NextResponse.json(
      { error: 'Invoice PDF is not available to send', code: 'PDF_UNAVAILABLE' },
      { status: 502 }
    )
  }

  const caption =
    `Invoice ${rendered.invoiceNumber}\n` +
    `Amount: ${paiseToInvoiceAmount(rendered.totalAmountPaise)}\n` +
    `Due: ${formatISTDate(new Date(rendered.dueDate))}`

  const message = {
    type: 'document' as MessageType,
    document: {
      link: rendered.signedUrl,
      filename: `${rendered.invoiceNumber}.pdf`,
      caption,
    },
  }

  const result = await sendRawMessage(rendered.customerPhone, message, user.org_id)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'WhatsApp send failed', code: 'WHATSAPP_SEND_FAILED' },
      { status: 502 }
    )
  }

  // Fetch current status to decide whether to advance draft → sent.
  const { data: currentRaw } = await adminClient
    .from('invoices')
    .select('status, sent_via_whatsapp')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .single()
  const current = currentRaw as unknown as Pick<InvoiceRow, 'status' | 'sent_via_whatsapp'> | null

  const nextStatus = current?.status === 'draft' ? 'sent' : current?.status
  const { data: updatedRaw, error: updateErr } = await adminClient
    .from('invoices')
    .update({
      sent_via_whatsapp: true,
      sent_at: new Date().toISOString(),
      status: nextStatus,
    })
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .select()
    .single()

  if (updateErr || !updatedRaw) {
    // The message was sent; only the bookkeeping update failed. Report success
    // with a warning so the owner isn't told the send failed.
    console.error('[POST /api/invoices/[id]/send-whatsapp] post-send update failed', updateErr)
    return NextResponse.json({ sent: true, messageId: result.messageId, warning: 'STATE_UPDATE_FAILED' })
  }

  const updated = updatedRaw as unknown as InvoiceRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'invoice',
    entity_id: id,
    changes: [
      { field: 'sent_via_whatsapp', old_value: current?.sent_via_whatsapp ?? false, new_value: true },
      ...(nextStatus !== current?.status
        ? [{ field: 'status', old_value: current?.status, new_value: nextStatus }]
        : []),
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ sent: true, messageId: result.messageId, data: updated })
}
