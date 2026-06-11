-- Seed data for VyaOps local development
-- Tenant: Shree Ambica Engineering, Rajkot foundry (tier_2)
-- Run: npx supabase db reset   (applies migrations then this file)
-- All amounts in paise (₹1 = 100 paise). All timestamps UTC.

DO $$
DECLARE
  -- Organization
  v_org_id     UUID := gen_random_uuid();

  -- Users
  v_owner_id   UUID := gen_random_uuid();
  v_manager_id UUID := gen_random_uuid();
  v_worker_id  UUID := gen_random_uuid();

  -- Customers (10)
  v_cust1_id   UUID := gen_random_uuid(); -- Rajesh Patel,   Rajkot
  v_cust2_id   UUID := gen_random_uuid(); -- Dharmesh Shah,  Ahmedabad
  v_cust3_id   UUID := gen_random_uuid(); -- Vijay Mehta,    Morbi
  v_cust4_id   UUID := gen_random_uuid(); -- Haresh Kumar,   Jamnagar
  v_cust5_id   UUID := gen_random_uuid(); -- Suresh Solanki, Rajkot
  v_cust6_id   UUID := gen_random_uuid(); -- Jignesh Patel,  Ahmedabad
  v_cust7_id   UUID := gen_random_uuid(); -- Manish Trivedi, Rajkot
  v_cust8_id   UUID := gen_random_uuid(); -- Bhavesh Gohil,  Morbi
  v_cust9_id   UUID := gen_random_uuid(); -- Nilesh Chauhan, Jamnagar
  v_cust10_id  UUID := gen_random_uuid(); -- Ketan Vora,     Rajkot

  -- Vendors (5)
  v_vendor1_id UUID := gen_random_uuid(); -- Ambuja Steel Traders
  v_vendor2_id UUID := gen_random_uuid(); -- Jamnagar Metals Pvt Ltd
  v_vendor3_id UUID := gen_random_uuid(); -- Rajkot Iron Works
  v_vendor4_id UUID := gen_random_uuid(); -- Gujarat Sand & Minerals
  v_vendor5_id UUID := gen_random_uuid(); -- Saurashtra Alloys

  -- Products (8) — unit_price_paise = rupees x 100
  v_prod1_id   UUID := gen_random_uuid(); -- Valve Body       Rs.1,500
  v_prod2_id   UUID := gen_random_uuid(); -- Pump Housing     Rs.3,500
  v_prod3_id   UUID := gen_random_uuid(); -- Bearing Cap        Rs.800
  v_prod4_id   UUID := gen_random_uuid(); -- Impeller         Rs.2,500
  v_prod5_id   UUID := gen_random_uuid(); -- Flange             Rs.600
  v_prod6_id   UUID := gen_random_uuid(); -- Coupling           Rs.450
  v_prod7_id   UUID := gen_random_uuid(); -- Bracket            Rs.300
  v_prod8_id   UUID := gen_random_uuid(); -- Gear Box Housing Rs.5,000

  -- Orders (20)
  v_ord1_id    UUID := gen_random_uuid();
  v_ord2_id    UUID := gen_random_uuid();
  v_ord3_id    UUID := gen_random_uuid();
  v_ord4_id    UUID := gen_random_uuid();
  v_ord5_id    UUID := gen_random_uuid();
  v_ord6_id    UUID := gen_random_uuid();
  v_ord7_id    UUID := gen_random_uuid();
  v_ord8_id    UUID := gen_random_uuid();
  v_ord9_id    UUID := gen_random_uuid();
  v_ord10_id   UUID := gen_random_uuid();
  v_ord11_id   UUID := gen_random_uuid();
  v_ord12_id   UUID := gen_random_uuid();
  v_ord13_id   UUID := gen_random_uuid();
  v_ord14_id   UUID := gen_random_uuid();
  v_ord15_id   UUID := gen_random_uuid();
  v_ord16_id   UUID := gen_random_uuid();
  v_ord17_id   UUID := gen_random_uuid();
  v_ord18_id   UUID := gen_random_uuid();
  v_ord19_id   UUID := gen_random_uuid();
  v_ord20_id   UUID := gen_random_uuid();

  -- Invoices (5)
  v_inv1_id    UUID := gen_random_uuid();
  v_inv2_id    UUID := gen_random_uuid();
  v_inv3_id    UUID := gen_random_uuid();
  v_inv4_id    UUID := gen_random_uuid();
  v_inv5_id    UUID := gen_random_uuid();

