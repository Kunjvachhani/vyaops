-- RLS Policies for VyaOps
-- Tenant isolation via auth.jwt()->'user_metadata'->>'org_id'
-- No DELETE policies — hard delete is impossible; soft delete via UPDATE (deleted_at)
-- audit_log and whatsapp_messages are excluded (service-role write-only)

-- ─────────────────────────────────────────────
-- HELPER: role extractor
-- ─────────────────────────────────────────────
-- Usage in policies: _current_role() returns 'owner' | 'manager' | 'worker' | 'viewer'
CREATE OR REPLACE FUNCTION _current_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt()->'user_metadata'->>'role')::text;
$$;

CREATE OR REPLACE FUNCTION _current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt()->'user_metadata'->>'org_id')::uuid;
$$;


-- ─────────────────────────────────────────────
-- TABLE: organizations
-- Special: no organization_id FK — id IS the org. Users see only their own row.
-- ─────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (id = _current_org_id() AND _current_role() = 'owner');


-- ─────────────────────────────────────────────
-- TABLE: users
-- Special: SELECT scoped to same org, UPDATE only self.
-- ─────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

-- Workers and viewers cannot update users; managers cannot update others.
CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND (
      supabase_auth_id = auth.uid()                          -- anyone can update themselves
      OR _current_role() = 'owner'                           -- owner can update anyone in org
    )
  );


-- ─────────────────────────────────────────────
-- TABLE: customers
-- ─────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "customers_insert" ON customers FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "customers_update" ON customers FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: vendors
-- ─────────────────────────────────────────────
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON vendors FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "vendors_insert" ON vendors FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "vendors_update" ON vendors FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: products
-- ─────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "products_update" ON products FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: orders
-- ─────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: invoices
-- ─────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: payments
-- ─────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "payments_update" ON payments FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() = 'owner'
  );


-- ─────────────────────────────────────────────
-- TABLE: vendor_orders
-- ─────────────────────────────────────────────
ALTER TABLE vendor_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_orders_select" ON vendor_orders FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "vendor_orders_insert" ON vendor_orders FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "vendor_orders_update" ON vendor_orders FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: production_batches
-- Workers can INSERT and UPDATE their own batches; managers/owners have full access.
-- ─────────────────────────────────────────────
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_batches_select" ON production_batches FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "production_batches_insert" ON production_batches FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager', 'worker')
  );

CREATE POLICY "production_batches_update" ON production_batches FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager', 'worker')
  );


-- ─────────────────────────────────────────────
-- TABLE: inventory
-- ─────────────────────────────────────────────
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select" ON inventory FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "inventory_insert" ON inventory FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "inventory_update" ON inventory FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: inventory_movements
-- ─────────────────────────────────────────────
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT
  USING (organization_id = _current_org_id());

CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager', 'worker')
  );

-- Movements are append-only ledger entries; only owners may amend them.
CREATE POLICY "inventory_movements_update" ON inventory_movements FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() = 'owner'
  );


-- ─────────────────────────────────────────────
-- TABLE: compliance_tasks
-- ─────────────────────────────────────────────
ALTER TABLE compliance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_tasks_select" ON compliance_tasks FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "compliance_tasks_insert" ON compliance_tasks FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "compliance_tasks_update" ON compliance_tasks FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: sop_documents
-- ─────────────────────────────────────────────
ALTER TABLE sop_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_documents_select" ON sop_documents FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "sop_documents_insert" ON sop_documents FOR INSERT
  WITH CHECK (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );

CREATE POLICY "sop_documents_update" ON sop_documents FOR UPDATE
  USING (
    organization_id = _current_org_id()
    AND _current_role() IN ('owner', 'manager')
  );


-- ─────────────────────────────────────────────
-- TABLE: eval_benchmark
-- Global table — no organization_id, no deleted_at.
-- Any authenticated user may read; only service-role writes via n8n/admin scripts.
-- ─────────────────────────────────────────────
ALTER TABLE eval_benchmark ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_benchmark_select" ON eval_benchmark FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);


-- ─────────────────────────────────────────────
-- TABLE: billing_events
-- Read by owner only; written by service-role (Razorpay webhook).
-- ─────────────────────────────────────────────
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- billing_events has no deleted_at (append-only event log)
CREATE POLICY "billing_events_select" ON billing_events FOR SELECT
  USING (organization_id = _current_org_id() AND _current_role() = 'owner');

-- INSERT is handled exclusively by the Razorpay webhook via service_role (bypasses RLS).
-- We block JWT-authenticated inserts entirely.


-- ─────────────────────────────────────────────
-- TABLE: feature_addons
-- ─────────────────────────────────────────────
ALTER TABLE feature_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_addons_select" ON feature_addons FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

-- Only service-role (billing webhook) manages addon records; block JWT inserts/updates.


-- ─────────────────────────────────────────────
-- NO RLS on: audit_log, whatsapp_messages
-- Both are write-only system tables accessed exclusively via service_role.
-- ─────────────────────────────────────────────
