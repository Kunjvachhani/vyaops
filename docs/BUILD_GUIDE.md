# BUILD GUIDE — VyaOps
### Sprint-by-Sprint Construction Manual
### Tool: Claude Code (sole build tool) on MacBook Pro M2
*Total Timeline: 16 weeks to full product launch*

---

## BUILD PHILOSOPHY

Claude Code works sequentially — one task, done well, before the next. This is your advantage:
- Every task builds on verified, committed code
- No merge conflicts, no architectural drift
- You review every change before moving forward
- Each sprint has numbered tasks — execute them in order

**Your daily rhythm:**
1. Open terminal → navigate to project folder
2. Start Claude Code session
3. Tell it which doc to read + which task to build
4. Review output in browser (npm run dev)
5. Iterate until correct
6. Commit + push
7. Next task

---

## PRE-BUILD SETUP (Day 0)

### Accounts to Create (do all of these before Sprint 1)
```
1.  GitHub         → create private repo: vyaops
2.  Supabase       → create project (region: South Asia or Singapore)
3.  Vercel         → connect to GitHub repo
4.  Hetzner Cloud  → create CX22 server (Ubuntu 24.04)
5.  Dualhook       → sign up (dualhook.com), Developer plan ($12/mo) for dev, Platform ($115/mo) for production
5b. Meta Business Suite → set up WhatsApp Business Account, verify business
6.  OpenRouter     → get API key (Qwen 3.7 Max)
7.  DeepSeek       → get API key (5M free tokens on signup)
8.  Razorpay       → create business account (KYC takes 2-3 days, start early)
9.  Cloudflare     → add your domain, configure DNS
10. Sentry         → create Next.js project
11. PostHog        → create project
```

### MacBook Pro M2 Setup
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20

# Install Docker Desktop for Mac (needed for local Supabase)
# Download from: https://www.docker.com/products/docker-desktop/

# Install Supabase CLI
brew install supabase/tap/supabase

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Install Git (likely already installed on Mac)
brew install git

# Create project
mkdir vyaops && cd vyaops
git init
```

### Initialize Project with Claude Code
```bash
# Start Claude Code in your project folder
claude

# First instruction to Claude Code:
"Initialize a Next.js 15 project with TypeScript strict mode, Tailwind CSS 4, 
and App Router. Set up the project structure exactly as defined in CLAUDE.md. 
Install these dependencies: @supabase/supabase-js, next-intl, zod, lucide-react.
Install shadcn/ui. Do NOT install Drizzle."
```

---

## SPRINT 1 — THE SKELETON (Weeks 1-2)
**Goal: Database, auth, layout, navigation, placeholder pages**
**Claude Code sessions: ~8-10 focused sessions**

### Week 1: Database + Auth

**Session 1: Supabase Schema (2-3 hours)**
```
Tell Claude Code:
"Read docs/database/SCHEMA.md completely. Create Supabase SQL migration files 
for ALL 16 tables. Include:
- All columns exactly as specified
- The update_updated_at trigger function (apply to every table)
- All indexes listed in the schema
- Sequence generators for order/invoice/PO numbers
- Foreign key constraints
Create the files in supabase/migrations/ with proper naming (timestamp prefix).
Also create supabase/seed.sql with test data: 1 org, 3 users, 10 customers, 
5 vendors, 8 products, 20 orders in various statuses."
```

**Session 2: RLS Policies (1-2 hours)**
```
"Read docs/security/RLS_POLICIES.md. Create a migration file that enables RLS 
on every table and applies the tenant isolation policies. Include role-based 
restrictions: workers can only INSERT production_batches, managers can 
INSERT/UPDATE orders/invoices/customers/vendors, owners have full access 
including soft delete. Do NOT enable RLS on audit_log or whatsapp_messages."
```

**Session 3: Supabase Client Setup (1 hour)**
```
"Create three Supabase client files:
- src/lib/supabase/client.ts (browser client, uses anon key)
- src/lib/supabase/server.ts (server components, uses cookies)
- src/lib/supabase/admin.ts (service-role, webhooks only)
Generate TypeScript types from the schema and save to src/types/database.ts.
Follow the patterns in CLAUDE.md exactly."
```

**Session 4: Auth System (2 hours)**
```
"Build the authentication system:
- src/app/(auth)/login/page.tsx (email + phone OTP login)
- src/app/(auth)/signup/page.tsx (creates user + organization)
- src/middleware.ts (auth check + feature gating)
- Auth callback route for Supabase
Use Supabase Auth. Store org_id and role in user_metadata.
Follow CLAUDE.md conventions for all components."
```

### Week 2: Layout + Pages

**Session 5: Dashboard Layout (2-3 hours)**
```
"Build the dashboard layout at src/app/(dashboard)/layout.tsx:
- Sidebar navigation with icons (use lucide-react)
- Navigation items dynamically shown based on user's org tier
- Read docs/security/FEATURE_GATING.md for tier → feature mapping
- Top bar: org name, user avatar, language switcher (gu/hi/en)
- Mobile responsive: collapsible sidebar on small screens
- Use shadcn/ui sidebar component
- Minimum tap target 44x44px for all nav items"
```

**Session 6: All 12 Placeholder Pages (2 hours)**
```
"Create placeholder pages for all 12 dashboard routes. Each page should have:
- Page title in the correct language (use next-intl)
- A brief description of what the page will show
- A 'Coming in Sprint X' badge for features not yet built
- Proper feature gating: if user's tier doesn't include this feature,
  show an upsell screen instead (not a hard block)

