import { adminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export interface AuditEntry {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  before?: Json
  after?: Json
  ipAddress?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await adminClient.from('audit_log').insert({
    organization_id: entry.organizationId,
    user_id: entry.userId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip_address: entry.ipAddress ?? null,
  })

  if (error) {
    console.error('[audit] Failed to write audit log:', error)
  }
}
