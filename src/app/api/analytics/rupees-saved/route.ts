import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'
import { calculateRupeesSaved, type DateRange } from '@/lib/utils/rupees-saved'

const VALID_DATE_RANGES = new Set<DateRange>(['this_month', 'last_month', 'last_3_months', 'all_time'])

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const rawRange = sp.get('range') ?? 'this_month'
  const dateRange: DateRange = VALID_DATE_RANGES.has(rawRange as DateRange)
    ? (rawRange as DateRange)
    : 'this_month'

  try {
    const breakdown = await calculateRupeesSaved(user.org_id, dateRange)

    return NextResponse.json(breakdown, {
      headers: {
        // User-specific result; browser caches for 1 hour.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    captureWithContext(error instanceof Error ? error : new Error(String(error)), {
      action: 'analytics/rupees-saved',
      org_id: user.org_id,
      date_range: dateRange,
    })
    return NextResponse.json(
      { error: 'Failed to calculate savings', code: 'CALCULATION_ERROR' },
      { status: 500 },
    )
  }
}