Pages: dashboard, orders, invoices, production, quality, inventory,
cash-flow, compliance, sop-builder, customers, vendors, settings

Read docs/security/FEATURE_GATING.md for which features belong to which tier."
```

**Session 7: i18n Setup (1-2 hours)**
```
"Set up next-intl for Gujarati, Hindi, and English.
Create translation files at src/i18n/gu.json, hi.json, en.json.
Include translations for: navigation labels, page titles, common buttons
(confirm, cancel, delete, save, edit), error messages, and placeholder text.
Configure the language switcher in the top bar."
```

**Session 8: Seed + Test (1 hour)**
```
"Run the local Supabase instance, apply migrations, seed test data.
Verify: login works, dashboard loads, sidebar shows correct items based on tier,
feature gating redirects work, language switching works.
Fix any issues found during testing."
```

**End of Sprint 1 — submit WhatsApp templates to Meta via Meta Business Suite (manual task, not Claude Code)**

### Sprint 1 Checklist
- [ ] All 16 database tables created with RLS
- [ ] Auth working (login, signup, org creation)
- [ ] Dashboard layout with responsive sidebar
- [ ] 12 pages accessible (placeholder content)
- [ ] Feature gating working (tier-based)
- [ ] i18n working (Gujarati, Hindi, English)
- [ ] Seed data populated
- [ ] WhatsApp templates submitted to Meta

---

## SPRINT 2 — WHATSAPP BRAIN (Weeks 3-4)
**Goal: WhatsApp webhook, AI pipeline, guided prompts**
**Claude Code sessions: ~8-10 sessions**

### Week 3: Webhook + AI

**Session 1: Webhook Handler (2 hours)**
```
"Read docs/architecture/MESSAGE_PIPELINE.md completely. Build the webhook handler:
- POST /api/webhooks/whatsapp/route.ts
- Verify Meta webhook signature using X-Hub-Signature-256 header against META_WHATSAPP_APP_SECRET (HMAC-SHA256)
- Acknowledge with 200 response immediately (< 1 second)
- Parse message payload — Meta Cloud API format: entry[].changes[].value.messages[] (text, interactive button, list reply)
- Lookup organization by sender phone number from organizations table
- Log raw message to whatsapp_messages table
- Check if message is triggered (button tap, /prefix, reply to bot)
- If not triggered: classify silently, log, do NOT respond
- If triggered: queue for AI processing
Include proper error handling and Sentry logging."
```

**Session 2: DeepSeek Integration (2 hours)**
```
"Read docs/ai/PROMPT_LIBRARY.md and docs/ai/DATA_ALIGNMENT_ENGINE.md.
Build src/lib/ai/deepseek.ts:
- API client for DeepSeek V4 Pro
- System prompt for intent classification + entity extraction
- Support Gujarati, Hindi, Hinglish, English
- Retry logic: 3 retries, exponential backoff (1s, 2s, 4s)
- 30-second timeout
- Response parsing and validation with Zod
- Return typed IntentResult object"
```

**Session 3: Eval Gate (2-3 hours)**
```
"Read docs/ai/EVAL_LOOP.md. Build src/lib/ai/eval-gate.ts:
- API client for Qwen 3.7 Max (via OpenRouter)
- Scoring prompt that evaluates DeepSeek's extraction
- Takes: raw message, AI extraction, customer list, product list
- Returns: composite score (0-1), per-dimension scores, reasoning
- Threshold routing:
  ≥ 0.85 → return 'auto_process'
  0.70-0.84 → return 'confirm'
  0.50-0.69 → return 'clarify'
  < 0.50 → return 'reject_show_menu'
