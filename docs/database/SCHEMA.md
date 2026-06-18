# Database Schema — VyaOps
# Supabase PostgreSQL 15+ | All tables multi-tenant via organization_id

---

## UNIVERSAL COLUMN CONTRACT
Every table (except `system_*` tables) MUST include:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES organizations(id),
created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),  -- auto-updated via trigger
deleted_at      TIMESTAMPTZ          DEFAULT NULL     -- soft delete
```

## AUTO-UPDATE TRIGGER (apply to every table)
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
-- Apply: CREATE TRIGGER set_updated_at BEFORE UPDATE ON [table] FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## TABLE: organizations
The tenant root. Every piece of data belongs to one organization.
```
id                  UUID PK
name                TEXT NOT NULL                    -- "Shree Ambica Engineering"
gstin               TEXT                             -- GSTIN number (nullable for unregistered)
address             TEXT
city                TEXT NOT NULL                    -- "Rajkot"
state               TEXT NOT NULL DEFAULT 'Gujarat'
phone               TEXT NOT NULL                    -- Primary contact number
email               TEXT
industry_config     TEXT NOT NULL DEFAULT 'foundry'  -- references config/industries/*.json
tier                TEXT NOT NULL DEFAULT 'tier_1'   -- tier_1 | tier_2 | tier_3
tier_valid_until    TIMESTAMPTZ                      -- subscription expiry
billing_status      TEXT NOT NULL DEFAULT 'active'   -- active | grace_period | suspended | cancelled
razorpay_customer_id    TEXT                         -- Razorpay customer ID
razorpay_subscription_id TEXT                        -- Razorpay subscription ID
whatsapp_phone              TEXT                     -- WhatsApp Business number (legacy, kept for display)
whatsapp_phone_number_id    TEXT UNIQUE              -- Meta/Dualhook Phone Number ID → PRIMARY org lookup key for inbound webhooks
whatsapp_display_number     TEXT                     -- Fallback: human-readable number for org lookup when phone_number_id not yet set
whatsapp_connected          BOOLEAN DEFAULT FALSE
auto_mode_enabled           BOOLEAN DEFAULT FALSE    -- AI auto-reply toggle (deprecated in new model — kept for future use)
language_preference TEXT NOT NULL DEFAULT 'gu'        -- gu | hi | en
whatsapp_proactive_enabled  BOOLEAN NOT NULL DEFAULT TRUE  -- receives scheduled notifications (summary, reminders, compliance)
whatsapp_proactive_set_at   TIMESTAMPTZ                    -- when the preference was last explicitly changed
timezone            TEXT NOT NULL DEFAULT 'Asia/Kolkata'
onboarded_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at          TIMESTAMPTZ
```

## TABLE: users
People who can access the web platform + WhatsApp triggers.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
email               TEXT UNIQUE
phone               TEXT
full_name           TEXT NOT NULL
role                TEXT NOT NULL DEFAULT 'worker'    -- owner | manager | worker | viewer
avatar_url          TEXT
is_active           BOOLEAN DEFAULT TRUE
last_login_at       TIMESTAMPTZ
supabase_auth_id    UUID UNIQUE                      -- links to Supabase auth.users
created_at, updated_at, deleted_at (standard)
```
**Roles & Permissions:**
- `owner`: Full access. Can delete, manage billing, manage users. Only 1 per org.
- `manager`: Create/edit orders, invoices, production, customers, vendors. Cannot delete, cannot manage billing.
- `worker`: Log production data only. View-only for everything else.
- `viewer`: View-only access to all permitted features (based on tier).

## TABLE: customers
The factory's customers (who they sell to).
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
name                TEXT NOT NULL                    -- "Rajesh Patel"
company_name        TEXT                             -- "Patel Engineering"
aliases             TEXT[] DEFAULT '{}'              -- {"Rajubhai", "Raju bhai", "Patel saheb"}
phone               TEXT
email               TEXT
gstin               TEXT
address             TEXT
payment_terms_days  INTEGER DEFAULT 30               -- default payment terms
notes               TEXT
created_at, updated_at, deleted_at (standard)
```
**Index:** `CREATE INDEX idx_customers_aliases ON customers USING GIN(aliases);`
**Index:** `CREATE INDEX idx_customers_org ON customers(organization_id) WHERE deleted_at IS NULL;`

## TABLE: vendors
The factory's suppliers (who they buy from).
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
name                TEXT NOT NULL
company_name        TEXT
aliases             TEXT[] DEFAULT '{}'
phone               TEXT
email               TEXT
gstin               TEXT
address             TEXT
materials_supplied  TEXT[]                           -- {"CI Round Bar", "Brass Rod", "Green Sand"}
payment_terms_days  INTEGER DEFAULT 30
rating              NUMERIC(2,1) DEFAULT 0           -- 0-5 supplier rating
notes               TEXT
created_at, updated_at, deleted_at (standard)
```

## TABLE: products
The factory's product catalog.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
name                TEXT NOT NULL                    -- "Valve Body"
code                TEXT                             -- internal product code
aliases             TEXT[] DEFAULT '{}'              -- {"VB", "valve", "વાલ્વ બોડી"}
category            TEXT                             -- "Casting" | "Machining" | "Assembly"
unit                TEXT NOT NULL DEFAULT 'pieces'   -- pieces | tons | kg | meters | sq_ft | boxes
unit_price_paise    BIGINT DEFAULT 0                 -- price per unit in paise
hsn_code            TEXT                             -- HSN code for GST
raw_materials       JSONB DEFAULT '[]'               -- [{material_id, qty_per_unit}]
reorder_level       INTEGER DEFAULT 0                -- alert when stock drops below
notes               TEXT
created_at, updated_at, deleted_at (standard)
```

## TABLE: orders
Customer orders received by the factory.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
order_number        TEXT NOT NULL                    -- auto-generated: ORD-YYMM-NNN
customer_id         UUID FK → customers(id)
product_id          UUID FK → products(id)
quantity            INTEGER NOT NULL
unit_price_paise    BIGINT NOT NULL                  -- price at time of order (snapshot)
total_amount_paise  BIGINT NOT NULL                  -- quantity × unit_price
status              TEXT NOT NULL DEFAULT 'confirmed' -- draft | confirmed | in_production | completed | dispatched | cancelled
delivery_date       DATE
quantity_produced   INTEGER DEFAULT 0                -- updated as production batches are logged
quantity_dispatched INTEGER DEFAULT 0
source              TEXT NOT NULL DEFAULT 'whatsapp'  -- whatsapp | web | manual
source_message_id   TEXT                             -- original WhatsApp message ID (for audit)
idempotency_key     TEXT UNIQUE                      -- hash(org+customer+product+qty+date_hour)
notes               TEXT
created_at, updated_at, deleted_at (standard)
```
**Index:** `CREATE INDEX idx_orders_status ON orders(organization_id, status) WHERE deleted_at IS NULL;`
**Index:** `CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE deleted_at IS NULL;`
**Trigger:** On status change to 'completed' → insert notification to prompt invoice generation.

## TABLE: invoices
Invoices generated for completed orders.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
invoice_number      TEXT NOT NULL                    -- auto-generated: INV-YYMM-NNN
order_id            UUID FK → orders(id)
customer_id         UUID FK → customers(id)
subtotal_paise      BIGINT NOT NULL
tax_rate            NUMERIC(5,2) DEFAULT 18.00       -- GST percentage
tax_amount_paise    BIGINT NOT NULL
total_amount_paise  BIGINT NOT NULL
status              TEXT NOT NULL DEFAULT 'draft'     -- draft | sent | paid | partially_paid | overdue | cancelled
due_date            DATE NOT NULL
paid_amount_paise   BIGINT DEFAULT 0
paid_date           DATE
payment_method      TEXT                             -- upi | bank_transfer | cash | cheque
pdf_url             TEXT                             -- Supabase storage URL
sent_via_whatsapp   BOOLEAN DEFAULT FALSE
sent_at             TIMESTAMPTZ
reminder_count      INTEGER DEFAULT 0                -- how many reminders sent
last_reminder_at    TIMESTAMPTZ
notes               TEXT
created_at, updated_at, deleted_at (standard)
```
**Index:** `CREATE INDEX idx_invoices_status ON invoices(organization_id, status) WHERE deleted_at IS NULL;`
**Index:** `CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status NOT IN ('paid','cancelled') AND deleted_at IS NULL;`

## TABLE: payments
Payment records against invoices.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
invoice_id          UUID FK → invoices(id)
amount_paise        BIGINT NOT NULL
payment_date        DATE NOT NULL
payment_method      TEXT NOT NULL                    -- upi | bank_transfer | cash | cheque
reference_number    TEXT                             -- UTR, cheque number, etc.
notes               TEXT
created_at, updated_at, deleted_at (standard)
```

## TABLE: vendor_orders (Purchase Orders)
Orders placed with vendors/suppliers.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
po_number           TEXT NOT NULL                    -- auto-generated: PO-YYMM-NNN
vendor_id           UUID FK → vendors(id)
material_name       TEXT NOT NULL
quantity            NUMERIC(10,2) NOT NULL
unit                TEXT NOT NULL DEFAULT 'tons'
unit_price_paise    BIGINT
total_amount_paise  BIGINT
status              TEXT NOT NULL DEFAULT 'draft'     -- draft | sent | acknowledged | in_transit | received | partially_received | cancelled
expected_date       DATE
received_quantity   NUMERIC(10,2) DEFAULT 0
received_date       DATE
triggered_by_order_id UUID FK → orders(id)           -- nullable, if PO was auto-suggested
quality_status      TEXT DEFAULT 'pending'            -- pending | approved | rejected
notes               TEXT
created_at, updated_at, deleted_at (standard)
```

## TABLE: production_batches
Daily production logging from the shop floor.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
batch_number        TEXT NOT NULL                    -- "48" or auto-generated
order_id            UUID FK → orders(id)             -- nullable (stock production)
product_id          UUID FK → products(id)
quantity_produced   INTEGER NOT NULL
quantity_rejected   INTEGER NOT NULL DEFAULT 0
defect_type         TEXT                             -- from industry config defect taxonomy
shift               TEXT                             -- shift_1 | shift_2 | shift_3
logged_by           UUID FK → users(id)
source              TEXT NOT NULL DEFAULT 'whatsapp'
source_message_id   TEXT
notes               TEXT
created_at, updated_at, deleted_at (standard)
```
**Trigger:** On insert → update orders.quantity_produced, update inventory (add finished goods, deduct raw materials).

## TABLE: inventory
Current stock levels for raw materials and finished goods.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
item_type           TEXT NOT NULL                    -- raw_material | finished_good
item_name           TEXT NOT NULL
product_id          UUID FK → products(id)           -- nullable (for finished goods linking)
current_quantity    NUMERIC(12,2) NOT NULL DEFAULT 0
unit                TEXT NOT NULL
reorder_level       NUMERIC(12,2) DEFAULT 0
avg_daily_consumption NUMERIC(12,2) DEFAULT 0        -- calculated from last 30 days
last_restocked_at   TIMESTAMPTZ
notes               TEXT
created_at, updated_at, deleted_at (standard)
```
**Unique:** `UNIQUE(organization_id, item_type, item_name) WHERE deleted_at IS NULL`

## TABLE: inventory_movements
Every stock change logged for traceability.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
inventory_id        UUID FK → inventory(id)
movement_type       TEXT NOT NULL                    -- addition | deduction | adjustment
quantity            NUMERIC(12,2) NOT NULL           -- positive for addition, negative for deduction
reason              TEXT NOT NULL                    -- production | vendor_receipt | dispatch | adjustment | return
reference_type      TEXT                             -- production_batch | vendor_order | order
reference_id        UUID                             -- ID of the related record
balance_after       NUMERIC(12,2) NOT NULL           -- running balance after this movement
created_by          UUID FK → users(id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```
**Note:** This table is APPEND-ONLY. No updates, no deletes. Ever.

## TABLE: compliance_tasks
Regulatory compliance calendar.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
task_name           TEXT NOT NULL                    -- "GST Return Filing"
category            TEXT NOT NULL                    -- gst | pf | esi | factory | pollution | fire | electrical
frequency           TEXT NOT NULL                    -- monthly | quarterly | annual | biannual
due_date            DATE NOT NULL
status              TEXT NOT NULL DEFAULT 'pending'   -- pending | in_progress | completed | overdue | na
completed_date      DATE
completed_by        UUID FK → users(id)
reminder_sent       BOOLEAN DEFAULT FALSE
notes               TEXT
created_at, updated_at, deleted_at (standard)
```

## TABLE: sop_documents
Standard operating procedure documents.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
title               TEXT NOT NULL
category            TEXT                             -- production | quality | safety | maintenance
content             TEXT NOT NULL                    -- rich text / markdown content
version             INTEGER NOT NULL DEFAULT 1
status              TEXT NOT NULL DEFAULT 'draft'     -- draft | published | archived
published_by        UUID FK → users(id)
published_at        TIMESTAMPTZ
created_at, updated_at, deleted_at (standard)
```

## TABLE: audit_log
Immutable record of every data change. APPEND-ONLY. NO RLS (service-role only).
```
id                  UUID PK DEFAULT gen_random_uuid()
organization_id     UUID NOT NULL
table_name          TEXT NOT NULL
record_id           UUID NOT NULL
action              TEXT NOT NULL                    -- CREATE | UPDATE | SOFT_DELETE | RESTORE
changed_by          UUID                             -- user ID or NULL for system/bot
changed_by_source   TEXT NOT NULL                    -- whatsapp | web | api | scheduled | system
old_values          JSONB                            -- previous state (NULL for CREATE)
new_values          JSONB                            -- new state (NULL for SOFT_DELETE)
ip_address          TEXT
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```
**CRITICAL:** This table has NO `updated_at`, NO `deleted_at`. Records are NEVER modified or deleted. RLS is NOT enabled — only service-role can write. Application code writes via `src/lib/utils/audit.ts` helper.

## TABLE: whatsapp_messages
Raw message log for AI training and audit trail.
```
id                  UUID PK DEFAULT gen_random_uuid()
organization_id     UUID NOT NULL
message_id          TEXT NOT NULL                    -- Meta message ID (wamid)
direction           TEXT NOT NULL                    -- inbound | outbound
sender_phone        TEXT NOT NULL                    -- for inbound: customer phone; for outbound: business number
chat_phone          TEXT                             -- customer-side phone for both directions (for correlation)
is_echo             BOOLEAN NOT NULL DEFAULT FALSE   -- TRUE when received via smb_message_echoes (owner's reply)
message_type        TEXT NOT NULL                    -- text | image | document | interactive | template
message_body        TEXT
media_url           TEXT
intent_classified   TEXT                             -- NEW_ORDER | MODIFY_ORDER | CANCEL_ORDER | etc.
intent_confidence   NUMERIC(3,2)                     -- 0.00 to 1.00
eval_score          NUMERIC(3,2)                     -- eval gate score
was_triggered       BOOLEAN DEFAULT FALSE            -- TRUE for owner slash commands (/status, /cancel, /edit, /order)
was_processed       BOOLEAN DEFAULT FALSE            -- did we create a DB record from this?
processing_result   JSONB                            -- extracted entities, matched records
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```
**Note:** APPEND-ONLY. No updates, no deletes. Primary use: AI training data + echo loop guard.

## TABLE: pending_orders
State machine for customer-detected actionable messages awaiting owner confirmation.
```
id                  UUID PK
organization_id     UUID NOT NULL FK → organizations(id)
customer_id         UUID FK → customers(id)          -- NULL if sender unknown/unmatched
customer_phone      TEXT NOT NULL                    -- normalized customer phone (chat identity)
intent              TEXT NOT NULL CHECK IN ('NEW_ORDER','MODIFY_ORDER','CANCEL_ORDER')
target_order_id     UUID FK → orders(id)             -- for MODIFY_ORDER / CANCEL_ORDER
extraction          JSONB NOT NULL DEFAULT '{}'       -- full AI output: entities, confidences, eval score
state               TEXT NOT NULL DEFAULT 'detected'
                    CHECK IN ('detected','draft_posted','confirmed','cancelled','expired')
source_message_id   TEXT NOT NULL                    -- wamid of the customer message that triggered this
draft_message_id    TEXT                             -- wamid of the draft we sent (set when state→draft_posted)
confirmed_order_id  UUID FK → orders(id)             -- set when state→confirmed
expires_at          TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
created_at, updated_at, deleted_at (standard)
```
**Partial unique index:** only ONE row in (`detected`, `draft_posted`) per (organization_id, customer_phone).
New detection while one is active: expire old one in application code, then insert.
**RLS:** enabled, same tenant-isolation pattern as other tables.

## TABLE: whatsapp_sessions
Conversation state for backward-compatibility. One live
session per (organization_id, sender_phone); short-lived and overwritten per flow.
Written only by the `/api/session/store` callback via the service-role client.
```
id                  UUID PK DEFAULT gen_random_uuid()
organization_id     UUID NOT NULL
sender_phone        TEXT NOT NULL
state               JSONB NOT NULL DEFAULT '{}'       -- accumulating selection: selected_customer_id, selected_product_id, quantity, ...
expires_at          TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 hour'
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()  -- auto via update_updated_at trigger
```
**Unique:** `UNIQUE(organization_id, sender_phone)` — upserts target this. No RLS (service-role only, like whatsapp_messages).

## TABLE: eval_benchmark
Test cases for the eval loop. Grows over time from production corrections.
```
id                  UUID PK DEFAULT gen_random_uuid()
test_case_id        TEXT NOT NULL UNIQUE              -- TC-001, TC-002, etc.
source              TEXT NOT NULL                    -- manual | production_correction | production_failure
raw_message         TEXT NOT NULL                    -- the original WhatsApp message
expected_intent     TEXT NOT NULL
expected_entities   JSONB NOT NULL
expected_matches    JSONB                            -- expected fuzzy match results
actual_output       JSONB                            -- what the AI actually returned (if from production)
correction_details  TEXT                             -- what the owner corrected
difficulty          TEXT DEFAULT 'medium'             -- easy | medium | hard
tags                TEXT[] DEFAULT '{}'               -- for filtering benchmarks
industry            TEXT DEFAULT 'foundry'
is_active           BOOLEAN DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

## TABLE: billing_events
Razorpay webhook events for billing history.
```
id                  UUID PK DEFAULT gen_random_uuid()
organization_id     UUID FK → organizations(id)
event_type          TEXT NOT NULL                    -- subscription.charged | subscription.halted | payment.failed
razorpay_event_id   TEXT UNIQUE NOT NULL
payload             JSONB NOT NULL
processed           BOOLEAN DEFAULT FALSE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

## TABLE: feature_addons
Tracks which add-ons each organization has enabled.
```
id                  UUID PK
organization_id     UUID FK → organizations(id)
addon_key           TEXT NOT NULL                    -- tally_sync | extra_numbers | worker_attendance | custom_industry
is_active           BOOLEAN DEFAULT TRUE
razorpay_addon_id   TEXT
activated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
deactivated_at      TIMESTAMPTZ
created_at, updated_at, deleted_at (standard)
```
**Unique:** `UNIQUE(organization_id, addon_key) WHERE deleted_at IS NULL`

---

## RELATIONSHIP DIAGRAM
```
organizations (tenant root)
  ├── users (many)
  ├── customers (many)
  │     └── orders (many) ──→ invoices (1:1) ──→ payments (many)
  ├── vendors (many)
  │     └── vendor_orders (many)
  ├── products (many)
  │     ├── orders (many, via product_id)
  │     ├── production_batches (many)
  │     └── inventory (1:1 for finished goods)
  ├── inventory (many)
  │     └── inventory_movements (many, append-only)
  ├── compliance_tasks (many)
  ├── sop_documents (many)
  ├── feature_addons (many)
  ├── billing_events (many)
  ├── audit_log (many, append-only, NO RLS)
  ├── whatsapp_messages (many, append-only)
  ├── whatsapp_sessions (one live per sender, NO RLS)
  └── eval_benchmark (global, not per-org)
```

## SEQUENCE GENERATORS
```sql
-- Order numbers: ORD-2406-001, ORD-2406-002, ...
CREATE SEQUENCE order_number_seq;
-- Invoice numbers: INV-2406-001, ...
CREATE SEQUENCE invoice_number_seq;
-- PO numbers: PO-2406-001, ...
CREATE SEQUENCE po_number_seq;
```
Number format function: `format('ORD-%s-%s', to_char(now(), 'YYMM'), lpad(nextval('order_number_seq')::text, 3, '0'))`

Note: Sequences are per-database, not per-organization. For org-specific sequential numbering (some factories want INV-001, INV-002), use a counter column on the organizations table.
