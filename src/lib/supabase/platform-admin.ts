import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

export type PlatformAdmin = {
  id: string // platform_admins.id
  user_id: string // auth.users.id
  label: string
}

/**
 * Authoritative platform-admin check.
 *
 * Returns the {@link PlatformAdmin} row for the current session user, or null.
 * Uses the service-role client because `platform_admins` has RLS enabled with NO
 * policies — authenticated/anon roles can never read it. Soft-revoked rows
 * (`revoked_at IS NOT NULL`) are excluded.
 *
 * Middleware uses the faster `app_metadata.is_platform_admin` flag to gate the
 * `/admin` route group; this DB lookup is the hard check called from the (admin)
 * layout and the admin API routes (defense in depth).
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await adminClient
    .from('platform_admins')
    .select('id, user_id, label')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) {
    console.error('[platform-admin] lookup failed:', error)
    return null
  }

  return data as PlatformAdmin | null
}
