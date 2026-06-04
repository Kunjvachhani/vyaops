import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

if (typeof window !== 'undefined') {
  throw new Error('Admin Supabase client must never be used in the browser.')
}

export const adminClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