BEGIN

-- ============================================================
-- ORGANIZATION
-- ============================================================
INSERT INTO organizations (
  id, name, gstin, address, city, state,
  phone, email, industry_config, tier, billing_status,
  whatsapp_phone, whatsapp_phone_number_id, whatsapp_display_number,
  whatsapp_connected, auto_mode_enabled,
  language_preference, timezone, onboarded_at
) VALUES (
  v_org_id,
  'Shree Ambica Engineering',
  '24AABSA1234A1Z5',
  '42, GIDC Industrial Estate, Metoda',
  'Rajkot',
  'Gujarat',
  '919876543210',
  'info@shreeambica.com',
  'foundry',
  'tier_2',
  'active',
  '919876543210',
  'TEST_PHONE_NUMBER_ID',    -- replace with real Meta Phone Number ID before going live
  '919876543210',            -- normalized display number (no +)
  TRUE,
  FALSE,
  'gu',
  'Asia/Kolkata',
  now() - INTERVAL '30 days'
);

-- ============================================================
-- USERS (3)
-- ============================================================
INSERT INTO users (id, organization_id, email, phone, full_name, role, is_active) VALUES
  (v_owner_id,   v_org_id, 'jayesh@test.com', '919876543211', 'Jayesh Patel',  'owner',   TRUE),
  (v_manager_id, v_org_id, 'ramesh@test.com', '919876543212', 'Ramesh Desai',  'manager', TRUE),
  (v_worker_id,  v_org_id, 'kiran@test.com',  '919876543213', 'Kiran Solanki', 'worker',  TRUE);

