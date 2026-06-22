import { adminClient } from '@/lib/supabase/admin'
import type { AuditSource } from '@/lib/utils/audit'

/**
 * Centralised soft-delete / restore helpers.
 *
 * CLAUDE.md security rule #2: NEVER hard delete any record. Every "delete" in
 * the application flows through {@link softDelete}, which only stamps
 * `deleted_at`. Recovery flows through {@link restore}.
 *
 * Both verify org ownership before touching a row and write an audit_log entry
 * (SOFT_DELETE / RESTORE) via the service-role client.
 */

// Tables that carry BOTH `organization_id` and `deleted_at` and are safe to
// soft-delete through this helper. Service-role-only tables (audit_log,
// whatsapp_*, *_dictionary) are intentionally excluded, as are tables with
// their own lifecycle (org_dictionary, corrections, payments, pending_orders,
// feature_addons, users).
export const SOFT_DELETABLE_TABLES = [
  'orders',
  'invoices',
  'customers',
  'vendors',
  'products',
  'production_batches',
  'inventory',
  'sop_documents',
  'compliance_tasks',
  'vendor_orders',
] as const

export type SoftDeletableTable = (typeof SOFT_DELETABLE_TABLES)[number]

export function isSoftDeletableTable(table: string): table is SoftDeletableTable {
  return (SOFT_DELETABLE_TABLES as readonly string[]).includes(table)
}

export type SoftDeleteErrorCode =
  | 'INVALID_TABLE'
  | 'NOT_FOUND'
  | 'ALREADY_DELETED'
  | 'NOT_DELETED'
  | 'DB_ERROR'

export class SoftDeleteError extends Error {
  readonly code: SoftDeleteErrorCode
  constructor(code: SoftDeleteErrorCode, message: string) {
    super(message)
    this.name = 'SoftDeleteError'
    this.code = code
  }
}

type MutateOptions = {
  /** Where the action originated. Defaults to 'web'. */
  source?: AuditSource
  /** Caller IP, stored on the audit entry. */
  ip?: string
}

async function writeAudit(
  table: SoftDeletableTable,
  id: string,
  orgId: string,
  userId: string | null,
  action: 'SOFT_DELETE' | 'RESTORE',
  source: AuditSource
): Promise<void> {
  const deletedAtChange =
    action === 'SOFT_DELETE'
      ? { old_value: null, new_value: 'now()' }
      : { old_value: 'set', new_value: null }

  const { error } = await adminClient.from('audit_log').insert({
    organization_id: orgId,
    table_name: table,
    record_id: id,
    action,
    changed_by: userId,
    changed_by_source: source,
    old_values: { deleted_at: deletedAtChange.old_value },
    new_values: { deleted_at: deletedAtChange.new_value },
  })

  if (error) {
    // Wire to Sentry.captureException once @sentry/nextjs is installed.
    console.error('[soft-delete] Failed to write audit_log entry', {
      supabaseError: error,
      table,
      action,
    })
  }
}

/**
 * Soft-delete a record by stamping `deleted_at = now()`.
 *
 * Verifies the row exists and belongs to `orgId` before mutating. Idempotent:
 * deleting an already-deleted row throws ALREADY_DELETED rather than touching it.
 */
export async function softDelete(
  table: string,
  id: string,
  orgId: string,
  userId: string | null,
  options: MutateOptions = {}
): Promise<void> {
  if (!isSoftDeletableTable(table)) {
    throw new SoftDeleteError('INVALID_TABLE', `Table '${table}' is not soft-deletable`)
  }
  const source = options.source ?? 'web'

  // Verify ownership + current state before mutating.
  const { data: existing, error: fetchErr } = await adminClient
    .from(table)
    .select('id, deleted_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (fetchErr) {
    throw new SoftDeleteError('DB_ERROR', fetchErr.message)
  }
  const row = existing as { id: string; deleted_at: string | null } | null
  if (!row) {
    throw new SoftDeleteError('NOT_FOUND', `Record not found in '${table}'`)
  }
  if (row.deleted_at !== null) {
    throw new SoftDeleteError('ALREADY_DELETED', 'Record is already deleted')
  }

  const { error: updateErr } = await adminClient
    .from(table)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (updateErr) {
    throw new SoftDeleteError('DB_ERROR', updateErr.message)
  }

  await writeAudit(table, id, orgId, userId, 'SOFT_DELETE', source)
}

/**
 * Restore a soft-deleted record by clearing `deleted_at`.
 *
 * Verifies the row exists, belongs to `orgId`, and is currently deleted.
 */
export async function restore(
  table: string,
  id: string,
  orgId: string,
  userId: string | null,
  options: MutateOptions = {}
): Promise<void> {
  if (!isSoftDeletableTable(table)) {
    throw new SoftDeleteError('INVALID_TABLE', `Table '${table}' is not soft-deletable`)
  }
  const source = options.source ?? 'web'

  const { data: existing, error: fetchErr } = await adminClient
    .from(table)
    .select('id, deleted_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (fetchErr) {
    throw new SoftDeleteError('DB_ERROR', fetchErr.message)
  }
  const row = existing as { id: string; deleted_at: string | null } | null
  if (!row) {
    throw new SoftDeleteError('NOT_FOUND', `Record not found in '${table}'`)
  }
  if (row.deleted_at === null) {
    throw new SoftDeleteError('NOT_DELETED', 'Record is not deleted')
  }

  const { error: updateErr } = await adminClient
    .from(table)
    .update({ deleted_at: null } as never)
    .eq('id', id)
    .eq('organization_id', orgId)

  if (updateErr) {
    throw new SoftDeleteError('DB_ERROR', updateErr.message)
  }

  await writeAudit(table, id, orgId, userId, 'RESTORE', source)
}
