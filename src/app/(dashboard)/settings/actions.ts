'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import type { Database } from '@/types/database'

type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// TAB 1 — Organisation Profile
// ---------------------------------------------------------------------------

const OrgProfileSchema = z.object({
  name: z.string().min(1).max(200),
  gstin: z.string().max(15).nullable(),
  address: z.string().max(500).nullable(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z
    .string()
    .email()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  industry_config: z.string().min(1),
  logo_url: z.string().url().nullable().optional(),
})

export async function updateOrgProfile(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

  const parsed = OrgProfileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { data: before, error: readError } = await adminClient
    .from('organizations')
    .select('name, gstin, address, city, state, phone, email, industry_config, logo_url')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (readError || !before) return { ok: false, error: 'not_found' }

  const payload: OrganizationUpdate = {
    name: parsed.data.name,
    gstin: parsed.data.gstin,
    address: parsed.data.address,
    city: parsed.data.city,
    state: parsed.data.state,
    phone: parsed.data.phone,
    email: parsed.data.email,
    industry_config: parsed.data.industry_config,
    ...(parsed.data.logo_url !== undefined ? { logo_url: parsed.data.logo_url } : {}),
  }

  const { error: updateError } = await adminClient
    .from('organizations')
    .update(payload)
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, { action: 'settings/updateOrgProfile', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  const changes = Object.entries(payload)
    .filter(([key, val]) => {
      const old = (before as Record<string, unknown>)[key]
      return JSON.stringify(old) !== JSON.stringify(val)
    })
    .map(([field, new_value]) => ({
      field,
      old_value: (before as Record<string, unknown>)[field],
      new_value,
    }))

  if (changes.length > 0) {
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'update',
      entity_type: 'organization',
      entity_id: user.org_id,
      changes,
    })
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// TAB 2 — Team Management
// ---------------------------------------------------------------------------

const InviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(['manager', 'worker', 'viewer']),
})

const USER_LIMITS: Record<string, number> = {
  tier_1: 2,
  tier_2: 5,
  tier_3: 10,
}

export async function inviteUser(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

  const parsed = InviteUserSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .select('tier')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (orgError || !org) return { ok: false, error: 'not_found' }

  const { count } = await adminClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  const limit = USER_LIMITS[org.tier] ?? 2
  if ((count ?? 0) >= limit) return { ok: false, error: 'user_limit_reached' }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.full_name },
    })

  if (inviteError || !inviteData.user) {
    captureWithContext(inviteError ?? new Error('no user in invite response'), {
      action: 'settings/inviteUser',
      org_id: user.org_id,
    })
    return { ok: false, error: 'invite_failed' }
  }

  // Stamp org_id + role into app_metadata so JWT claims are correct on first sign-in
  await adminClient.auth.admin.updateUserById(inviteData.user.id, {
    app_metadata: { org_id: user.org_id, role: parsed.data.role },
  })

  const { error: insertError } = await adminClient.from('users').insert({
    organization_id: user.org_id,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    supabase_auth_id: inviteData.user.id,
    is_active: false,
  })

  if (insertError) {
    captureWithContext(insertError, {
      action: 'settings/inviteUser/insert',
      org_id: user.org_id,
    })
    return { ok: false, error: 'insert_failed' }
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'user',
    entity_id: inviteData.user.id,
    changes: [
      { field: 'email', old_value: null, new_value: parsed.data.email },
      { field: 'role', old_value: null, new_value: parsed.data.role },
    ],
  })

  revalidatePath('/settings')
  return { ok: true }
}

const ChangeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['manager', 'worker', 'viewer']),
})

