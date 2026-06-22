import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/invoices/[id]/audit
// Returns audit log entries for the given invoice.
// Uses adminClient since audit_log has RLS disabled (service-role only).
// Invoice ownership is verified via the RLS-enforced client before returning data.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('audit_log')
    .select('id, action, changed_by, changed_by_source, old_values, new_values, created_at')
    .eq('table_name', 'invoices')
    .eq('record_id', id)
    .eq('organization_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    captureWithContext(error, { action: 'GET /api/invoices/[id]/audit', org_id: user.org_id, user_role: user.role })
    return NextResponse.json(
      { error: 'Failed to fetch audit log', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data ?? [] })
}