-- ============================================================
-- CUSTOMERS (10) — aliases drive WhatsApp name fuzzy matching
-- ============================================================
INSERT INTO customers (
  id, organization_id, name, company_name, aliases,
  phone, email, gstin, address, payment_terms_days
) VALUES
  (v_cust1_id,  v_org_id, 'Rajesh Patel',   'Patel Engineering Works',   ARRAY['rajesh','rajubhai','raju patel','patel saheb'],    '919824100001', 'rajesh@patel-eng.com',      '24AABCP1234A1Z5', '12, Kalawad Road, Rajkot',          30),
  (v_cust2_id,  v_org_id, 'Dharmesh Shah',  'Shah Industries Pvt Ltd',   ARRAY['dharmu','dharmesh','shah saheb','dharmbhai'],       '919824100002', 'dharmu@shah-ind.com',       '24AABCS2345B1Z3', '45, Sardar Patel Nagar, Ahmedabad',  45),
  (v_cust3_id,  v_org_id, 'Vijay Mehta',    'Mehta Metal Works',         ARRAY['vijay','vijaybhai','mehta','vijay mehta'],          '919824100003', 'vijay@mehta-metals.com',    '24AABCM3456C1Z7', '8, Ceramic Zone, Morbi',             30),
  (v_cust4_id,  v_org_id, 'Haresh Kumar',   'Kumar Pumps & Equipment',   ARRAY['haresh','harubhai','kumar saheb','hareshbhai'],     '919824100004', 'haresh@kumarpumps.com',     '24AABCK4567D1Z1', '22, Bedi Port Road, Jamnagar',        60),
  (v_cust5_id,  v_org_id, 'Suresh Solanki', 'Solanki Engineering',       ARRAY['suresh','sureshbhai','solanki','suresh solanki'],   '919824100005', 'suresh@solanki-eng.com',    '24AABCS5678E1Z9', '3, Gondal Road, Rajkot',             30),
  (v_cust6_id,  v_org_id, 'Jignesh Patel',  'JP Industries',             ARRAY['jigna','jignesh','jp','jignesh patel'],             '919824100006', 'jignesh@jp-ind.com',        '24AABCJ6789F1Z8', '101, SG Highway, Ahmedabad',          45),
  (v_cust7_id,  v_org_id, 'Manish Trivedi', 'Trivedi Valves & Fittings', ARRAY['manish','manishbhai','trivedi','manu'],             '919824100007', 'manish@trivedi-valves.com', '24AABCT7890G1Z6', '15, 150 Ft Ring Road, Rajkot',        30),
  (v_cust8_id,  v_org_id, 'Bhavesh Gohil',  'Gohil Castings Ltd',        ARRAY['bhavesh','bhaveshbhai','gohil','bhavu'],            '919824100008', 'bhavesh@gohil-cast.com',    '24AABCG8901H1Z4', '5, Sanala Road, Morbi',               60),
  (v_cust9_id,  v_org_id, 'Nilesh Chauhan', 'Chauhan Fittings',          ARRAY['nilesh','nileshbhai','chauhan','nilu'],             '919824100009', 'nilesh@chauhan-fit.com',    '24AABCC9012I1Z2', '34, Digvijay Plot, Jamnagar',         30),
  (v_cust10_id, v_org_id, 'Ketan Vora',     'Vora Machinery & Tools',    ARRAY['ketan','ketanbhai','vora','ketan vora'],            '919824100010', 'ketan@vora-mach.com',       '24AABCV0123J1Z0', '7, Mavdi Road, Rajkot',              45);

-- ============================================================
-- VENDORS (5) — GSTIN: 24 (Gujarat) + PAN-derived pattern
-- ============================================================
INSERT INTO vendors (
  id, organization_id, name, company_name, aliases,
  phone, gstin, address, materials_supplied, payment_terms_days, rating
) VALUES
  (v_vendor1_id, v_org_id,
   'Ambuja Steel Traders', NULL,
   ARRAY['ambuja','ambuja steel'],
   '919825200001', '24AABCA1234A1Z5',
   'Plot 12, GIDC, Rajkot',
   ARRAY['CI Round Bar','MS Flat','MS Round Bar'],
   15, 4.2),

  (v_vendor2_id, v_org_id,
   'Jamnagar Metals Pvt Ltd', 'Jamnagar Metals Pvt Ltd',
   ARRAY['jamnagar metals','jm metals'],
   '919825200002', '24AACJM5678B1Z3',
   '23, Bedi Port Rd, Jamnagar',
   ARRAY['Brass Rod','Copper Pipe','Aluminium Ingot'],
   30, 4.5),

  (v_vendor3_id, v_org_id,
   'Rajkot Iron Works', NULL,
   ARRAY['riw','rajkot iron'],
   '919825200003', '24AACRJ9012C1Z8',
   '5, Aji GIDC, Rajkot',
   ARRAY['Cast Iron Scrap','Pig Iron','Ferro Silicon'],
   15, 3.8),

  (v_vendor4_id, v_org_id,
   'Gujarat Sand & Minerals', 'Gujarat Sand & Minerals Ltd',
   ARRAY['gujarat sand','gsm'],
   '919825200004', '24AACGS3456D1Z2',
   '89, Kathwada, Ahmedabad',
   ARRAY['Green Sand','Silica Sand','Bentonite'],
   30, 4.0),

  (v_vendor5_id, v_org_id,
   'Saurashtra Alloys', NULL,
   ARRAY['saurashtra alloys','sa metals'],
   '919825200005', '24AACSA7890E1Z7',
   '17, Mavdi GIDC, Rajkot',
   ARRAY['Alloy Steel','Spring Steel','EN8 Rod'],
   30, 4.3);

