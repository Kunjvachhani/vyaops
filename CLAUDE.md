# CLAUDE.md — VyaOps
# This is the SOLE orchestration file. Claude Code reads this first.

---

## Project Identity
- **Name**: VyaOps (Business on WhatsApp)
- **Type**: Multi-tenant B2B SaaS for Indian manufacturing MSMEs
- **What it does**: AI-powered operations platform living inside factory owner's existing WhatsApp (Coexistence API) + web dashboard for deep analysis
- **Primary Language**: TypeScript (strict mode, no `any` types)
- **Target Users**: Gujarati/Hindi-speaking factory owners with zero tech literacy
- **Dev Machine**: MacBook Pro M2

## Read These Docs Before Writing Any Code
```
REQUIRED READING ORDER:
1. docs/database/SCHEMA.md          → Complete database schema (23 tables)
2. docs/security/RLS_POLICIES.md    → Row-Level Security for multi-tenancy
3. docs/security/FEATURE_GATING.md  → Tier-based feature access control
4. docs/security/EDGE_CASES.md      → Safety, destructive action protection
5. docs/architecture/SYSTEM_OVERVIEW.md       → Full system architecture
6. docs/architecture/WHATSAPP_COEXISTENCE.md  → Coexistence mode details
7. docs/architecture/MESSAGE_PIPELINE.md      → WhatsApp processing pipeline
8. docs/ai/EVAL_LOOP.md             → Anti-slop scoring system
9. docs/ai/DATA_ALIGNMENT_ENGINE.md → 6-layer NLP pipeline (Layer 0 = dialect dictionary)
10. docs/ai/PROMPT_LIBRARY.md       → All AI system prompts (incl. dialect-aware)
10b. docs/ai/DIALECT_DICTIONARY.md  → 5-tier dialect lookup system (Tier 1-5)
10c. docs/ai/vyaops_prompt_playbook.md → Operational prompt flow & routing guide
11. docs/infrastructure/N8N_PIPELINE.md    → Workflow automations
12. docs/infrastructure/DEPLOYMENT.md      → Hosting and DevOps
13. docs/billing/RAZORPAY_INTEGRATION.md   → Payment system
14. docs/whatsapp/TEMPLATES.md             → Meta-approved message templates
15. docs/BUILD_GUIDE.md             → Sprint sequence and task breakdown
```

---

## Stack Constraints (Non-Negotiable)

| Layer | Tool | Why |
|-------|------|-----|
| Framework | Next.js 15 (App Router, React 19, Server Components) | SSR for slow Indian internet, Claude Code generates it well |
| Database | Supabase (PostgreSQL 15+ with Row-Level Security) | Auth + DB + realtime + storage in one |
| DB Client | @supabase/supabase-js | NOT Drizzle ORM — use Supabase client directly |
| Auth | Supabase Auth (email + phone OTP, role-based) | Built-in, no custom auth needed |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, Claude Code handles it well |
| AI 90% | DeepSeek V4 Pro API | $0.435/M tokens, good multilingual |
| AI Eval | Qwen 3.7 Max (via OpenRouter) | Cross-model eval gate scoring |
| AI 10% | Qwen 3.7 Max (via OpenRouter) | Complex reasoning fallback |
| WhatsApp | Dualhook (Coexistence + Webhook Override) + Meta Cloud API (direct) | Dualhook $12-115/mo, zero per-message markup, Meta bills directly |
| Workflows | n8n (self-hosted, Docker) | Visual, 500+ integrations, you know it |
| Payments | Razorpay Subscriptions API | UPI Autopay, Indian SaaS standard |
| Hosting | Vercel (Next.js) + Hetzner CX22 (n8n) | Vercel auto-deploys, Hetzner cheap |
| i18n | next-intl | Gujarati, Hindi, English |
| PDF | Puppeteer | Invoice generation |
| Analytics | PostHog (free tier) | Product analytics |
| Errors | Sentry (free tier) | Error monitoring |
| CDN | Cloudflare (free) | DNS + SSL + CDN |