Also build src/lib/ai/model-router.ts:
- Routes 90% of calls to DeepSeek, 10% complex to Qwen 3.7 Max
- Fallback: if DeepSeek fails → try Qwen 3.7 Max
- If eval gate API fails → default to 'confirm' (never auto-process without eval)"
```

**Session 4: Fuzzy Matching (1-2 hours)**
```
"Build src/lib/utils/fuzzy-match.ts:
- Levenshtein distance calculation
- Phonetic matching (Soundex algorithm adapted for Indian names)
- Alias table lookup (searches customers.aliases, products.aliases arrays)
- matchCustomer(orgId, rawName) → { match, confidence, alternatives[] }
- matchProduct(orgId, rawName) → { match, confidence, alternatives[] }
- Confidence > 85% → auto-match, < 85% → return top 3 alternatives
- Cache results for 5 minutes (same input → same output)"
```

### Week 4: Guided Prompts + End-to-End

**Session 5: Meta Cloud API Client (1-2 hours)**
```
"Build src/lib/whatsapp/meta-cloud-api.ts:
- sendTextMessage(phone, text) — POST to graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
- sendQuickReplyButtons(phone, body, buttons[]) — interactive message type 'button', max 3 buttons
- sendListMessage(phone, body, sections[]) — interactive message type 'list', max 10 items
- sendTemplateMessage(phone, templateName, languageCode, components[])
- All functions: use META_WHATSAPP_ACCESS_TOKEN as Bearer token, retry on failure, log to whatsapp_messages
- Handle Meta API error responses (error.code, error.error_subcode) with specific error messages"
```

**Session 6: Interactive Message Builders (2 hours)**
```
"Build src/lib/whatsapp/interactive.ts and src/config/whatsapp-menus.ts:
- buildMainMenu(orgTier) → shows features available for their tier
- buildCustomerList(orgId) → recent + frequent customers as list message
- buildProductList(orgId, customerId?) → products, sorted by frequency
- buildVendorList(orgId) → vendors as list message
- buildConfirmation(type, data) → confirmation message with Yes/Edit/Cancel buttons
- buildClarification(options[]) → 'Did you mean...' with alternatives
All builders respect org tier — don't show tier_2 features to tier_1 orgs."
```

**Session 7: n8n Workflow — Message Handler (2-3 hours)**

> **Architecture: n8n is orchestration-only, proxied through Next.js (Option B).**
> n8n never calls Meta or DeepSeek directly — it calls back into Next.js API
> routes, so all sends/AI/writes flow through one audited, credential-holding
> layer. n8n holds only `APP_URL` + `INTERNAL_API_KEY`. See `docs/infrastructure/N8N_PIPELINE.md`.

```
"Build the master n8n workflow as a JSON file in n8n/workflows/master-message-handler.json:
- Trigger: webhook (receives the forwarded {message, sender, orgId, messageType, isTriggered})
- ROUTER (Switch): button_reply/list_reply → Branch A; text & isTriggered → Branch B; !isTriggered → Branch C
- Branch A (guided): parse selection id, switch on prefix → call /api/whatsapp/menu,
  /api/session/store, or /api/orders; send via /api/whatsapp/send
