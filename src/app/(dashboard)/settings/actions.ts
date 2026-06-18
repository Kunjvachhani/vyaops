'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import type { Database } from '@/types/database'

type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

export type UpdateProactiveResult =
  | { ok: true; enabled: boolean; setAt: string }
  | { ok: false; error: string }

// Toggle whether this org receives proactive WhatsApp notifications
// (daily summary, payment reminders, compliance alerts). Owner-only.
export async function updateProactivePreference(
  enabled: boolean
): Promise<UpdateProactiveResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

  // Auth is established above (owner of this org). Writes go through adminClient
  // scoped strictly to user.org_id — the same read-via-RLS / write-via-admin
  // pattern the dashboard API routes use. Every query filters organization_id
  // (defense in depth) and deleted_at IS NULL.
  // Read the current value first so the audit log captures the real diff.
  const { data: before, error: readError } = await adminClient
    .from('organizations')
    .select('whatsapp_proactive_enabled')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (readError || !before) return { ok: false, error: 'not_found' }

  const previous = (before as { whatsapp_proactive_enabled: boolean })
    .whatsapp_proactive_enabled
  const setAt = new Date().toISOString()

  const payload: OrganizationUpdate = {
    whatsapp_proactive_enabled: enabled,
    whatsapp_proactive_set_at: setAt,
  }

  const { error: updateError } = await adminClient
    .from('organizations')
    .update(payload)
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    console.error('[settings/updateProactivePreference]', updateError)
    return { ok: false, error: 'update_failed' }
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'organization',
    entity_id: user.org_id,
    changes: [
      {
        field: 'whatsapp_proactive_enabled',
        old_value: previous,
        new_value: enabled,
      },
    ],
  })

  revalidatePath('/settings')
  return { ok: true, enabled, setAt }
}
