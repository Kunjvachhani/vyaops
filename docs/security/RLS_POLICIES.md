# Row-Level Security Policies — VyaOps

## Principle
Every table with organization_id gets RLS. Users ONLY access their org's data. Enforced at PostgreSQL level.

## Tenant ID from JWT
```sql
(auth.jwt() -> 'user_metadata' ->> 'org_id')::uuid
```

## Standard Policy (every tenant table)
```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select" ON [table] FOR SELECT
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid AND deleted_at IS NULL);

CREATE POLICY "insert" ON [table] FOR INSERT
  WITH CHECK (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);

CREATE POLICY "update" ON [table] FOR UPDATE
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);
-- NO DELETE POLICY = hard delete impossible
```

## Role Restrictions
- worker: INSERT production_batches only. SELECT on most tables.
- manager: INSERT/UPDATE orders, invoices, customers, vendors, production.
- owner: Full access including soft-delete.

## Service-Role Exceptions
n8n webhooks use service_role (bypasses RLS). MUST verify signatures first.
audit_log has NO RLS — service-role writes only.
