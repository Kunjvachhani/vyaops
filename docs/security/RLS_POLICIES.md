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

## Dialect Dictionary Tables

### org_dictionary (RLS ENABLED — standard tenant isolation)
```sql
ALTER TABLE org_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select" ON org_dictionary FOR SELECT
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "insert" ON org_dictionary FOR INSERT
  WITH CHECK (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);
CREATE POLICY "update" ON org_dictionary FOR UPDATE
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);
```

### industry_dictionary (RLS ENABLED — read-only for authenticated, write via service-role)
```sql
ALTER TABLE industry_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON industry_dictionary FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);
-- No INSERT/UPDATE/DELETE policies for authenticated users. Writes via service-role only.
```

### global_dictionary (RLS ENABLED — read-only for authenticated, write via service-role)
```sql
ALTER TABLE global_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON global_dictionary FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);
-- No INSERT/UPDATE/DELETE policies for authenticated users. Writes via service-role only.
```

## Service-Role Exceptions
n8n webhooks use service_role (bypasses RLS). MUST verify signatures first.
audit_log has NO RLS — service-role writes only.
industry_dictionary and global_dictionary: RLS enabled but only SELECT policies for authenticated users. All writes via service-role (promotion logic, admin, learning module).
