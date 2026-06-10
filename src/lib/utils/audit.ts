import { adminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export type AuditAction =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'restore'
  | 'status_change'

export type AuditEntityType =
  | 'order'
  | 'invoice'
  | 'customer'
  | 'vendor'
  | 'product'
  | 'production_batch'
  | 'inventory'
  | 'user'
  | 'organization'

export type AuditSource = 'whatsapp' | 'web' | 'api' | 'scheduled' | 'system'

export type Change = {
  field: string
  old_value: unknown
  new_value: unknown
}

export type AuditEntry = {
  organization_id: string
  user_id?: string  // omit for system/WhatsApp actions — stored as NULL in audit_log
  action: AuditAction
  entity_type: AuditEntityType
  entity_id: string
  changes: Change[]
  metadata?: Record<string, unknown>
  ip_address?: string
}

const TABLE_NAME: Record<AuditEntityType, string> = {
  order: 'orders',
  invoice: 'invoices',
  customer: 'customers',
  vendor: 'vendors',
  product: 'products',
  production_batch: 'production_batches',
  inventory: 'inventory',
  user: 'users',
  organization: 'organizations',
}

const DB_ACTION: Record<AuditAction, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  soft_delete: 'SOFT_DELETE',
  restore: 'RESTORE',
  status_change: 'UPDATE',
}

const IGNORED_FIELDS = new Set(['updated_at'])

export function diffChanges(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>
): Change[] {
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])
  const changes: Change[] = []

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue
    const oldVal = oldRecord[key]
    const newVal = newRecord[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, old_value: oldVal, new_value: newVal })
    }
  }

  return changes
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const oldValues =
    entry.changes.length > 0
      ? Object.fromEntries(entry.changes.map((c) => [c.field, c.old_value]))
      : null

  const newValues =
    entry.changes.length > 0
      ? Object.fromEntries(entry.changes.map((c) => [c.field, c.new_value]))
      : null

  const source: AuditSource =
    entry.metadata?.via_whatsapp === true ? 'whatsapp' : 'web'

  const { error } = await adminClient.from('audit_log').insert({
    organization_id: entry.organization_id,
    table_name: TABLE_NAME[entry.entity_type],
    record_id: entry.entity_id,
    action: DB_ACTION[entry.action],
    changed_by: entry.user_id ?? null,
    changed_by_source: source,
    old_values: oldValues as Json,
    new_values: newValues as Json,
    ip_address: entry.ip_address ?? null,
  })

  if (error) {
    // Wire to Sentry.captureException once @sentry/nextjs is installed.
    console.error('[audit] Failed to write audit_log entry', {
      supabaseError: error,
      entity_type: entry.entity_type,
      action: entry.action,
    })
  }
}

export async function withAudit<T>(
  action: () => Promise<T>,
  auditParams: AuditEntry
): Promise<T> {
  const result = await action()
  void logAudit(auditParams)
  return result
}
