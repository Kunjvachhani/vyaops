import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/utils/audit'
import { captureWithContext } from '@/lib/utils/sentry'
import { createVendorSchema } from '@/lib/validations/vendor'

type VendorRow = Database['public']['Tables']['vendors']['Row']

const ALLOWED_SORT = new Set(['created_at', 'name', 'rating'])

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()|]/g, '')
}

// GET /api/vendors
// Lists vendors for the authenticated org. Supports search, sort, and pagination.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const rawSearch = sp.get('search')?.trim() ?? ''
  const search = sanitizeSearch(rawSearch)
  const sortByParam = sp.get('sort_by') ?? 'created_at'
  const sortAsc = sp.get('sort_dir') === 'asc'
  const sortBy = ALLOWED_SORT.has(sortByParam) ? sortByParam : 'created_at'

  const supabase = await createClient()

  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  query = query.order(sortBy, { ascending: sortAsc }).range(offset, offset + limit - 1)

  const { data: vendorsRaw, error, count } = await query

  if (error) {
    captureWithContext(error, {
      action: 'GET /api/vendors',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json({ error: 'Failed to fetch vendors', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({
    data: (vendorsRaw ?? []) as VendorRow[],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/vendors
// Creates a new vendor. Requires owner or manager role.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (user.role === 'worker' || user.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = createVendorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const {
    name,
    company_name,
    phone,
    email,
    gstin,
    address,
    materials_supplied,
    payment_terms_days,
    rating,
    notes,
  } = parsed.data

  const { data: createdRaw, error: insertErr } = await adminClient
    .from('vendors')
    .insert({
      organization_id: user.org_id,
      name,
      company_name: company_name ?? null,
      phone: phone ?? null,
      email: email ?? null,
      gstin: gstin ?? null,
      address: address ?? null,
      materials_supplied: materials_supplied ?? [],
      payment_terms_days: payment_terms_days ?? 30,
      rating: rating ?? 0,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (insertErr || !createdRaw) {
    captureWithContext(insertErr ?? new Error('insert returned null'), {
      action: 'POST /api/vendors',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json({ error: 'Failed to create vendor', code: 'DB_ERROR' }, { status: 500 })
  }

  const created = createdRaw as unknown as VendorRow

  void logAudit({
    organization_id: user.org_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'vendor',
    entity_id: created.id,
    changes: [
      { field: 'name', old_value: null, new_value: name },
      { field: 'phone', old_value: null, new_value: phone ?? null },
      { field: 'address', old_value: null, new_value: address ?? null },
    ],
    ip_address: getIp(req),
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
