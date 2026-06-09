import { NextRequest, NextResponse } from 'next/server'

/**
 * Guards internal callback routes that only n8n (and other server-side callers)
 * may invoke. n8n attaches `x-internal-api-key`; browsers cannot reach these.
 *
 * Returns a 401 NextResponse to return early, or null when the caller is
 * authorized. Usage:
 *
 *   const unauthorized = requireInternalAuth(request)
 *   if (unauthorized) return unauthorized
 */
export function requireInternalAuth(request: NextRequest): NextResponse | null {
  const provided = request.headers.get('x-internal-api-key')
  const expected = process.env.INTERNAL_API_KEY

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }
  return null
}