---

## Build Commands
```bash
# Development
npm run dev                    # Next.js dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint + TypeScript check
npm run type-check             # TypeScript compiler check only

# Database
npx supabase start             # Start local Supabase (Docker)
npx supabase db push           # Push migrations to remote
npx supabase gen types ts --local > src/types/database.ts  # Generate types
npx supabase db reset          # Reset local DB + migrations + seed

# Testing
npm run test                   # Unit tests
npm run test:benchmark         # AI eval benchmark suite
```

---

## Code Conventions (Strictly Enforced)

### TypeScript
- Strict mode always. NO `any`. NO `@ts-ignore`.
- Use `type` for data shapes, `interface` for contracts.
- All function parameters and returns explicitly typed.
- `const` over `let`. Never `var`.
- All async operations: try/catch with specific error handling.

### React / Next.js
- Functional components only.
- Server Components by default. `"use client"` only when needed.
- React Suspense for async data loading.
- Server Actions for form mutations.
- Every form input validated with Zod.
- `next-intl` for ALL user-facing text. Never hardcode strings.
- `next/image` for images. `next/link` for navigation.

### Supabase
- Three client instances:
  - `src/lib/supabase/client.ts` — browser (anon key)
  - `src/lib/supabase/server.ts` — server components/actions (anon key + cookies)
  - `src/lib/supabase/admin.ts` — service-role (webhooks, n8n, cron jobs ONLY)
- ALWAYS filter by `organization_id` in queries (defense in depth over RLS).
- ALWAYS filter `deleted_at IS NULL` (soft delete default).
- Monetary values as integers in PAISE (₹1 = 100 paise). Display conversion only.
- Timestamps stored UTC. Displayed IST (Asia/Kolkata).

### Styling
- Tailwind CSS only. No custom CSS files.
- shadcn/ui as base UI library.
- Mobile-first responsive (factory owners use phones 70%).
- Minimum tap target: 44x44px.

### Error Handling
- Never swallow errors. Every catch logs + handles.
- API routes: `{ error: string, code: string, details?: unknown }`.
- User-facing errors in regional language (i18n keys).
- Sentry logging with context: org_id, user_role, action.

---

## Security Rules (NEVER Violate)

1. NEVER expose `service_role` key to the client.
2. NEVER hard delete any record. Soft delete via `deleted_at` only.
3. EVERY mutation writes to `audit_log` via `src/lib/utils/audit.ts`.
4. EVERY destructive action requires explicit user confirmation.
5. EVERY webhook authenticates before processing. WhatsApp webhook: X-Hub-Signature-256 HMAC (DUALHOOK_SIGNING_SECRET / META_WHATSAPP_APP_SECRET) OR the secret URL token (WHATSAPP_WEBHOOK_URL_TOKEN, `?t=` query param) — required because Dualhook Coexistence deliveries are signed with Dualhook's tech-provider app secret, which is not exposed to us. Razorpay webhook: RAZORPAY_WEBHOOK_SECRET signature.
6. EVERY API route checks org tier before allowing feature access.
7. NEVER trust client-side tier checks alone. Re-verify server-side.
8. NEVER log sensitive data (full phones, GSTINs, amounts) to Sentry.
9. All monetary values stored as PAISE (integer). No floats for money.
10. All timestamps stored as UTC. Displayed as IST.
11. `audit_log`, `whatsapp_messages`, `whatsapp_sessions`, `industry_dictionary`, and `global_dictionary`
    intentionally have RLS disabled — they are service-role-only tables. `industry_dictionary` and
    `global_dictionary` are read-only for authenticated users (via RLS SELECT policy on auth.role() = 'authenticated'),
    writes go through `adminClient` only. BEFORE GOING TO PRODUCTION: audit every query touching these
    tables and confirm none use the anon key for writes.

---

## Data Integrity Rules

