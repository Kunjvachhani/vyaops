import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type ComplianceTaskRow = Database['public']['Tables']['compliance_tasks']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type OrgRow = Database['public']['Tables']['organizations']['Row']

// GET /api/compliance/upcoming
// Internal route (x-internal-api-key) used by n8n compliance-reminder workflow.
// Returns tasks due within 3 days or overdue+pending where reminder_sent = false,
// enriched with org owner phone and language preference.
// Tasks due TODAY are returned regardless of reminder_sent (for due-date re-reminder).
export async function GET(req: NextRequest) {
  const unauthorized = requireInternalAuth(req)
  if (unauthorized) return unauthorized

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const plusThree = new Date(today)
  plusThree.setDate(today.getDate() + 3)
  const plusThreeStr = plusThree.toISOString().split('T')[0]

  try {
    const [tasksRes, orgsRes, ownersRes] = await Promise.all([
      // Tasks due within 3 days (first reminder, not yet sent) + due today re-reminder
      adminClient
        .from('compliance_tasks')
        .select('*')
        .lte('due_date', plusThreeStr)
        .not('status', 'in', '("completed","na")')
        .is('deleted_at', null),
      adminClient
        .from('organizations')
        .select('id, language_preference, whatsapp_proactive_enabled, tier')
        .eq('whatsapp_proactive_enabled', true)
        .in('tier', ['tier_3'])  // compliance is tier_3
        .is('deleted_at', null),
      adminClient
        .from('users')
        .select('organization_id, phone')
        .eq('role', 'owner')
        .eq('is_active', true)
        .is('deleted_at', null),
    ])

    if (tasksRes.error) throw tasksRes.error
    if (orgsRes.error) throw orgsRes.error
    if (ownersRes.error) throw ownersRes.error

    type OrgFields = Pick<OrgRow, 'id' | 'language_preference' | 'whatsapp_proactive_enabled' | 'tier'>
    type UserFields = Pick<UserRow, 'organization_id' | 'phone'>

    const tasks = (tasksRes.data ?? []) as unknown as ComplianceTaskRow[]
    const orgs = (orgsRes.data ?? []) as unknown as OrgFields[]
    const owners = (ownersRes.data ?? []) as unknown as UserFields[]

    // Index by org_id for O(1) lookup
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    const ownerPhone = new Map<string, string>()
    for (const u of owners) {
      const phone = u.phone?.trim()
      if (phone && !ownerPhone.has(u.organization_id)) {
        ownerPhone.set(u.organization_id, phone)
      }
    }

    const result = tasks
      .filter((t) => {
        const org = orgMap.get(t.organization_id)
        if (!org) return false
        const phone = ownerPhone.get(t.organization_id)
        if (!phone) return false

        // Include if: reminder_sent = false (any task in window)
        // OR due today regardless of reminder_sent (re-reminder on due date)
        return !t.reminder_sent || t.due_date === todayStr
      })
      .map((t) => {
        const org = orgMap.get(t.organization_id)!
        return {
          id: t.id,
          organization_id: t.organization_id,
          task_name: t.task_name,
          category: t.category,
          due_date: t.due_date,
          status: t.status,
          is_due_today: t.due_date === todayStr,
          is_overdue: t.due_date < todayStr,
          owner_phone: ownerPhone.get(t.organization_id)!,
          language_preference: org.language_preference,
        }
      })

    return NextResponse.json({ tasks: result, meta: { count: result.length, as_of: todayStr } })
  } catch (err) {
    captureWithContext(err as Error, { action: 'GET /api/compliance/upcoming' })
    return NextResponse.json({ error: 'Failed to fetch upcoming tasks', code: 'DB_ERROR' }, { status: 500 })
  }
}
