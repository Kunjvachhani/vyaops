import { getCurrentUser } from '@/lib/supabase/server'
import { calculateRupeesSaved } from '@/lib/utils/rupees-saved'
import { RupeesSavedHeroClient } from './rupees-saved-hero-client'

/**
 * Server wrapper for the ₹-saved hero. Computes this month's savings plus the
 * previous full calendar month so the client can render a trend, then hands the
 * numbers to a client component for the animated counter + expandable breakdown.
 */
export async function RupeesSavedHero() {
  const user = await getCurrentUser()
  if (!user) return null

  const [thisMonth, lastMonth] = await Promise.all([
    calculateRupeesSaved(user.org_id, 'this_month'),
    calculateRupeesSaved(user.org_id, 'last_month'),
  ])

  return (
    <RupeesSavedHeroClient
      breakdown={thisMonth}
      previousTotalPaise={lastMonth.totalSavedPaise}
    />
  )
}
