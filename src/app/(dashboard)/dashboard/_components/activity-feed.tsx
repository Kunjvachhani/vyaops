import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatIST } from '@/lib/utils/date'
import type { Database, Json } from '@/types/database'

type AuditRow = Pick<
  Database['public']['Tables']['audit_log']['Row'],
  'id' | 'action' | 'table_name' | 'record_id' | 'changed_by' | 'changed_by_source' | 'new_values' | 'created_at'
>

const FEED_LIMIT = 20

// audit_log DB action → translation key under `activity.verb`.
const VERB_KEY: Record<string, string> = {
  CREATE: 'create',
  UPDATE: 'update',
  SOFT_DELETE: 'delete',
  RESTORE: 'restore',
}

// audit_log table_name → translation key under `activity.entity`.
const ENTITY_KEY: Record<string, string> = {
  orders: 'order',
  invoices: 'invoice',
  customers: 'customer',
  vendors: 'vendor',
  vendor_orders: 'vendorOrder',
  products: 'product',
  production_batches: 'batch',
  inventory: 'inventory',
  users: 'user',
  organizations: 'organization',
}

// Non-system actor sources get a friendly label when there's no named user.
const SOURCE_KEY: Record<string, string> = {
  whatsapp: 'whatsapp',
  system: 'system',
  api: 'api',
  scheduled: 'scheduled',
  platform_admin: 'platformAdmin',
}

// Human-readable reference pulled from the audited row's new values, in priority order.
const REF_FIELDS = [
  'order_number',
  'invoice_number',
  'po_number',
  'batch_number',
  'item_name',
  'name',
]

function extractRef(newValues: Json | null): string {
  if (newValues && typeof newValues === 'object' && !Array.isArray(newValues)) {
    const obj = newValues as Record<string, unknown>
    for (const field of REF_FIELDS) {
      const v = obj[field]
      if (typeof v === 'string' && v.length > 0) {
        return field.endsWith('_number') ? `#${v}` : v
      }
    }
  }
  return ''
}

export async function ActivityFeed() {
  const t = await getTranslations('pages.dashboard.activity')
  const user = await getCurrentUser()
  if (!user) return null

  // audit_log is service-role-only (RLS disabled) — read it via adminClient,
  // strictly scoped to this owner's organization.
  const { data: rawRows } = await adminClient
    .from('audit_log')
    .select('id, action, table_name, record_id, changed_by, changed_by_source, new_values, created_at')
    .eq('organization_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)

  const rows = (rawRows as AuditRow[] | null) ?? []

  // Resolve actor names in one query.
  const actorIds = [...new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v))]
  const nameById = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: usersRaw } = await adminClient
      .from('users')
      .select('id, full_name')
      .in('id', actorIds)
    const users = (usersRaw as { id: string; full_name: string }[] | null) ?? []
    for (const u of users) nameById.set(u.id, u.full_name)
  }

  function actorName(row: AuditRow): string {
    if (row.changed_by && nameById.has(row.changed_by)) {
      return nameById.get(row.changed_by) as string
    }
    const sourceKey = SOURCE_KEY[row.changed_by_source]
    return sourceKey ? t(`sources.${sourceKey}`) : t('sources.system')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const verbKey = VERB_KEY[row.action] ?? 'update'
              const entityKey = ENTITY_KEY[row.table_name] ?? 'record'
              const ref = extractRef(row.new_values)
              return (
                <li key={row.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{actorName(row)}</span>{' '}
                      {t(`verbs.${verbKey}`)}{' '}
                      <span className="text-muted-foreground">
                        {t(`entity.${entityKey}`)}
                        {ref ? ` ${ref}` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatIST(new Date(row.created_at))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
