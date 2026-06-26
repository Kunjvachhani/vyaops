import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { TIER_HIERARCHY, requiredTierForRoute, billingAllowsPaidAccess } from '@/config/features'
import type { Tier } from '@/config/features'

const PUBLIC_PATHS = new Set(['/login', '/signup', '/callback'])

// Route → required-tier gating is derived from FEATURE_ACCESS via requiredTierForRoute()
// (src/config/features.ts) — the SINGLE source of truth. No second hardcoded prefix→tier
// table here (it would silently drift when a feature is re-tiered). Middleware redirects to
// /settings (billing tab) when the org's tier/billing is insufficient, not a hard error.

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A user counts as "authenticated for the app" only once their JWT carries
  // org_id + role in app_metadata — the same predicate getCurrentUser() and
  // the RLS policies use. Keying off bare session existence here while the
  // dashboard layout keys off org_id causes an infinite /login ⇄ /dashboard
  // redirect loop whenever the JWT is stale (e.g. right after signup, before
  // the session is refreshed).
  // org_id + role live in app_metadata (service-role-only). Fall back to user_metadata for
  // JWTs issued before the S5 migration. (Same predicate getCurrentUser() + RLS helpers use.)
  const appMeta = user?.app_metadata as Record<string, unknown> | undefined
  const userMeta = user?.user_metadata as Record<string, unknown> | undefined
  const meta = appMeta?.org_id ? appMeta : userMeta
  const isAuthed = Boolean(user && meta?.org_id && meta?.role)

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.has(pathname)

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthed && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Platform-admin gate for the (admin) route group. Fast path only: trust the
  // is_platform_admin flag in app_metadata (service-role-only, not user-editable) to avoid a
  // DB round-trip in edge middleware. The (admin) layout calls getPlatformAdmin() as the
  // authoritative DB check (defense in depth).
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const isPlatformAdmin = appMeta?.is_platform_admin === true
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Tier-based route gating. Only runs for authenticated users on gated (tier_2+) routes.
  // Reads tier + billing_status directly from DB so it reflects Razorpay webhook updates
  // immediately — no session refresh required after a plan change. Two gates:
  //   1. tier must meet the route's required tier (FEATURE_ACCESS-derived).
  //   2. billing_status must allow paid access (active/grace_period) — a suspended/cancelled
  //      org loses tier_2+ access even if its tier column has not yet been downgraded.
  if (isAuthed) {
    const required = requiredTierForRoute(pathname)
    if (required) {
      const orgId = (meta as Record<string, unknown>)?.org_id as string | undefined
      if (orgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('tier, billing_status')
          .eq('id', orgId)
          .is('deleted_at', null)
          .single()
        const orgTier: Tier =
          orgData?.tier && orgData.tier in TIER_HIERARCHY
            ? (orgData.tier as Tier)
            : 'tier_1'
        const tierOk = TIER_HIERARCHY[orgTier] >= TIER_HIERARCHY[required]
        const billingOk = billingAllowsPaidAccess(orgData?.billing_status)
        if (!tierOk || !billingOk) {
          return NextResponse.redirect(new URL('/settings', request.url))
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
