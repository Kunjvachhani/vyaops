import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies set by middleware, safe to ignore here
          }
        },
      },
    }
  )
}

export type AuthUser = {
  id: string
  email: string | null
  org_id: string
  role: 'owner' | 'manager' | 'worker' | 'viewer'
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  // org_id + role live in app_metadata (service-role-only, not user-editable). Fall back to
  // user_metadata for users whose JWT predates the S5 app_metadata migration.
  const appMeta = user.app_metadata as Record<string, string> | undefined
  const userMeta = user.user_metadata as Record<string, string> | undefined
  const meta = appMeta?.org_id ? appMeta : userMeta
  const org_id = meta?.org_id
  const role = meta?.role as AuthUser['role'] | undefined

  if (!org_id || !role) return null

  return {
    id: user.id,
    email: user.email ?? null,
    org_id,
    role,
  }
}
