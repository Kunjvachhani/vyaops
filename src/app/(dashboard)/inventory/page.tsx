import { getTranslations } from 'next-intl/server'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { FeatureGateCard } from '@/components/dashboard/feature-gate-card'
import { InventoryClient } from './_components/inventory-client'
import type { InventoryItem, InventorySummary } from './_components/inventory-client'
import type { Database } from '@/types/database'

type InventoryRow = Database['public']['Tables']['inventory']['Row']

export default async function InventoryPage() {
  const t = await getTranslations('pages.inventory')
  const user = await getCurrentUser()

  let orgTier: Tier = 'tier_1'
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', user.org_id)
      .is('deleted_at', null)
      .single()
    const row = data as { tier: string } | null
    if (row?.tier) orgTier = row.tier as Tier
  }

  const canAccess = hasAccess(orgTier, 'inventory')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      {!canAccess ? (
        <FeatureGateCard featureName={t('title')} requiredTier="tier_2" />
      ) : (
        <InventoryData orgId={user!.org_id} />
      )}
    </div>
  )
}

async function InventoryData({ orgId }: { orgId: string }) {
  const t = await getTranslations('pages.inventory')
  const supabase = await createClient()

  const { data: rawData, error } = await supabase
    .from('inventory')
    .select('*, products(id, name)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('item_type')
    .order('item_name')

  if (error) {
    return (
      <p className="text-sm text-destructive">{t('loadError')}</p>
    )
  }

  type InventoryWithProduct = InventoryRow & {
    products: { id: string; name: string } | null
  }

  const allRows = (rawData as unknown as InventoryWithProduct[]) ?? []

  const items: InventoryItem[] = allRows.map((row) => ({
    id: row.id,
    item_name: row.item_name,
    item_type: row.item_type,
    current_quantity: row.current_quantity,
    unit: row.unit,
    reorder_level: row.reorder_level,
    is_low_stock: row.current_quantity <= row.reorder_level,
    product_id: row.product_id,
    product_name: row.products?.name ?? null,
    last_restocked_at: row.last_restocked_at,
  }))

  const summary: InventorySummary = {
    total_items: items.length,
    low_stock_count: items.filter((i) => i.is_low_stock).length,
    raw_material_count: items.filter((i) => i.item_type === 'raw_material').length,
    finished_good_count: items.filter((i) => i.item_type === 'finished_good').length,
  }

  return <InventoryClient initialItems={items} summary={summary} />
}