-- ============================================================
-- PRODUCTS (8) — unit_price_paise = rupees x 100
-- HSN codes from GST schedule for industrial castings/machinery
-- ============================================================
INSERT INTO products (
  id, organization_id, name, code, aliases,
  category, unit, unit_price_paise, hsn_code, reorder_level
) VALUES
  (v_prod1_id, v_org_id,
   'Valve Body', 'VB-001',
   ARRAY['valve body','valve','vb','valve bodi'],
   'Casting', 'pieces', 150000, '8481', 50),

  (v_prod2_id, v_org_id,
   'Pump Housing', 'PH-001',
   ARRAY['pump housing','pump body','pump casing'],
   'Casting', 'pieces', 350000, '8413', 20),

  (v_prod3_id, v_org_id,
   'Bearing Cap', 'BC-001',
   ARRAY['bearing cap','bc','bearing cover'],
   'Machining', 'pieces', 80000, '8483', 100),

  (v_prod4_id, v_org_id,
   'Impeller', 'IMP-001',
   ARRAY['impeller','imp','impellar'],
   'Casting', 'pieces', 250000, '8413', 30),

  (v_prod5_id, v_org_id,
   'Flange', 'FL-001',
   ARRAY['flange','fl','flanges'],
   'Machining', 'pieces', 60000, '7307', 200),

  (v_prod6_id, v_org_id,
   'Coupling', 'COP-001',
   ARRAY['coupling','cop','couplings'],
   'Assembly', 'pieces', 45000, '8483', 150),

  (v_prod7_id, v_org_id,
   'Bracket', 'BRK-001',
   ARRAY['bracket','brk','brackets','brecket'],
   'Casting', 'pieces', 30000, '8302', 200),

  (v_prod8_id, v_org_id,
   'Gear Box Housing', 'GBH-001',
   ARRAY['gear box','gearbox','gbh','gear box housing'],
   'Casting', 'pieces', 500000, '8483', 10);

-- ============================================================
-- ORDERS (20)
-- Draft (3):         ORD-2605-001..003
-- Confirmed (5):     ORD-2605-004..008
-- In-production (5): ORD-2605-009..013  — partial quantity_produced
-- Completed (4):     ORD-2605-014..017  — quantity_produced = quantity
-- Dispatched (3):    ORD-2605-018..020  — quantity_dispatched = quantity
-- total_amount_paise = quantity x unit_price_paise (excl. GST; GST on invoice)
-- ============================================================

-- DRAFT
INSERT INTO orders (
  id, organization_id, order_number,
  customer_id, product_id, quantity, unit_price_paise, total_amount_paise,
  status, delivery_date, source, idempotency_key, created_at
) VALUES
  (v_ord1_id, v_org_id, 'ORD-2605-001',
   v_cust1_id, v_prod1_id, 50, 150000, 7500000,
   'draft', CURRENT_DATE + 30, 'whatsapp', 'seed-ord-001', now() - INTERVAL '2 days'),

  (v_ord2_id, v_org_id, 'ORD-2605-002',
   v_cust2_id, v_prod2_id, 10, 350000, 3500000,
   'draft', CURRENT_DATE + 45, 'web', 'seed-ord-002', now() - INTERVAL '1 day'),

  (v_ord3_id, v_org_id, 'ORD-2605-003',
   v_cust3_id, v_prod5_id, 100, 60000, 6000000,
   'draft', CURRENT_DATE + 20, 'manual', 'seed-ord-003', now() - INTERVAL '3 hours');

