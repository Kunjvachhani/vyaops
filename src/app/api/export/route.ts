import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { captureWithContext } from '@/lib/utils/sentry'

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can export data', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const orgId = user.org_id

    // Fetch all tables for this org in parallel. Soft-deleted records are included
    // so the export is a complete audit trail.
    const [
      orgResult,
      usersResult,
      customersResult,
      vendorsResult,
      productsResult,
      ordersResult,
      invoicesResult,
      paymentsResult,
      vendorOrdersResult,
      productionBatchesResult,
      inventoryResult,
      complianceResult,
      sopResult,
    ] = await Promise.all([
      adminClient.from('organizations').select('*').eq('id', orgId).single(),
      adminClient.from('users').select('*').eq('organization_id', orgId),
      adminClient.from('customers').select('*').eq('organization_id', orgId),
      adminClient.from('vendors').select('*').eq('organization_id', orgId),
      adminClient.from('products').select('*').eq('organization_id', orgId),
      adminClient.from('orders').select('*').eq('organization_id', orgId),
      adminClient.from('invoices').select('*').eq('organization_id', orgId),
      adminClient.from('payments').select('*').eq('organization_id', orgId),
      adminClient.from('vendor_orders').select('*').eq('organization_id', orgId),
      adminClient.from('production_batches').select('*').eq('organization_id', orgId),
      adminClient.from('inventory').select('*').eq('organization_id', orgId),
      adminClient.from('compliance_tasks').select('*').eq('organization_id', orgId),
      adminClient.from('sop_documents').select('*').eq('organization_id', orgId),
    ])

    const exportPayload = {
      exported_at: new Date().toISOString(),
      exported_by: user.id,
      organization: orgResult.data,
      users: usersResult.data ?? [],
      customers: customersResult.data ?? [],
      vendors: vendorsResult.data ?? [],
      products: productsResult.data ?? [],
      orders: ordersResult.data ?? [],
      invoices: invoicesResult.data ?? [],
      payments: paymentsResult.data ?? [],
      vendor_orders: vendorOrdersResult.data ?? [],
      production_batches: productionBatchesResult.data ?? [],
      inventory: inventoryResult.data ?? [],
      compliance_tasks: complianceResult.data ?? [],
      sop_documents: sopResult.data ?? [],
    }

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vyaops-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    captureWithContext(err instanceof Error ? err : new Error(String(err)), {
      action: 'GET /api/export',
      org_id: user.org_id,
    })
    return NextResponse.json(
      { error: 'Export failed', code: 'EXPORT_ERROR' },
      { status: 500 }
    )
  }
}
