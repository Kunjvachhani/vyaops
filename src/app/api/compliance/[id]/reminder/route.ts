import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/compliance/[id]/reminder
// Internal route (x-internal-api-key) used by n8n after sending WhatsApp reminder.
// Marks reminder_sent = true on the compliance task.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireInternalAuth(req)
  if (unauthorized) return unauthorized

  const { id } = await params

  const { error } = await adminClient
    .from('compliance_tasks')
    .update({ reminder_sent: true })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    captureWithContext(error, { action: 'POST /api/compliance/[id]/reminder', task_id: id })
    return NextResponse.json({ error: 'Failed to mark reminder sent', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
