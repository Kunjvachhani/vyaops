'use server'

import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { captureWithContext } from '@/lib/utils/sentry'

type SignupResult = { error: string } | { success: true; selectedTier: 'tier_1' | 'tier_2' | 'tier_3' }

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const companyName = formData.get('companyName') as string
  const city = formData.get('city') as string
  const industry = formData.get('industry') as string
  // Self-signup always produces an owner — staff are invited by the owner, not self-registered.
  const role = 'owner'
  const address = (formData.get('address') as string | null) || null
  const gstin = ((formData.get('gstin') as string | null) || '').trim().toUpperCase() || null

  // SECURITY: the signup plan picker is a PREFERENCE only — it never grants a paid tier.
  // organizations.tier is the access key and is set ONLY by the Razorpay webhook after payment
  // (see docs/security/FEATURE_GATING.md). Honoring a client-chosen tier here would let anyone
  // unlock every gated feature for free. Every new org is provisioned at tier_1; a paid
  // selection just routes the new owner to billing checkout (handled by the signup page).
  const rawSelectedTier = (formData.get('tier') as string) || 'tier_1'
  const selectedTier: 'tier_1' | 'tier_2' | 'tier_3' =
    rawSelectedTier === 'tier_2' || rawSelectedTier === 'tier_3' ? rawSelectedTier : 'tier_1'
  const tier = 'tier_1' as const

  const supabase = await createClient()

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    captureWithContext(new Error(authError.message), { action: 'signup/auth.signUp' })
    return { error: authError.message }
  }

  if (!authData.user) {
    // Supabase returns no user when email confirmation is required and the address
    // already exists — treat it as a generic failure so we don't leak that info.
    captureWithContext(new Error('auth.signUp returned no user'), { action: 'signup/auth.signUp/no-user' })
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
      captureWithContext(orgError ?? new Error('org insert returned null'), { action: 'signup/org-insert' })
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
      captureWithContext(new Error(userError.message), { action: 'signup/user-insert' })
      await adminClient.auth.admin.deleteUser(authUserId)
      return { error: userError.message }
    }

    // 4. Stamp org_id + role into auth metadata so middleware/getCurrentUser/RLS can read them.
    // SECURITY: the authoritative copy lives in app_metadata — users CANNOT self-edit it
    // (only the service-role key can write it). user_metadata is mirrored for the migration
    // window only and can be dropped in a later cleanup sprint.
    // CRITICAL: this is a hard failure — a user without app_metadata is stuck in a broken state.
    const { error: metaError } = await adminClient.auth.admin.updateUserById(authUserId, {
      app_metadata: { org_id: orgId, role },
      user_metadata: { org_id: orgId, role },
    })

    if (metaError) {
      captureWithContext(new Error(metaError.message), { action: 'signup/updateUserById' })
      await adminClient.auth.admin.deleteUser(authUserId)
      return { error: 'Account created but role assignment failed. Please try again.' }
    }

    // Refresh the session so the new JWT includes org_id + role in user_metadata.
    // Without this the stale JWT causes a redirect loop: layout → /login → /dashboard → repeat.
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      captureWithContext(new Error(refreshError.message), { action: 'signup/refreshSession' })
      // Non-fatal: user can sign in manually to get a fresh JWT
    }

    return { success: true, selectedTier }
  } catch (err) {
    captureWithContext(err, { action: 'signup/unexpected' })
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred.' }
  }
}