export async function changeUserRole(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

  const parsed = ChangeRoleSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { data: target, error: findError } = await adminClient
    .from('users')
    .select('id, role, supabase_auth_id, organization_id')
    .eq('id', parsed.data.userId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (findError || !target) return { ok: false, error: 'not_found' }
  if (target.role === 'owner') return { ok: false, error: 'cannot_change_owner_role' }

  const { error: updateError } = await adminClient
    .from('users')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)
    .eq('organization_id', user.org_id)

  if (updateError) {
    captureWithContext(updateError, { action: 'settings/changeUserRole', org_id: user.org_id })
    return { ok: false, error: 'update_failed' }
  }

  if (target.supabase_auth_id) {
    await adminClient.auth.admin.updateUserById(target.supabase_auth_id, {
      app_metadata: { org_id: user.org_id, role: parsed.data.role },
    })
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'user',
    entity_id: parsed.data.userId,
    changes: [{ field: 'role', old_value: target.role, new_value: parsed.data.role }],
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }
  if (userId === user.id) return { ok: false, error: 'cannot_remove_self' }

  const { data: target, error: findError } = await adminClient
    .from('users')
    .select('id, role, supabase_auth_id, organization_id')
    .eq('id', userId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (findError || !target) return { ok: false, error: 'not_found' }
  if (target.role === 'owner') return { ok: false, error: 'cannot_remove_owner' }

  const now = new Date().toISOString()

  const { error: deleteError } = await adminClient
    .from('users')
    .update({ deleted_at: now, is_active: false })
    .eq('id', userId)
    .eq('organization_id', user.org_id)

  if (deleteError) {
    captureWithContext(deleteError, { action: 'settings/removeUser', org_id: user.org_id })
    return { ok: false, error: 'delete_failed' }
  }

  if (target.supabase_auth_id) {
    await adminClient.auth.admin.updateUserById(target.supabase_auth_id, {
      app_metadata: { org_id: null, role: null },
    })
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'soft_delete',
    entity_type: 'user',
    entity_id: userId,
    changes: [{ field: 'deleted_at', old_value: null, new_value: now }],
  })

  revalidatePath('/settings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// TAB 4 — Preferences (language + timezone)
// ---------------------------------------------------------------------------

const PreferencesSchema = z.object({
  language_preference: z.enum(['gu', 'hi', 'en']),
  timezone: z.string().min(1).max(100),
})

export async function updatePreferences(raw: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }

  const parsed = PreferencesSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const { data: before, error: readError } = await adminClient
    .from('organizations')
    .select('language_preference, timezone')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (readError || !before) return { ok: false, error: 'not_found' }

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({
      language_preference: parsed.data.language_preference,
      timezone: parsed.data.timezone,
    })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, {
      action: 'settings/updatePreferences',
      org_id: user.org_id,
    })
    return { ok: false, error: 'update_failed' }
  }

  const changes = [
    {
      field: 'language_preference',
      old_value: before.language_preference,
      new_value: parsed.data.language_preference,
    },
    { field: 'timezone', old_value: before.timezone, new_value: parsed.data.timezone },
  ].filter((c) => c.old_value !== c.new_value)

  if (changes.length > 0) {
    await logAudit({
      organization_id: user.org_id,
      user_id: user.id,
      action: 'update',
      entity_type: 'organization',
      entity_id: user.org_id,
      changes,
    })
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// TAB 4 — WhatsApp proactive toggle (preserved from previous sprint)
// ---------------------------------------------------------------------------

export type UpdateProactiveResult =
  | { ok: true; enabled: boolean; setAt: string }
  | { ok: false; error: string }

export async function updateProactivePreference(
  enabled: boolean
): Promise<UpdateProactiveResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

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

  const { error: updateError } = await adminClient
    .from('organizations')
    .update({
      whatsapp_proactive_enabled: enabled,
      whatsapp_proactive_set_at: setAt,
    })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (updateError) {
    captureWithContext(updateError, {
      action: 'settings/updateProactivePreference',
      org_id: user.org_id,
      user_role: user.role,
    })
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

// ---------------------------------------------------------------------------
// TAB 5 — Delete Account
// ---------------------------------------------------------------------------

export async function deleteAccount(confirmName: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (user.role !== 'owner') return { ok: false, error: 'forbidden' }

  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .select('id, name')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (orgError || !org) return { ok: false, error: 'not_found' }
  if (org.name.trim() !== confirmName.trim()) return { ok: false, error: 'name_mismatch' }

  const now = new Date().toISOString()

  await adminClient
    .from('users')
    .update({ deleted_at: now, is_active: false })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  const { error: deleteError } = await adminClient
    .from('organizations')
    .update({ deleted_at: now, billing_status: 'cancelled' })
    .eq('id', user.org_id)
    .is('deleted_at', null)

  if (deleteError) {
    captureWithContext(deleteError, {
      action: 'settings/deleteAccount',
      org_id: user.org_id,
    })
    return { ok: false, error: 'delete_failed' }
  }

  await logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'soft_delete',
    entity_type: 'organization',
    entity_id: user.org_id,
    changes: [{ field: 'deleted_at', old_value: null, new_value: now }],
  })

  redirect('/login')
}