- Every table has: `id` (UUID), `organization_id` (UUID FK), `created_at`, `updated_at`, `deleted_at`
- `updated_at` auto-set via database trigger on every UPDATE.
- Foreign keys enforce referential integrity.
- Idempotency keys for order creation: hash(org_id + customer_id + product_id + qty + date_hour).
- Optimistic locking: use `updated_at` as version check for concurrent edits.
- `pending_orders` table: only ONE row in (`detected`, `draft_posted`) per (organization_id, customer_phone) — enforced by partial unique index. New detection supersedes old one (old → `expired`) in application code before insert.

---

## AI Integration Rules

- **DIALECT DICTIONARY (Layer 0):** Before any AI call, raw messages pass through the 5-tier dialect dictionary (`src/lib/ai/dialect-lookup.ts`). Lookup order: Tier 4 (org) → Tier 3 (industry) → Tier 5 (global pool) → Tier 2 (business JSON) → Tier 1 (Gujarati language JSON). Only unresolved tokens reach the AI. See `docs/ai/DIALECT_DICTIONARY.md`.
- **DIALECT LEARNING:** Owner corrections write to `org_dictionary` (Tier 4) via `src/lib/ai/dialect-learner.ts`. Cross-org patterns auto-promote to `global_dictionary` (Tier 5) and eventually `industry_dictionary` (Tier 3). See `docs/ai/DIALECT_DICTIONARY.md`.
- All AI calls through model router (`src/lib/ai/model-router.ts`).
- Router decides: DeepSeek (fast/cheap) vs Qwen 3.7 Max (complex).
- Every AI output goes through eval gate (`src/lib/ai/eval-gate.ts`) before DB commit.
- System prompts stored in `docs/ai/PROMPT_LIBRARY.md`. Never hardcode.
- Cache identical AI inputs with 5-min TTL.
- All API calls: 3 retries, exponential backoff (1s→2s→4s), 30s timeout.
- Primary failure → fallback model. Eval gate failure → default to `confirm` band (never auto-process without a successful eval).
- **Eval gate `auto_process` means "post the draft immediately without asking for clarification" — it NEVER means "skip the owner's ok" and create an order directly.**
- **Informational customer queries (ORDER_STATUS, INVENTORY_CHECK, GENERAL_QUERY) are NEVER auto-answered to the customer. They are logged only. Only `/status` typed by the OWNER in a specific chat produces an automated informational reply, scoped strictly to that chat's customer.**

---

## WhatsApp Rules

- All outbound templates pre-approved by Meta (defined in `docs/whatsapp/TEMPLATES.md`).
- **Rule A — Bot silence:** Bot NEVER sends a message to a customer chat except: (1) the order/modification/cancellation draft after owner affirmation, (2) the confirmation message after owner "ok", (3) the `/status` summary when the owner types `/status` in that chat. No greetings, no auto-replies, no "I didn't understand".
- **Rule B — Draft + ok always required:** NO state-changing DB write (order create/modify/cancel) ever happens without the visible draft + explicit owner "ok" loop. This applies regardless of eval-gate score. `auto_process` decision means "post the draft without asking for clarification" — never "skip the owner's ok".
- **Rule C — Echo loop prevention (critical):** The bot's own outbound messages come back as echoes. Before processing any echo, check whether its wamid matches a logged outbound message in `whatsapp_messages` — if yes, ignore it completely. Also ignore any echo whose text matches draft/confirmation message signatures as a second layer. Without this, the bot replies to itself forever.
- Webhook payloads arrive directly from Meta via Dualhook's Webhook Override. **Auth is two-layer:** (1) X-Hub-Signature-256 HMAC against DUALHOOK_SIGNING_SECRET then META_WHATSAPP_APP_SECRET; (2) fallback — secret URL token (`?t=` query param, WHATSAPP_WEBHOOK_URL_TOKEN) baked into the webhook URL registered in Dualhook. Layer 2 exists because Coexistence deliveries are signed by Dualhook's tech-provider Meta app, whose App Secret is not available to us. If Dualhook provides their signing secret, set DUALHOOK_SIGNING_SECRET and layer 1 takes over automatically.
- Webhook acknowledged in <1 second. Processing is async (Next.js `after()`).
- **Org lookup by `metadata.phone_number_id` → `organizations.whatsapp_phone_number_id`.** Never look up org by sender phone — sender is now always the customer.
- **Orchestration lives in n8n (`n8n/workflows/master-message-handler.json`), proxied through Next.js.** The webhook verifies + forwards `{message, chatPhone, orgId, messageType, isCommand?}` to n8n; n8n routes (customer_text / owner_echo / log-only) and calls BACK into `/api/whatsapp/flow` — never Meta or DeepSeek directly. All outbound WhatsApp + AI flows through the audited app layer.
- Internal callback routes (`/api/whatsapp/flow`, `/api/ai`, `/api/whatsapp/send`, `/api/analytics/log-intent`, `/api/errors/log`) authenticate the `x-internal-api-key` header against `INTERNAL_API_KEY`. Never expose these to the browser.

