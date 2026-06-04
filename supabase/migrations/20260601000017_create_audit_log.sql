-- Immutable record of every data change across the platform.
-- APPEND-ONLY: no updated_at, no deleted_at, no trigger.
-- RLS is NOT enabled — written exclusively via service-role through src/lib/utils/audit.ts.
-- organization_id is raw UUID (no FK constraint) so log survives if org is deleted.

CREATE TABLE audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL,
  table_name        TEXT        NOT NULL,
  record_id         UUID        NOT NULL,
  action            TEXT        NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE')),
  changed_by        UUID,
  changed_by_source TEXT        NOT NULL
                                  CHECK (changed_by_source IN ('whatsapp', 'web', 'api', 'scheduled', 'system')),
  old_values        JSONB,
  new_values        JSONB,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by) WHERE changed_by IS NOT NULL;
