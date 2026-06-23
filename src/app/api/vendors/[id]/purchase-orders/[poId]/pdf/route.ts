import { NextRequest, NextResponse } from 'next/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'
import { generatePOPdf, type POData } from '@/lib/utils/po-pdf-generator'
import type { Database } from '@/types/database'

type VendorOrderRow = Database['public']['Tables']['vendor_orders']['Row']
type VendorRow = Database['public']['Tables']['vendors']['Row']
type OrgRow = Database['public']['Tables']['organizations']['Row']

type RouteContext = { params: Promise<{ id: string; poId: string }> }

// POST /api/vendors/[id]/purchase-orders/[poId]/pdf
// Generates and streams a PDF for the given purchase order.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: vendorId, poId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: poRaw, error: poErr } = await supabase
    .from('vendor_orders')
    .select('*')
    .eq('id', poId)
    .eq('organization_id', user.org_id)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .single()

  if (poErr || !poRaw) {
    return NextResponse.json(
      { error: 'Purchase order not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const { data: vendorRaw, error: vendorErr } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .eq('organization_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (vendorErr || !vendorRaw) {
    return NextResponse.json({ error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: orgRaw, error: orgErr } = await supabase
    .from('organizations')
    .select('name, address, city, state, gstin, phone')
    .eq('id', user.org_id)
    .single()

  if (orgErr || !orgRaw) {
    return NextResponse.json(
      { error: 'Organization not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const po = poRaw as unknown as VendorOrderRow
  const vendor = vendorRaw as unknown as VendorRow
  const org = orgRaw as unknown as Pick<OrgRow, 'name' | 'address' | 'city' | 'state' | 'gstin' | 'phone'>

  const poData: POData = {
    poNumber: po.po_number,
    poDate: new Date(po.created_at),
    expectedDate: po.expected_date ? new Date(po.expected_date) : null,
    vendor: {
      name: vendor.name,
      companyName: vendor.company_name,
      address: vendor.address,
      phone: vendor.phone,
      gstin: vendor.gstin,
      email: vendor.email,
    },
    buyer: {
      name: org.name,
      address: org.address,
      city: org.city,
      state: org.state,
      gstin: org.gstin,
      phone: org.phone,
    },
    materialName: po.material_name,
    quantity: po.quantity,
    unit: po.unit,
    unitPricePaise: po.unit_price_paise,
    totalAmountPaise: po.total_amount_paise,
    paymentTermsDays: vendor.payment_terms_days,
    notes: po.notes,
  }

  try {
    const buffer = await generatePOPdf(poData)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${po.po_number}.pdf"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch (err) {
    captureWithContext(err, {
      action: 'POST /api/vendors/[id]/purchase-orders/[poId]/pdf',
      org_id: user.org_id,
      user_role: user.role,
    })
    return NextResponse.json(
      { error: 'Failed to generate PO PDF', code: 'PDF_GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