-- CONFIRMED
INSERT INTO orders (
  id, organization_id, order_number,
  customer_id, product_id, quantity, unit_price_paise, total_amount_paise,
  status, delivery_date, source, idempotency_key, created_at
) VALUES
  (v_ord4_id, v_org_id, 'ORD-2605-004',
   v_cust4_id, v_prod3_id, 30, 80000, 2400000,
   'confirmed', CURRENT_DATE + 25, 'whatsapp', 'seed-ord-004', now() - INTERVAL '5 days'),

  (v_ord5_id, v_org_id, 'ORD-2605-005',
   v_cust5_id, v_prod1_id, 25, 150000, 3750000,
   'confirmed', CURRENT_DATE + 30, 'whatsapp', 'seed-ord-005', now() - INTERVAL '4 days'),

  (v_ord6_id, v_org_id, 'ORD-2605-006',
   v_cust6_id, v_prod4_id, 15, 250000, 3750000,
   'confirmed', CURRENT_DATE + 35, 'web', 'seed-ord-006', now() - INTERVAL '3 days'),

  (v_ord7_id, v_org_id, 'ORD-2605-007',
   v_cust7_id, v_prod6_id, 60, 45000, 2700000,
   'confirmed', CURRENT_DATE + 28, 'whatsapp', 'seed-ord-007', now() - INTERVAL '2 days'),

  (v_ord8_id, v_org_id, 'ORD-2605-008',
   v_cust8_id, v_prod7_id, 200, 30000, 6000000,
   'confirmed', CURRENT_DATE + 40, 'manual', 'seed-ord-008', now() - INTERVAL '1 day');

-- IN-PRODUCTION — quantity_produced reflects partial shop-floor progress
INSERT INTO orders (
  id, organization_id, order_number,
  customer_id, product_id, quantity, unit_price_paise, total_amount_paise,
  status, delivery_date, quantity_produced,
  source, idempotency_key, created_at
) VALUES
  (v_ord9_id, v_org_id, 'ORD-2605-009',
   v_cust9_id, v_prod8_id, 5, 500000, 2500000,
   'in_production', CURRENT_DATE + 10, 3,
   'whatsapp', 'seed-ord-009', now() - INTERVAL '10 days'),

  (v_ord10_id, v_org_id, 'ORD-2605-010',
   v_cust10_id, v_prod1_id, 40, 150000, 6000000,
   'in_production', CURRENT_DATE + 8, 35,
   'whatsapp', 'seed-ord-010', now() - INTERVAL '12 days'),

  (v_ord11_id, v_org_id, 'ORD-2605-011',
   v_cust1_id, v_prod2_id, 8, 350000, 2800000,
   'in_production', CURRENT_DATE + 15, 5,
   'web', 'seed-ord-011', now() - INTERVAL '8 days'),

  (v_ord12_id, v_org_id, 'ORD-2605-012',
   v_cust2_id, v_prod5_id, 75, 60000, 4500000,
   'in_production', CURRENT_DATE + 7, 40,
   'whatsapp', 'seed-ord-012', now() - INTERVAL '9 days'),

  (v_ord13_id, v_org_id, 'ORD-2605-013',
   v_cust3_id, v_prod3_id, 20, 80000, 1600000,
   'in_production', CURRENT_DATE + 5, 15,
   'whatsapp', 'seed-ord-013', now() - INTERVAL '7 days');

-- COMPLETED — quantity_produced = quantity (order fully produced)
INSERT INTO orders (
  id, organization_id, order_number,
  customer_id, product_id, quantity, unit_price_paise, total_amount_paise,
  status, delivery_date, quantity_produced,
  source, idempotency_key, created_at
) VALUES
  (v_ord14_id, v_org_id, 'ORD-2605-014',
   v_cust4_id, v_prod4_id, 12, 250000, 3000000,
   'completed', CURRENT_DATE - 5, 12,
   'whatsapp', 'seed-ord-014', now() - INTERVAL '25 days'),

  (v_ord15_id, v_org_id, 'ORD-2605-015',
   v_cust5_id, v_prod6_id, 50, 45000, 2250000,
   'completed', CURRENT_DATE - 3, 50,
   'web', 'seed-ord-015', now() - INTERVAL '20 days'),

  (v_ord16_id, v_org_id, 'ORD-2605-016',
   v_cust6_id, v_prod1_id, 30, 150000, 4500000,
   'completed', CURRENT_DATE - 7, 30,
   'whatsapp', 'seed-ord-016', now() - INTERVAL '30 days'),

  (v_ord17_id, v_org_id, 'ORD-2605-017',
   v_cust7_id, v_prod7_id, 150, 30000, 4500000,
   'completed', CURRENT_DATE - 2, 150,
   'manual', 'seed-ord-017', now() - INTERVAL '18 days');

