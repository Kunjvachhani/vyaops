'use server'

import { createClient } from '@/lib/supabase/server'

type LoginResult = { error: string } | { success: true }

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