---

## Project Structure
```
vyaops/
├── CLAUDE.md                         # THIS FILE (sole orchestration)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                        # Local env vars (git-ignored)
├── .env.example                      # Template for env vars
├── docs/                             # Specifications (read before coding)
│   ├── architecture/
│   │   ├── SYSTEM_OVERVIEW.md
│   │   ├── WHATSAPP_COEXISTENCE.md
│   │   └── MESSAGE_PIPELINE.md
│   ├── database/
│   │   └── SCHEMA.md
│   ├── ai/
│   │   ├── EVAL_LOOP.md
│   │   ├── DATA_ALIGNMENT_ENGINE.md
│   │   ├── DIALECT_DICTIONARY.md      # 5-tier dialect lookup system
│   │   └── PROMPT_LIBRARY.md
│   ├── security/
│   │   ├── RLS_POLICIES.md
│   │   ├── FEATURE_GATING.md
│   │   └── EDGE_CASES.md
│   ├── infrastructure/
│   │   ├── N8N_PIPELINE.md
│   │   └── DEPLOYMENT.md
│   ├── billing/
│   │   └── RAZORPAY_INTEGRATION.md
│   ├── whatsapp/
│   │   └── TEMPLATES.md
│   └── BUILD_GUIDE.md
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Login, signup
│   │   ├── (dashboard)/              # All protected pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   ├── orders/
│   │   │   ├── invoices/
│   │   │   ├── production/
│   │   │   ├── quality/
│   │   │   ├── inventory/
│   │   │   ├── cash-flow/
│   │   │   ├── compliance/
│   │   │   ├── sop-builder/
│   │   │   ├── customers/
│   │   │   ├── vendors/
│   │   │   └── settings/
│   │   ├── (admin)/                  # Our internal admin
│   │   ├── api/
│   │   │   ├── webhooks/whatsapp/    # Meta Cloud API webhook → forwards to n8n
│   │   │   ├── webhooks/razorpay/    # Razorpay webhook
│   │   │   ├── orders/
│   │   │   ├── invoices/
│   │   │   ├── production/
│   │   │   ├── inventory/
│   │   │   ├── customers/
│   │   │   ├── vendors/
│   │   │   ├── ai/                   # AI pipeline: classify → resolve → eval → route
│   │   │   ├── whatsapp/             # send + menu (n8n callback → Meta Cloud API)
│   │   │   ├── session/              # store (guided-flow conversation state)
│   │   │   ├── analytics/            # log-intent (PostHog capture)
│   │   │   └── errors/               # log (n8n error sink → Sentry)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                       # shadcn/ui
│   │   ├── dashboard/
│   │   ├── forms/
│   │   └── shared/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── admin.ts
│   │   ├── ai/
│   │   │   ├── deepseek.ts
│   │   │   ├── openrouter.ts
│   │   │   ├── model-router.ts
│   │   │   ├── eval-gate.ts
│   │   │   ├── dialect-lookup.ts      # 5-tier dialect dictionary lookup
│   │   │   └── dialect-learner.ts     # Correction → dictionary learning loop
│   │   ├── whatsapp/
│   │   │   ├── meta-cloud-api.ts
│   │   │   ├── templates.ts
│   │   │   └── interactive.ts
│   │   ├── billing/
│   │   │   └── razorpay.ts
│   │   ├── validations/              # Shared Zod schemas
│   │   │   ├── order.ts
│   │   │   ├── invoice.ts
│   │   │   ├── production.ts
│   │   │   ├── customer.ts
│   │   │   ├── vendor.ts
│   │   │   └── common.ts
│   │   ├── utils/
│   │   │   ├── currency.ts
│   │   │   ├── date.ts
│   │   │   ├── fuzzy-match.ts
│   │   │   └── audit.ts
│   │   └── constants.ts
│   ├── config/
│   │   ├── features.ts               # Feature → tier map
│   │   ├── industries/
│   │   │   └── foundry.json
│   │   ├── dialect/                   # Static dialect dictionaries (Tier 1 + 2)
│   │   │   ├── universal.json         # Tier 1: Gujarati language base (~3000 entries)
│   │   │   └── business.json          # Tier 2: Cross-industry business vocab (~200 entries)
│   │   └── whatsapp-menus.ts
│   ├── types/
│   │   ├── database.ts               # Auto-generated from Supabase
│   │   ├── whatsapp.ts
│   │   ├── ai.ts
│   │   └── billing.ts
│   ├── i18n/
│   │   ├── gu.json
│   │   ├── hi.json
│   │   └── en.json
│   └── middleware.ts                  # Auth + feature gating
├── n8n/
│   ├── workflows/                    # Exported workflow JSONs
│   └── docker-compose.yml
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
└── tests/
    └── ai/
        └── benchmark.json            # Eval loop test cases
```