-- DISPATCHED — quantity_produced = quantity_dispatched = quantity
INSERT INTO orders (
  id, organization_id, order_number,
  customer_id, product_id, quantity, unit_price_paise, total_amount_paise,
  status, delivery_date, quantity_produced, quantity_dispatched,
  source, idempotency_key, created_at
) VALUES
  (v_ord18_id, v_org_id, 'ORD-2605-018',
   v_cust8_id, v_prod8_id, 3, 500000, 1500000,
   'dispatched', CURRENT_DATE - 10, 3, 3,
   'whatsapp', 'seed-ord-018', now() - INTERVAL '40 days'),

  (v_ord19_id, v_org_id, 'ORD-2605-019',
   v_cust9_id, v_prod2_id, 6, 350000, 2100000,
   'dispatched', CURRENT_DATE - 8, 6, 6,
   'web', 'seed-ord-019', now() - INTERVAL '35 days'),

  (v_ord20_id, v_org_id, 'ORD-2605-020',
   v_cust10_id, v_prod5_id, 80, 60000, 4800000,
   'dispatched', CURRENT_DATE - 12, 80, 80,
   'whatsapp', 'seed-ord-020', now() - INTERVAL '38 days');

-- ============================================================
-- INVOICES (5) — all at 18% GST
-- subtotal + (subtotal x 0.18) = total  [verified below]
-- paid(2), overdue(2), sent(1)
-- Linked to completed/dispatched orders only
-- ============================================================
INSERT INTO invoices (
  id, organization_id, invoice_number,
  order_id, customer_id,
  subtotal_paise, tax_rate, tax_amount_paise, total_amount_paise,
  status, due_date,
  paid_amount_paise, paid_date, payment_method,
  sent_via_whatsapp, sent_at, reminder_count, created_at
) VALUES
  -- PAID: Haresh Kumar — 12x Impeller @Rs.2,500 => Rs.30,000 + 18% = Rs.35,400
  -- subtotal 3000000 + tax 540000 = 3540000
  (v_inv1_id, v_org_id, 'INV-2605-001',
   v_ord14_id, v_cust4_id,
   3000000, 18.00, 540000, 3540000,
   'paid', CURRENT_DATE - 5,
   3540000, CURRENT_DATE - 8, 'upi',
   TRUE, now() - INTERVAL '22 days', 0, now() - INTERVAL '23 days'),

  -- PAID: Suresh Solanki — 50x Coupling @Rs.450 => Rs.22,500 + 18% = Rs.26,550
  -- subtotal 2250000 + tax 405000 = 2655000
  (v_inv2_id, v_org_id, 'INV-2605-002',
   v_ord15_id, v_cust5_id,
   2250000, 18.00, 405000, 2655000,
   'paid', CURRENT_DATE + 5,
   2655000, CURRENT_DATE - 2, 'bank_transfer',
   TRUE, now() - INTERVAL '17 days', 0, now() - INTERVAL '18 days'),

  -- OVERDUE: Jignesh Patel — 30x Valve Body @Rs.1,500 => Rs.45,000 + 18% = Rs.53,100
  -- subtotal 4500000 + tax 810000 = 5310000
  (v_inv3_id, v_org_id, 'INV-2605-003',
   v_ord16_id, v_cust6_id,
   4500000, 18.00, 810000, 5310000,
   'overdue', CURRENT_DATE - 15,
   0, NULL, NULL,
   TRUE, now() - INTERVAL '27 days', 2, now() - INTERVAL '28 days'),

  -- OVERDUE: Manish Trivedi — 150x Bracket @Rs.300 => Rs.45,000 + 18% = Rs.53,100
  -- subtotal 4500000 + tax 810000 = 5310000
  (v_inv4_id, v_org_id, 'INV-2605-004',
   v_ord17_id, v_cust7_id,
   4500000, 18.00, 810000, 5310000,
   'overdue', CURRENT_DATE - 5,
   0, NULL, NULL,
   FALSE, NULL, 1, now() - INTERVAL '15 days'),

  -- SENT: Bhavesh Gohil — 3x Gear Box Housing @Rs.5,000 => Rs.15,000 + 18% = Rs.17,700
  -- subtotal 1500000 + tax 270000 = 1770000
  (v_inv5_id, v_org_id, 'INV-2605-005',
   v_ord18_id, v_cust8_id,
   1500000, 18.00, 270000, 1770000,
   'sent', CURRENT_DATE + 15,
   0, NULL, NULL,
   TRUE, now() - INTERVAL '8 days', 0, now() - INTERVAL '9 days');

