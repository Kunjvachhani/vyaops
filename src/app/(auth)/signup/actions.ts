'use server'

import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

type SignupResult = { error: string } | { success: true }

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const companyName = formData.get('companyName') as string
  const city = formData.get('city') as string
  const industry = formData.get('industry') as string
  const role = (formData.get('role') as string) || 'owner'
  const address = (formData.get('address') as string | null) || null
  const gstin = ((formData.get('gstin') as string | null) || '').trim().toUpperCase() || null
  const tier = (formData.get('tier') as string) || 'tier_1'

  const supabase = await createClient()

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    console.error('[signup] auth.signUp error:', authError.message)
    return { error: authError.message }
  }

  if (!authData.user) {
    // Supabase returns no user when email confirmation is required and the address
    // already exists — treat it as a generic failure so we don't leak that info.
    console.error('[signup] auth.signUp returned no user (email may already exist or confirmation required)')
    return { error: 'Unable to create account. The email may already be registered.' }
  }

  const authUserId = authData.user.id

  try {
    // 2. Create organization record via service-role client (bypasses RLS)
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: companyName,
        city,
        industry_config: industry,
        phone: 'pending',
        email,
        address,
        gstin,
        tier,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('[signup] org insert error:', orgError?.message, orgError?.details)
      await adminClient.auth.admin.deleteUser(authUserId)
      return { error: orgError?.message ?? 'Failed to create organization.' }
    }

    const orgId = org.id

    // 3. Create user profile record
    const { error: userError } = await adminClient.from('users').insert({
      supabase_auth_id: authUserId,
      organization_id: orgId,
      full_name: fullName,
      email,
      role,
    })

    if (userError) {
      console.error('[signup] users insert error:', userError.message, userError.details)
      await adminClient.auth.admin.deleteUser(authUserId)
      return { error: userError.message }
    }

    // 4. Stamp org_id + role into auth metadata so middleware/getCurrentUser/RLS can read them.
    // SECURITY: the authoritative copy lives in app_metadata — users CANNOT self-edit it
    // (only the service-role key can write it). user_metadata is mirrored only for backward
    // compatibility during the migration window and can be dropped in a later cleanup sprint.
    const { error: metaError } = await adminClient.auth.admin.updateUserById(authUserId, {
      app_metadata: { org_id: orgId, role },
      user_metadata: { org_id: orgId, role },
    })

    if (metaError) {
      console.error('[signup] updateUserById error:', metaError.message)
    }

    // Refresh the session so the new JWT includes org_id + role in user_metadata.
    // Without this the stale JWT causes a redirect loop: layout → /login → /dashboard → repeat.
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.error('[signup] refreshSession error:', refreshError.message)
      // Non-fatal: user can sign in manually to get a fresh JWT
    }

    return { success: true }
  } catch (err) {
    console.error('[signup] unexpected error:', err)
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred.' }
  }
}