- Branch B (AI): POST /api/ai → switch on returned decision
  (auto_process | confirm | clarify | reject_show_menu) → /api/orders + /api/whatsapp/send
- Branch C (log-only): POST /api/analytics/log-intent — no reply
- Error Trigger: POST /api/errors/log → send 'something went wrong' via /api/whatsapp/send
Every HTTP node sends the x-internal-api-key header ($env.INTERNAL_API_KEY)."
```

Also build the Next.js callback routes the workflow targets:
- `/api/ai` — classify → fuzzy-resolve (Layer 4) → eval gate → routing decision
- `/api/whatsapp/send` — forward a built Meta message body to the Cloud API
- `/api/whatsapp/menu` — build main/sub menu (return for two-step, or send directly)
- `/api/session/store` — persist guided-flow state to `whatsapp_sessions`
- `/api/analytics/log-intent` — PostHog capture (privacy-safe, no raw body/phone)
- `/api/errors/log` — structured error sink (Sentry hook point)
All guarded by `requireInternalAuth` (`src/lib/utils/internal-auth.ts`).

**Session 8: End-to-End Test (2 hours)**

Automated test scripts (run before any live WhatsApp testing):
- `npm run test:ai` (`scripts/test-ai-pipeline.ts`) — drives classify → fuzzy
  resolve → eval → route against the seeded org. Asserts intents, fuzzy matches
  (Rajubhai → Rajesh Patel), and the safety gate (no-customer order never
  auto-processes).
- `npm run test:webhook` (`scripts/test-webhook.ts`) — fires the 4 inbound cases
  at the live n8n webhook and reports per-branch execution status via the n8n API.

```
"Set up Dualhook with a test WhatsApp number via Embedded Signup. Configure Webhook Override to point to your ngrok tunnel URL (or deployed Vercel URL). Verify Meta webhook verification handshake (GET request with hub.verify_token).
Test the complete flow:
1. Send '/menu' → verify guided prompt menu appears
2. Tap 'Orders' → verify sub-menu appears
3. Type 'rajubhai no order 500 piece valve body' → verify AI processes correctly
4. Verify eval gate scores and routes correctly
5. Fix any issues in the pipeline."
```

**Note:** the n8n callbacks hit `$env.APP_URL`. For local testing point APP_URL at
your tunnel; in production it is the Vercel URL (auto-deployed on push).

### Sprint 2 Checklist
- [ ] Webhook receiving, verifying, and forwarding messages to n8n
- [ ] DeepSeek classifying intents (>80% accuracy on test messages)
- [ ] Eval gate scoring and routing by threshold
- [ ] Fuzzy matching wired into the pipeline (Layer 4) + order safety gate
- [ ] Next.js callback routes built (`/api/ai`, `/api/whatsapp/{send,menu}`, `/api/session/store`, `/api/analytics/log-intent`, `/api/errors/log`)
- [ ] `whatsapp_sessions` table (migration + types) for guided-flow state
- [ ] Guided prompt menu showing on WhatsApp
- [ ] End-to-end: text → Meta webhook → n8n → /api/ai → /api/whatsapp/send → Cloud API
- [ ] n8n workflow imported + active; `APP_URL` + `INTERNAL_API_KEY` set in n8n

---

## SPRINT 3 — ORDERS + INVOICES (Weeks 5-6)
**8-10 sessions. See original BUILD_GUIDE for full task list.**

Key tasks in order:
1. Orders API routes (CRUD + idempotency + audit trail)
2. Audit trail helper (src/lib/utils/audit.ts)
3. Customers API + page
4. Orders page (web) — table, filters, detail view
5. WhatsApp order intake flow (guided + free text)
6. Invoice PDF generation (Puppeteer)
7. Invoices API + page
8. Payment tracking + automated reminders (n8n workflow)
9. Daily order summary WhatsApp messages (n8n cron)

---

## SPRINT 4 — EVAL LOOP + DATA SAFETY (Weeks 7-8)
**6-8 sessions. Claude Code's deep reasoning shines here.**

Key tasks:
1. Create 50-case benchmark (tests/ai/benchmark.json)
2. Build benchmark runner (npm run test:benchmark)
3. Correction → new test case pipeline
4. Comprehensive soft delete across all tables
5. Destructive action confirmations (WhatsApp + web)
6. Idempotency checks for order creation
7. Sentry error monitoring setup
8. Data export functionality (CSV)

---

## SPRINT 5 — PRODUCTION + INVENTORY + VENDORS (Weeks 9-10)
**8-10 sessions**

Key tasks:
1. Production batch logging (WhatsApp Flow + free text)
2. Auto-update: order progress + inventory on production log
3. Production page (web)
4. Quality page (web) — rejection trends, defect Pareto, ₹ Saved counter
5. Inventory system + auto-updates + low stock alerts
6. Inventory page (web)
7. Vendor management + PO creation
8. Vendor page (web)
9. Production summary n8n workflows (morning + evening)

---

## SPRINT 6 — FINANCIAL + ANALYTICS (Weeks 11-12)
**6-8 sessions**

Key tasks:
1. Cash flow page (receivables aging, payables, 30-day forecast)
2. Dashboard page (₹ Saved counter, KPIs, alerts, quick actions)
3. Finalize all scheduled WhatsApp workflows
4. ₹ Saved calculation engine

---

## SPRINT 7 — COMPLIANCE + SOPs + BILLING (Weeks 13-14)
**8-10 sessions**

Key tasks:
1. Compliance calendar page + reminder workflows
2. SOP Builder page (rich text editor, versioning)
3. Razorpay integration (checkout, subscriptions, webhooks)
4. Complete feature toggle system (middleware + API + WhatsApp)
5. Settings page (org profile, users, billing, preferences)

---

## SPRINT 8 — POLISH + LAUNCH (Weeks 15-16)
**6-8 sessions**

Key tasks:
1. Onboarding wizard for new customers
2. Admin dashboard (our internal view)
3. End-to-end testing (all flows)
4. Performance optimization
5. Security audit (RLS tests, webhook verification, input validation)
6. Production deployment (Vercel + Supabase + n8n on Hetzner)
7. First 5 customer onboarding

---

## POST-LAUNCH (Month 5+)

| Month | Focus |
|-------|-------|
| 5-6 | Customer success, iterate, grow benchmark to 500+ cases |
| 7-8 | Auto-mode graduation, Tally integration add-on |
| 9-10 | Morbi ceramics + Jamnagar brass expansion |
| 11-12 | Advanced analytics, worker attendance add-on |
| 13-18 | National expansion, team hiring |
| 19-24 | CV quality inspection, marketplace, fundraising |

---

## HERMES AGENT (parallel to all sprints)
While Claude Code builds the product, Hermes Agent (on your MacBook or VPS) handles:
- Competitor monitoring (HublerX, CBS Software, SwitchOn)
- Server health checks (n8n uptime, API latency)
- Customer onboarding docs and guides
- Engineering Association presentation prep
- Benchmark analysis reports
- Regulatory research (GST, DPDP Act)