---

## Claude Code Workflow

Since Claude Code is your ONLY build tool, follow this workflow for every task:

### For each sprint task:
```
1. Tell Claude Code which doc to read:
   "Read docs/database/SCHEMA.md and create the Supabase migration for the orders table"

2. Claude Code reads the spec → writes code → you review in browser/editor

3. If it needs iteration:
   "The order status should default to 'confirmed', not 'draft'. Fix the migration."

4. When satisfied, test locally:
   npm run dev → verify in browser
   npm run type-check → verify types
   npm run lint → verify style

5. Commit:
   git add . && git commit -m "feat: add orders table migration"
```

### Sequential Build Strategy
Claude Code works sequentially (one task at a time, done well). This is actually an advantage:
- Each task builds on verified, committed code from the previous task
- No merge conflicts from parallel agents
- You review every change before moving forward
- Context stays clean — Claude Code reads your actual codebase, not a stale copy

### When to Use Focused Sessions
- Start fresh Claude Code sessions for each major feature area
- Each session: provide the relevant doc + point to existing code
- Example: "Read docs/ai/EVAL_LOOP.md. Look at src/lib/ai/deepseek.ts that already exists. Now build src/lib/ai/eval-gate.ts following the spec."

---

## Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI APIs
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=

# WhatsApp (Meta Cloud API + Dualhook)
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_APP_SECRET=
DUALHOOK_API_KEY=
DUALHOOK_SIGNING_SECRET=         # optional: Dualhook tech-provider app secret (ask their support)
WHATSAPP_WEBHOOK_URL_TOKEN=      # random token in the webhook URL (?t=...) — auth fallback under Coexistence

# n8n orchestration + internal callbacks
N8N_WEBHOOK_URL=                 # n8n master-handler production webhook
INTERNAL_API_KEY=                # shared secret: Next.js ↔ n8n callbacks (x-internal-api-key)

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## When In Doubt
1. Re-read the relevant doc in `/docs`.
2. Prefer simplicity over cleverness.
3. Prefer explicit over implicit.
4. Prefer server-side over client-side.
5. Ask: "Would a non-tech factory owner understand this error message?"
6. Build one feature completely before starting the next.