-- ============================================================
-- PRODUCTION BATCHES (10)
-- Rejection rates: 0%-13% across batches — realistic foundry spread
-- Batches 1-6: in_production orders (partial progress)
-- Batches 7-10: completed orders (full run done)
-- ============================================================
INSERT INTO production_batches (
  id, organization_id, batch_number,
  order_id, product_id,
  quantity_produced, quantity_rejected, defect_type,
  shift, logged_by, source, created_at
) VALUES
  -- In-production order batches (ord9-13)
  (gen_random_uuid(), v_org_id, 'B-2605-001',
   v_ord9_id,  v_prod8_id,  3,  0, NULL,                'shift_1', v_worker_id, 'whatsapp', now() - INTERVAL '5 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-002',
   v_ord10_id, v_prod1_id, 20,  2, 'porosity',          'shift_1', v_worker_id, 'whatsapp', now() - INTERVAL '8 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-003',
   v_ord10_id, v_prod1_id, 15,  1, 'shrinkage',         'shift_2', v_worker_id, 'whatsapp', now() - INTERVAL '5 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-004',
   v_ord11_id, v_prod2_id,  5,  0, NULL,                'shift_1', v_worker_id, 'web',      now() - INTERVAL '6 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-005',
   v_ord12_id, v_prod5_id, 40,  3, 'dimensional_error', 'shift_2', v_worker_id, 'whatsapp', now() - INTERVAL '7 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-006',
   v_ord13_id, v_prod3_id, 15,  2, 'surface_defect',    'shift_1', v_worker_id, 'whatsapp', now() - INTERVAL '4 days'),

  -- Completed order batches (ord14-17, full production run)
  (gen_random_uuid(), v_org_id, 'B-2605-007',
   v_ord14_id, v_prod4_id, 12,  0, NULL,                'shift_1', v_worker_id, 'whatsapp', now() - INTERVAL '20 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-008',
   v_ord15_id, v_prod6_id, 50,  4, 'porosity',          'shift_2', v_worker_id, 'whatsapp', now() - INTERVAL '15 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-009',
   v_ord16_id, v_prod1_id, 30,  1, 'shrinkage',         'shift_1', v_worker_id, 'web',      now() - INTERVAL '25 days'),

  (gen_random_uuid(), v_org_id, 'B-2605-010',
   v_ord17_id, v_prod7_id,150,  8, 'surface_defect',    'shift_3', v_worker_id, 'whatsapp', now() - INTERVAL '12 days');

END $$;
