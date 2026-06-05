import { adminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export type AuditSource = 'whatsapp' | 'web' | 'api' | 'scheduled' | 'system'
export type AuditAction = 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'RESTORE'

export interface AuditEntry {
  organizationId: string
  tableName: string
  recordId: string
  action: AuditAction
  changedBy?: string | null
  changedBySource: AuditSource
  oldValues?: Json
  newValues?: Json
  ipAddress?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await adminClient.from('audit_log').insert({
    organization_id: entry.organizationId,
    table_name: entry.tableName,
    record_id: entry.recordId,
    action: entry.action,
    changed_by: entry.changedBy ?? null,
    changed_by_source: entry.changedBySource,
    old_values: entry.oldValues ?? null,
    new_values: entry.newValues ?? null,
    ip_address: entry.ipAddress ?? null,
  })

  if (error) {
    console.error('[audit] Failed to write audit log:', error)
  }
}
