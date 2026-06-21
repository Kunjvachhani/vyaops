# VYAOPS — CLAUDE CODE PROMPT PLAYBOOK
### Every Sprint. Every Session. Every Prompt. Copy-Paste Ready.
### For a Non-Coder Who Wants to Know Exactly Where They Are.

---

## HOW TO USE THIS FILE

1. **Work top to bottom.** Never skip ahead.
2. **Each session** = one Claude Code conversation. Start fresh for each session.
3. **The PROMPT box** = copy-paste this EXACTLY into Claude Code.
4. **The VERIFY box** = what to type in Terminal and what you should see.
5. **The COMMIT box** = save your work after each session.
6. **Check the box** (☐ → ☑) when done. This is your progress tracker.
7. **If something breaks:** paste the error into Claude Code and say "Fix this."

---

## MASTER PROGRESS TRACKER

Use this to see where you are at a glance. Check off each item as you complete it.

### Phase 0: Machine Setup
- [-] 0.1 — Homebrew installed
- [-] 0.2 — Node.js 20 installed
- [-] 0.3 — Docker Desktop running
- [-] 0.4 — Supabase CLI installed
- [-] 0.5 — Claude Code installed
- [-] 0.6 — Git + VS Code installed
- [-] 0.7 — All 11 accounts created, API keys saved

### Phase 1: Project Init (Day 1)
- [ ] 1.1 — Project folder created, git initialized
- [ ] 1.2 — Skeleton files unzipped, .env.local filled in
- [ ] 1.3 — Next.js 15 project initialized by Claude Code
- [ ] 1.4 — Local Supabase running
- [ ] 1.5 — First git commit + pushed to GitHub
- [ ] 1.6 — Vercel connected and deployed

### Sprint 1: The Skeleton (Weeks 1–2)
- [ ] S1.1 — 16 database tables created
- [ ] S1.2 — Seed data populated (org, users, customers, products, orders)
- [ ] S1.3 — RLS policies applied
- [ ] S1.4 — Supabase client files created (browser, server, admin)
- [ ] S1.5 — Auth system working (login, signup, org creation)
- [ ] S1.6 — Dashboard layout with responsive sidebar
- [ ] S1.7 — 12 placeholder pages with tier gating
- [ ] S1.8 — i18n working (Gujarati, Hindi, English)
- [ ] S1.9 — Full test pass + committed
- [ ] S1.M — WhatsApp templates submitted to Meta (MANUAL)

### Sprint 2: WhatsApp Brain (Weeks 3–4)
- [ ] S2.0 — ngrok installed, n8n deployed on Hetzner
- [ ] S2.1 — WhatsApp webhook handler receiving messages
- [ ] S2.2 — DeepSeek AI integration classifying intents
- [ ] S2.3 — Eval gate scoring + model router built
- [ ] S2.4 — Fuzzy matching for customers and products
- [ ] S2.5 — Meta Cloud API client (send messages back)
- [ ] S2.6 — Interactive menu/list/button builders
- [ ] S2.7 — n8n master workflow created
- [ ] S2.8 — End-to-end WhatsApp test passing

### Sprint 3: Orders + Invoices (Weeks 5–6)
- [ ] S3.1 — Audit trail helper built
- [ ] S3.2 — Orders API (CRUD + idempotency)
- [ ] S3.3 — Customers API + web page
- [ ] S3.4 — Orders web page (table, filters, detail view)
- [ ] S3.5 — WhatsApp order intake (customer-initiated, echo-confirmed flow)
- [ ] S3.6 — Invoice PDF generation (Puppeteer)
- [ ] S3.7 — Invoices API + web page
- [ ] S3.8 — Payment tracking + automated reminders (n8n)
- [ ] S3.9 — Daily order summary WhatsApp messages (n8n cron)

### Sprint 4: Eval Loop + Data Safety (Weeks 7–8)
- [-] S4.1 — 1000-case AI benchmark created (10 industries, Gujlish/Hinglish/Hindi/English)
- [ ] S4.2 — Benchmark runner (npm run test:benchmark)
- [ ] S4.3 — Correction → new test case pipeline
- [ ] S4.3b — Dialect Dictionary: DB migration (3 tables) + static JSON (Tier 1/2)
- [ ] S4.3c — Dialect Dictionary: Lookup module (src/lib/ai/dialect-lookup.ts)
- [ ] S4.3d — Dialect Dictionary: Learning module (src/lib/ai/dialect-learner.ts)
- [ ] S4.3e — Dialect Dictionary: Seed industry_dictionary with 50 MSME segments
- [ ] S4.4 — Soft delete across all tables
- [ ] S4.5 — Destructive action confirmations (WhatsApp + web)
- [ ] S4.6 — Idempotency checks for orders
- [ ] S4.7 — Sentry error monitoring live
- [ ] S4.8 — CSV data export

### Sprint 5: Production + Inventory + Vendors (Weeks 9–10)
- [ ] S5.1 — Production batch logging via WhatsApp
- [ ] S5.2 — Auto-update: order progress + inventory on production log
- [ ] S5.3 — Production web page
- [ ] S5.4 — Quality web page (rejection trends, defect Pareto, ₹ Saved)
- [ ] S5.5 — Inventory system + auto-updates + low stock alerts
- [ ] S5.6 — Inventory web page
- [ ] S5.7 — Vendor management + PO creation
- [ ] S5.8 — Vendor web page
- [ ] S5.9 — Production summary n8n workflows (morning + evening)

### Sprint 6: Financial + Analytics (Weeks 11–12)
- [ ] S6.1 — Cash flow page (receivables aging, payables, forecast)
- [ ] S6.2 — ₹ Saved calculation engine
- [ ] S6.3 — Dashboard page (KPIs, alerts, quick actions)
- [ ] S6.4 — All scheduled WhatsApp workflows finalized

### Sprint 7: Compliance + SOPs + Billing (Weeks 13–14)
- [ ] S7.1 — Compliance calendar page + reminder workflows
- [ ] S7.2 — SOP Builder page (editor + versioning)
- [ ] S7.3 — Razorpay integration (checkout, subscriptions, webhooks)
- [ ] S7.4 — Complete feature toggle system
- [ ] S7.5 — Settings page (org profile, users, billing, preferences)

### Sprint 8: Polish + Launch (Weeks 15–16)
- [ ] S8.1 — Onboarding wizard for new customers
- [ ] S8.2 — Admin dashboard (internal view)
- [ ] S8.3 — End-to-end testing (all flows)
- [ ] S8.4 — Performance optimization
- [ ] S8.5 — Security audit
- [ ] S8.6 — Production deployment (Vercel + Supabase + Hetzner)
- [ ] S8.7 — First 5 customers live

---
---

# PHASE 0 — MACHINE SETUP

*No Claude Code needed here. This is you, in Terminal, installing tools.*
*Follow the IMPLEMENTATION_GUIDE.md Steps 0.1–0.7 exactly.*
*Estimated time: 2–3 hours.*

When done, you should have:
- Homebrew, Node 20, Docker Desktop, Supabase CLI, Claude Code, Git, VS Code
- 11 service accounts with API keys saved securely

---

# PHASE 1 — PROJECT INITIALIZATION (Day 1)

*Follow IMPLEMENTATION_GUIDE.md Steps 1.1–1.6.*
*The only Claude Code prompt in this phase:*

### Session 1.3: Initialize the Project

**What this does:** Creates your entire project skeleton — config files, folder structure, dependencies. Think of it as laying the foundation slab before building walls.

**PROMPT — paste into Claude Code:**
```
Read the CLAUDE.md file in this project root. This is your operating manual for the entire project.

Then initialize a Next.js 15 project manually (do NOT use create-next-app). Set up:

1. package.json with scripts: dev, build, start, lint, type-check
2. tsconfig.json with strict: true, noImplicitAny: true, strictNullChecks: true, path alias "@/*" → "./src/*"
3. next.config.ts for App Router
4. postcss.config.mjs using @tailwindcss/postcss (Tailwind CSS 4, no tailwind.config.ts)
5. eslint.config.mjs extending next/core-web-vitals
6. .gitignore for Next.js

Install these exact packages:
- Core: next@15 react@19 react-dom@19
- Types: typescript @types/node @types/react @types/react-dom
- Tailwind: tailwindcss@^4 @tailwindcss/postcss
- ESLint: eslint eslint-config-next
- Required: @supabase/supabase-js next-intl zod lucide-react
- shadcn deps: class-variance-authority clsx tailwind-merge @radix-ui/react-slot

Set up shadcn/ui with components.json (default style, rsc: true, CSS variables, slate base color).
Create src/lib/utils.ts with the cn() helper using clsx + tailwind-merge.
Create src/app/globals.css with Tailwind CSS 4 import and shadcn CSS variables.
Create src/app/layout.tsx (root layout, Server Component).
Create src/app/page.tsx that redirects to /login (not /dashboard — auth doesn't exist yet).

Create the FULL project directory structure from CLAUDE.md — every folder should exist:
- src/app/(auth)/, (dashboard)/, (admin)/, api/webhooks/, api/orders/, etc.
- src/components/ui/, dashboard/, forms/, shared/
- src/lib/supabase/, ai/, whatsapp/, billing/, validations/, utils/
- src/config/, src/types/, src/i18n/
- n8n/workflows/, supabase/migrations/, tests/ai/

For each page and API route, create a minimal stub file so the route exists.
Do NOT install Drizzle ORM.
```

**VERIFY:**
```bash
npm run dev
# Browser → http://localhost:3000 → should load without errors
npm run type-check
# Should show zero errors
npm run lint
# Should pass
```

**COMMIT:**
```bash
git add . && git commit -m "chore: initial project setup with Next.js 15, Tailwind 4, shadcn/ui"
git push
```

---
---

# SPRINT 1 — THE SKELETON (Weeks 1–2)
**Goal: Database with 16 tables, working auth, dashboard layout, all pages accessible, i18n**
**Sessions: 9 + 1 manual task**

---

### S1.1 — Database Schema (2–3 hours)

**What this does:** Creates all 16 database tables your app needs — organizations, users, customers, products, orders, invoices, production batches, inventory, vendors, and more. This is the data backbone.

**PROMPT:**
```
Read docs/database/SCHEMA.md completely — every table, every column, every index.

Create Supabase SQL migration files in supabase/migrations/ for ALL 16 tables.
Name them with timestamp prefixes in dependency order:
- 20260601000001_create_trigger_function.sql (the update_updated_at function)
- 20260601000002_create_organizations.sql
- 20260601000003_create_users.sql
- Then all remaining tables in foreign-key dependency order

For EACH table include:
- All columns exactly as specified in SCHEMA.md (types, defaults, constraints)
- Apply the update_updated_at trigger
- All indexes listed in the schema
- Foreign key constraints with proper ON DELETE behavior
- NOT NULL constraints where specified

Also create:
- Sequence generators for order_number, invoice_number, po_number
- Any enum types referenced in the schema

Follow CLAUDE.md rules:
- Every table gets: id (UUID, default gen_random_uuid()), organization_id (UUID FK), created_at, updated_at, deleted_at
- Monetary values as INTEGER (paise, not rupees)
- Timestamps as TIMESTAMPTZ (UTC)
```

**VERIFY:**
```bash
# In a separate terminal tab:
supabase db reset
# Should show: "Applied migration 20260601000001..." for each file
# Should show NO errors

# Open browser → http://localhost:54323
# Click "Table Editor" in left sidebar
# You should see all 16 tables listed
```

**COMMIT:**
```bash
git add . && git commit -m "feat: database schema — all 16 tables with indexes and triggers"
git push
```

---

### S1.2 — Seed Data (1 hour)

**What this does:** Fills your database with realistic test data so you can see the app working. Think of it as putting sample furniture in a model home.

**PROMPT:**
```
Read docs/database/SCHEMA.md for the exact column names and types.

Create supabase/seed.sql with realistic test data for a Rajkot foundry:

1 organization:
- Name: "Shree Ambica Engineering", city: "Rajkot", state: "Gujarat"
- Industry: "foundry", tier: "tier_2", onboarding_status: "active"

3 users (all belong to the org above):
- Owner: "Jayesh Patel", role: "owner", email: "jayesh@test.com"
- Manager: "Ramesh Desai", role: "manager", email: "ramesh@test.com"
- Worker: "Kiran Solanki", role: "worker", email: "kiran@test.com"

10 customers with realistic Rajkot/Gujarati names:
- Include aliases array for each (e.g., "Rajubhai" → aliases: ["raju", "rajubhai", "raju patel"])
- Mix of cities: Rajkot, Ahmedabad, Morbi, Jamnagar
- Varying credit limits and payment terms

5 vendors:
- Ambuja Steel Traders, Jamnagar Metals, Rajkot Iron Works, etc.
- Include GSTIN numbers (use realistic format: 24XXXXX1234X1ZX)

8 products (foundry products):
- Valve Body, Pump Housing, Bearing Cap, Impeller, Flange, Coupling, Bracket, Gear Box Housing
- Include: HSN codes, unit prices in PAISE, units (piece/kg), aliases
- Mix of price ranges: ₹200–₹5000 per piece

20 orders in various statuses:
- Mix: 3 draft, 5 confirmed, 5 in_production, 4 completed, 3 delivered
- Spread across different customers
- All amounts in PAISE

5 invoices:
- 2 paid, 2 overdue, 1 sent
- Linked to completed/delivered orders

10 production batches:
- Various rejection rates (0% to 15%)
- Linked to in_production and completed orders

Important: Use gen_random_uuid() for all IDs. Make sure foreign keys match.
All timestamps in UTC. All money in paise (multiply rupee amounts by 100).
```

**VERIFY:**
```bash
supabase db reset
# Should apply migrations AND seed without errors

# Open http://localhost:54323 → Table Editor
# Click "organizations" → should see 1 row
# Click "customers" → should see 10 rows
# Click "orders" → should see 20 rows
```

**COMMIT:**
```bash
git add . && git commit -m "feat: seed data — test org, users, customers, products, orders"
git push
```

---

### S1.3 — RLS Policies (1–2 hours)

**What this does:** Row-Level Security makes sure each factory can only see its own data. Tenant A can never see Tenant B's orders, even if someone tries.

**PROMPT:**
```
Read docs/security/RLS_POLICIES.md completely.

Create a new migration file: supabase/migrations/20260601100001_rls_policies.sql

This migration must:

1. Enable RLS on EVERY table EXCEPT audit_log and whatsapp_messages
   (those are write-only system tables, accessed via service-role)

2. For each RLS-enabled table, create these policies:

   SELECT policy — "Users can only read their own org's data":
   - Check: organization_id = (auth.jwt() ->> 'org_id')::uuid
   - Also check: deleted_at IS NULL (never show soft-deleted records)

   INSERT policy — "Users can only insert into their own org":
   - Check: organization_id = (auth.jwt() ->> 'org_id')::uuid

   UPDATE policy — role-based:
   - Workers: can ONLY update production_batches
   - Managers: can update orders, invoices, customers, vendors, production_batches, products
   - Owners: can update everything

   No DELETE policies — we never hard delete. Soft delete happens via UPDATE (setting deleted_at).

3. Special cases:
   - organizations table: users can only SELECT their own org
   - users table: users can SELECT other users in same org, UPDATE only themselves

Do NOT enable RLS on audit_log or whatsapp_messages.
```

**VERIFY:**
```bash
supabase db reset
# Should complete without errors

# Open http://localhost:54323 → SQL Editor
# Run: SELECT tablename, policyname FROM pg_policies ORDER BY tablename;
# Should see policies for each table
```

**COMMIT:**
```bash
git add . && git commit -m "feat: RLS policies — tenant isolation + role-based access"
git push
```

---

### S1.4 — Supabase Client Files (1 hour)

**What this does:** Creates three different database connection files — one for the browser, one for server-side code, one for admin operations. Each has different permission levels.

**PROMPT:**
```
Read CLAUDE.md section on Supabase client conventions.

Create three Supabase client files:

1. src/lib/supabase/client.ts — Browser client
   - Uses createBrowserClient from @supabase/ssr
   - Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env
   - This is for client-side components marked "use client"

2. src/lib/supabase/server.ts — Server Component client
   - Uses createServerClient from @supabase/ssr
   - Reads cookies for auth session
   - Used in Server Components and Server Actions
   - Returns both the client AND a helper to get the current user + org_id + role

3. src/lib/supabase/admin.ts — Service-role client (DANGEROUS — webhooks only)
   - Uses createClient with SUPABASE_SERVICE_ROLE_KEY
   - Add a runtime check: if this runs in browser, throw an error immediately
   - Only used by webhook handlers and cron jobs

Install @supabase/ssr if not already installed.

Also generate TypeScript types from the local schema:
Run: npx supabase gen types ts --local > src/types/database.ts

Create a placeholder at src/types/database.ts with a comment explaining
how to regenerate if the file can't be auto-generated right now.
```

**VERIFY:**
```bash
npm run type-check
# Should pass — no errors about the Supabase client files
```

**COMMIT:**
```bash
git add . && git commit -m "feat: supabase client files — browser, server, admin"
git push
```

---

### S1.5 — Auth System (2 hours)

**What this does:** Login and signup pages. After this session, users can create an account, log in, and get redirected to the dashboard.

**PROMPT:**
```
Build the complete authentication system using Supabase Auth.

1. src/app/(auth)/layout.tsx
   - Centered layout for auth pages (no sidebar)
   - Clean card-based design using shadcn/ui Card component
   - Language switcher in top-right corner

2. src/app/(auth)/login/page.tsx
   - Email + password login form
   - "Don't have an account? Sign up" link
   - Form validation with Zod (email required, password min 6 chars)
   - On success: redirect to /dashboard
   - On error: show error message in user's language (next-intl)
   - Use shadcn/ui Input, Button, Label components
   - "use client" directive (form needs interactivity)

3. src/app/(auth)/signup/page.tsx
   - Fields: Full Name, Email, Password, Company Name, City, Industry (dropdown)
   - Industry options from src/config/industries/ (start with "Foundry")
   - On submit:
     a. Create Supabase auth user
     b. Create organization record in organizations table
     c. Create user record in users table with role: "owner"
     d. Store org_id and role in user_metadata
   - Redirect to /dashboard on success
   - Zod validation on all fields

4. src/app/(auth)/callback/route.ts
   - Supabase auth callback handler (for email confirmation flows)

5. Update src/middleware.ts:
   - Check for valid Supabase session on all routes except /login, /signup, /callback
   - If no session → redirect to /login
   - If session exists → allow through to dashboard
   - Extract org_id and role from session for downstream use

Follow CLAUDE.md: functional components, "use client" only where needed,
Zod validation, next-intl for all text, shadcn/ui components, Tailwind only.
Minimum tap target 44x44px on all buttons.
```

**VERIFY:**
```bash
npm run dev
# Browser → http://localhost:3000 → should redirect to /login
# Click "Sign up" → fill form → submit
# Should create account and redirect to /dashboard (even if dashboard is blank)
# Go to /login → log in with credentials → should redirect to /dashboard

# Check database:
# http://localhost:54323 → Table Editor → "organizations" → should see your new org
# Table Editor → "users" → should see your new user with role "owner"
```

**COMMIT:**
```bash
git add . && git commit -m "feat: auth system — login, signup, middleware, org creation"
git push
```

---

### S1.6 — Dashboard Layout (2–3 hours)

**What this does:** The main app shell — sidebar navigation, top bar with org name and language switcher. Every page will render inside this layout.

**PROMPT:**
```
Read docs/security/FEATURE_GATING.md for the tier → feature mapping.
Read src/config/features.ts for the feature configuration.

Build the dashboard layout at src/app/(dashboard)/layout.tsx:

1. Left sidebar (collapsible on mobile):
   - VyaOps logo/name at top
   - Navigation items with lucide-react icons:
     
     TIER 1 (Basic — all users see these):
     • Dashboard (LayoutDashboard icon)
     • Orders (ShoppingCart icon)
     • Invoices (FileText icon)
     • Customers (Users icon)
     • Vendors (Truck icon)
     
     TIER 2 (Professional — show only if org tier >= tier_2):
     • Production (Factory icon)
     • Quality (Shield icon)
     • Inventory (Package icon)
     • Cash Flow (IndianRupee icon)
     
     TIER 3 (Enterprise — show only if org tier >= tier_3):
     • Compliance (Scale icon)
     • SOP Builder (BookOpen icon)
     
     ALL TIERS:
     • Settings (Settings icon)

   - Active page highlighted
   - Minimum 44x44px tap targets (mobile users)

2. Top bar:
   - Organization name (left side)
   - Language switcher: gu | hi | en (center or right)
   - User avatar/name + dropdown with "Sign Out" option (right side)

3. Main content area:
   - {children} rendered here
   - Proper padding for mobile

4. Mobile behavior:
   - Sidebar collapses to hamburger menu
   - Overlay sidebar on tap
   - Close on outside click or nav item click

Use shadcn/ui Sidebar, Button, Avatar, DropdownMenu components.
Server Component for the layout. Fetch user session + org data server-side.
Read org tier from database to determine which nav items to show.
Use next-intl for all navigation labels.
```

**VERIFY:**
```bash
npm run dev
# Browser → http://localhost:3000/dashboard
# Should see: sidebar with nav items, top bar with org name
# Click different nav items → URL changes (pages may be blank, that's fine)
# Resize browser to mobile width → sidebar should collapse to hamburger
# Language switcher should be visible in top bar
```

**COMMIT:**
```bash
git add . && git commit -m "feat: dashboard layout — sidebar, top bar, tier-based nav"
git push
```

---

### S1.7 — All 12 Placeholder Pages (1–2 hours)

**What this does:** Creates a real page for every section of the app. Right now they just show titles and "coming soon" messages, but every route works.

**PROMPT:**
```
Read docs/security/FEATURE_GATING.md for which features belong to which tier.

Create page.tsx for all 12 dashboard routes. For EACH page:

1. Page title (large heading, translated via next-intl)
2. Brief description of what this page will show
3. A badge showing which sprint builds this feature:
   - Dashboard → "Building in Sprint 6"
   - Orders → "Building in Sprint 3"
   - Invoices → "Building in Sprint 3"
   - Customers → "Building in Sprint 3"
   - Vendors → "Building in Sprint 5"
   - Production → "Building in Sprint 5"
   - Quality → "Building in Sprint 5"
   - Inventory → "Building in Sprint 5"
   - Cash Flow → "Building in Sprint 6"
   - Compliance → "Building in Sprint 7"
   - SOP Builder → "Building in Sprint 7"
   - Settings → "Building in Sprint 7"

4. Feature gating logic:
   - If the user's org tier doesn't include this feature, show an upsell card:
     "🔒 [Feature Name] is available on the [Required Tier] plan."
     "Upgrade to unlock production tracking, quality dashboards, and more."
     [Upgrade →] button (links to /settings — billing section)
   - If the user's tier DOES include it, show the placeholder

5. Each page is a Server Component
6. Use shadcn/ui Card, Badge components
7. All text through next-intl (no hardcoded strings)

Files to create:
- src/app/(dashboard)/page.tsx
- src/app/(dashboard)/orders/page.tsx
- src/app/(dashboard)/invoices/page.tsx
- src/app/(dashboard)/customers/page.tsx
- src/app/(dashboard)/vendors/page.tsx
- src/app/(dashboard)/production/page.tsx
- src/app/(dashboard)/quality/page.tsx
- src/app/(dashboard)/inventory/page.tsx
- src/app/(dashboard)/cash-flow/page.tsx
- src/app/(dashboard)/compliance/page.tsx
- src/app/(dashboard)/sop-builder/page.tsx
- src/app/(dashboard)/settings/page.tsx
```

**VERIFY:**
```bash
npm run dev
# Click through ALL 12 sidebar links → each should show its page
# No 404 errors
# If you signed up as tier_2, Production/Quality/Inventory should show placeholders
# Compliance/SOP Builder should show upsell cards (tier_3 features)
```

**COMMIT:**
```bash
git add . && git commit -m "feat: 12 placeholder pages with tier-based feature gating"
git push
```

---

### S1.8 — i18n Setup (1–2 hours)

**What this does:** Makes the entire app work in Gujarati, Hindi, and English. Factory owners in Rajkot will use this in Gujarati.

**PROMPT:**
```
Set up next-intl for the App Router with three locales: en, hi, gu.

1. Configure next-intl:
   - src/i18n/routing.ts — define locales and default locale (en)
   - src/i18n/request.ts — getRequestConfig for server components
   - Update next.config.ts with next-intl plugin if needed
   - Update src/middleware.ts to detect locale

2. Create translation files:

   src/i18n/en.json — English:
   - nav.*: Dashboard, Orders, Invoices, Customers, Vendors, Production, Quality, Inventory, Cash Flow, Compliance, SOP Builder, Settings
   - auth.*: Login, Sign Up, Email, Password, Company Name, City, Industry, "Don't have an account?", "Already have an account?"
   - common.*: Confirm, Cancel, Delete, Save, Edit, Back, Loading, Search, Filter, Export, "No data found", Success, Error
   - errors.*: "Something went wrong", "Session expired", "Permission denied", "Feature not available on your plan"
   - dashboard.*: page titles and descriptions for all 12 pages
   - tiers.*: "Starter", "Professional", "Enterprise"
   - upsell.*: "Available on {tier} plan", "Upgrade to unlock"

   src/i18n/hi.json — Hindi (translate all keys above to Hindi)
   
   src/i18n/gu.json — Gujarati (translate all keys above to Gujarati)

3. Wire up the language switcher in the dashboard layout:
   - Three buttons/dropdown: gu | hi | en
   - On click: changes locale, page refreshes in new language
   - Store preference (can use cookie or URL param)

4. Update ALL existing pages to use useTranslations() or getTranslations()
   instead of any hardcoded strings.
```

**VERIFY:**
```bash
npm run dev
# Browser → dashboard → click "gu" in language switcher
# Navigation labels should change to Gujarati
# Click "hi" → should change to Hindi
# Click "en" → back to English
# All page titles and buttons should translate
```

**COMMIT:**
```bash
git add . && git commit -m "feat: i18n — Gujarati, Hindi, English translations + language switcher"
git push
```

---

### S1.9 — Full Test + Final Commit (1 hour)

**What this does:** Makes sure everything built so far works together. Catches any broken pieces before moving on.

**PROMPT:**
```
Run through the complete Sprint 1 verification checklist and fix any issues:

1. Database: run "supabase db reset" — should apply all migrations + seed without errors
2. Auth: signup creates org + user, login works, logout works, middleware redirects
3. Layout: sidebar shows correct items for tier_2 org, collapses on mobile
4. Pages: all 12 routes load, tier gating shows upsell for higher-tier features
5. i18n: language switcher works, all text translates in all 3 languages
6. Types: run "npm run type-check" — zero errors
7. Lint: run "npm run lint" — zero errors
8. Dev server: "npm run dev" — no console errors

Fix every issue found. Do not skip any check.
```

**VERIFY:**
```bash
supabase db reset        # No errors
npm run type-check       # 0 errors
npm run lint             # 0 errors
npm run dev              # No console errors
# Manually test: signup → login → navigate all pages → switch languages → logout
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Sprint 1 complete — database, auth, layout, i18n"
git push
```

---

### S1.M — Submit WhatsApp Templates (MANUAL — not Claude Code)

**What this does:** WhatsApp requires pre-approved message templates. You submit them now so they're approved by the time you need them in Sprint 2. Meta approval takes 24–48 hours.

**Steps (do these in Meta Business Suite, not in code):**
1. Log in to Meta Business Suite (business.facebook.com)
2. Go to WhatsApp Manager → Message Templates
3. Read docs/whatsapp/TEMPLATES.md for all 11 templates
4. Submit each template in all 3 languages (English, Hindi, Gujarati)
5. Wait for Meta approval (typically 1–24 hours)

---
---

# SPRINT 2 — WHATSAPP BRAIN (Weeks 3–4)
**Goal: WhatsApp sends a message → AI processes it → response comes back**
**Sessions: 9 (including pre-setup)**

---

### S2.0 — Pre-Sprint Setup (30 minutes)

**What this does:** Installs ngrok (creates a public URL to your local machine so WhatsApp can reach it) and deploys n8n on your Hetzner server.

**In Terminal (not Claude Code):**
```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel to your dev server
ngrok http 3000
# Copy the https://xxxx.ngrok-free.app URL — you'll configure it as Webhook Override URL in Dualhook

# Deploy n8n on Hetzner — follow IMPLEMENTATION_GUIDE.md "DEPLOYING N8N ON HETZNER" section
```

**VERIFY:**
- ngrok shows a public URL that forwards to localhost:3000
- n8n is accessible at https://n8n.yourdomain.com

---

### S2.1 — WhatsApp Webhook Handler (2 hours)

**What this does:** Creates the endpoint that receives ALL incoming WhatsApp messages AND the owner's outbound echoes. This is the front door of the entire pipeline.

**ARCHITECTURE NOTE (read before coding):**
- Customers message the factory owner's number naturally — `from` = customer phone
- The owner replies from his own phone — Dualhook forwards these as `smb_message_echoes` (or `message_echoes`)
- Org is identified by `metadata.phone_number_id` → `organizations.whatsapp_phone_number_id` (NOT by sender phone)
- The bot is silent until the owner affirms a customer request

**PROMPT:**
```
Read docs/architecture/MESSAGE_PIPELINE.md completely — the new customer-initiated
echo-confirmed model.
Read docs/architecture/WHATSAPP_COEXISTENCE.md — especially the "Message Echoes" section.
Read CLAUDE.md WhatsApp Rules A, B, C.

Build the webhook handler at src/app/api/webhooks/whatsapp/route.ts:

1. GET handler (Meta webhook verification):
   - Meta sends GET with hub.mode, hub.verify_token, hub.challenge
   - If verify_token matches META_WHATSAPP_VERIFY_TOKEN → return hub.challenge
   - Otherwise → 403

2. POST handler:
   - Respond 200 immediately (< 1 second). Use Next.js after() for async processing.
   - Verify Meta X-Hub-Signature-256 header using HMAC-SHA256 + META_WHATSAPP_APP_SECRET
   - Allow Dualhook test pings (x-dualhook-event: test_ping header) without signature

3. ORG LOOKUP — by phone_number_id (NOT by sender phone):
   - PRIMARY: change.value.metadata.phone_number_id → organizations.whatsapp_phone_number_id
   - FALLBACK: metadata.display_phone_number → organizations.whatsapp_display_number
   - No org found → log (masked) and exit. Never process orphaned webhooks.

4. CUSTOMER MESSAGE processing (change.field === "messages"):
   - msg.from = CUSTOMER phone. Normalize it using normalizePhone() from src/lib/utils/phone.ts
   - Look up customer by normalized phone against customers.phone
   - Unknown sender → log to whatsapp_messages, NO pending_order, NO reply, exit
   - Known customer → log to whatsapp_messages (direction: inbound, is_echo: false, chat_phone = customer phone)
   - Forward to n8n: { messageType: 'customer_text', message, chatPhone, orgId, messageId, customerId }

5. ECHO processing (change.field === "smb_message_echoes" OR "message_echoes"):
   Accept BOTH field names until live Dualhook echo confirms the exact name.
   For each echo:
   a. LOOP GUARD LAYER 1: check if echo.id already exists in whatsapp_messages
      with direction='outbound' → if yes, skip entirely (bot message echoing back)
   b. LOOP GUARD LAYER 2: if echo text starts with known bot signatures
      ("📋 Order Draft", "✅ Order Confirmed", "📦 Your Orders") → skip
   c. Log to whatsapp_messages (direction: outbound, is_echo: true,
      chat_phone = echo.to, sender_phone = echo.from)
   d. Forward to n8n: { messageType: 'owner_echo', message, chatPhone: echo.to,
      orgId, messageId, isCommand: text.startsWith('/') }

6. Create src/lib/utils/phone.ts:
   normalizePhone(raw): strips +, spaces, handles leading 91 / 10-digit Indian numbers
   Always use this for ALL phone comparisons.

7. Update src/types/whatsapp.ts with WhatsAppEchoMessage type:
   { id, from, to, timestamp, type, text?: { body } }

Error handling: try/catch everything. Never log full phones to Sentry (mask: 91XXXX1234).
Use adminClient for all DB writes.
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
npm run dev

# Test webhook verification:
curl "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# Should return: test123

# Test inbound customer message:
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=SKIP_FOR_DEV" \
  -H "x-dualhook-event: test_ping" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"metadata":{"phone_number_id":"TEST_PHONE_NUMBER_ID","display_phone_number":"919876543210"},"messages":[{"id":"wamid.test","from":"919824100001","type":"text","text":{"body":"500 piece valve body joiye"}}]}}]}]}'
# Should get 200 immediately
# Check whatsapp_messages table → should see 1 inbound row
```

**COMMIT:**
```bash
git add . && git commit -m "feat: WhatsApp webhook handler — phone_number_id org lookup, echo processing, loop guard"
git push
```

---

### S2.2 — DeepSeek AI Integration (2 hours)

**What this does:** Connects to DeepSeek AI so it can understand what a factory owner is saying in Gujarati/Hindi/English and extract the order details.

**PROMPT:**
```
Read docs/ai/PROMPT_LIBRARY.md for the exact system prompts to use.
Read docs/ai/DATA_ALIGNMENT_ENGINE.md for the 5-layer NLP pipeline.

Build src/lib/ai/deepseek.ts:

1. DeepSeek V4 Pro API client:
   - Base URL: https://api.deepseek.com/v1
   - Uses DEEPSEEK_API_KEY from env
   - Retry logic: 3 retries, exponential backoff (1s → 2s → 4s)
   - 30-second timeout per request
   - Proper error handling for: rate limits (429), server errors (500+), timeout

2. Intent classification function:
   - classifyIntent(message: string, orgContext: OrgContext): Promise<IntentResult>
   - System prompt from PROMPT_LIBRARY.md for intent classification
   - Supports: Gujarati, Hindi, Hinglish, English input
   - Returns intent type: 'create_order' | 'check_status' | 'create_invoice' | 'log_production' | 'check_inventory' | 'menu' | 'unknown'

3. Entity extraction function:
   - extractEntities(message: string, intent: string, orgContext: OrgContext): Promise<EntityResult>
   - Extracts: customer name, product name, quantity, unit, price, dates
   - OrgContext includes: customer list, product list (for fuzzy matching later)

4. Create types in src/types/ai.ts:
   - IntentResult { intent, confidence, rawMessage, language }
   - EntityResult { entities: ExtractedEntity[], confidence, reasoning }
   - ExtractedEntity { type, rawValue, normalizedValue?, confidence }
   - OrgContext { orgId, customers, products, vendors }
   - ModelResponse { content, model, tokens, latencyMs }

5. Zod schemas to validate all AI responses (AI can return garbage — validate everything)
```

**VERIFY:**
```bash
npm run type-check   # Zero errors

# You can test manually by adding a temporary test script,
# or wait until S2.8 for end-to-end testing
```

**COMMIT:**
```bash
git add . && git commit -m "feat: DeepSeek AI client — intent classification + entity extraction"
git push
```

---

### S2.3 — Eval Gate + Model Router (2–3 hours)

**What this does:** A second AI (Qwen) checks the first AI's (DeepSeek) work. If the extraction is bad, it asks the user to clarify instead of creating a wrong order. This is your quality control.

**PROMPT:**
```
Read docs/ai/EVAL_LOOP.md completely — this is the anti-slop scoring system.

Build TWO files:

FILE 1: src/lib/ai/eval-gate.ts
- API client for Qwen 3.7 Max via OpenRouter
  - Base URL: https://openrouter.ai/api/v1
  - Uses OPENROUTER_API_KEY from env
  - Model: qwen/qwen3-235b-a22b

- evaluateExtraction function:
  - Takes: rawMessage, aiExtraction (from DeepSeek), customerList, productList
  - Sends scoring prompt from EVAL_LOOP.md to Qwen
  - Qwen evaluates these dimensions (each scored 0–1):
    • Customer match accuracy
    • Product match accuracy
    • Quantity extraction accuracy
    • Overall intent correctness
    • Language understanding quality
  - Returns: compositeScore (weighted average), perDimensionScores, reasoning

- routeByScore function:
  - Score ≥ 0.85 → 'auto_process' (create order automatically)
  - Score 0.70–0.84 → 'confirm' (show user what we understood, ask to confirm)
  - Score 0.50–0.69 → 'clarify' (ask user to clarify specific unclear parts)
  - Score < 0.50 → 'reject_show_menu' (didn't understand, show guided menu)

FILE 2: src/lib/ai/model-router.ts
- Routes AI calls to the right model:
  - Default: DeepSeek (fast, cheap) — 90% of calls
  - Complex reasoning: Qwen 3.7 Max — 10% of calls
  - Complexity scoring: messages with multiple orders, ambiguous quantities, or mixed languages → route to Qwen

- Fallback logic:
  - If DeepSeek fails after retries → try Qwen 3.7 Max
  - If Qwen fails after retries → return error (never silently fail)
  - If eval gate API itself fails → default to 'confirm' (NEVER auto-process without eval)

- routeAndProcess function that orchestrates:
  1. Pick model (DeepSeek or Qwen)
  2. Get intent + entities
  3. Run eval gate
  4. Return final decision with all scores
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: eval gate scoring + model router with fallback logic"
git push
```

---

### S2.4 — Fuzzy Matching (1–2 hours)

**What this does:** When a factory owner types "rajubhai" or "valve bady" (misspelled), this finds the right customer and product from the database using smart string matching.

**PROMPT:**
```
Build src/lib/utils/fuzzy-match.ts:

1. Levenshtein distance calculation:
   - levenshtein(a: string, b: string): number
   - Standard algorithm, handles Unicode (Gujarati/Hindi characters)

2. Phonetic matching:
   - soundexMatch(a: string, b: string): boolean
   - Adapted for Indian names (handle: bh/b, sh/s, th/t equivalences)
   - Handle common transliteration variants (kumar/kumarr, shah/shaah)

3. matchCustomer function:
   - matchCustomer(orgId: string, rawName: string): Promise<MatchResult>
   - Searches: customer.name, customer.aliases array, customer.contact_person
   - First checks exact match in aliases (fast path)
   - Then Levenshtein + phonetic against all customers in org
   - Returns: { match: Customer | null, confidence: number, alternatives: Customer[] }
   - confidence > 0.85 → auto-match
   - confidence 0.60–0.85 → return top 3 alternatives
   - confidence < 0.60 → no match

4. matchProduct function:
   - matchProduct(orgId: string, rawName: string): Promise<MatchResult>
   - Same pattern as matchCustomer but against products table
   - Searches: product.name, product.aliases array

5. In-memory cache:
   - Cache customer/product lists per org for 5 minutes
   - Same input → same output (no re-fetching within TTL)

Use src/lib/supabase/admin.ts for database queries (this runs server-side).
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: fuzzy matching — Levenshtein + phonetic for customers and products"
git push
```

---

### S2.5 — Meta Cloud API Client (1–2 hours)

**What this does:** Lets your app SEND messages back to WhatsApp via Meta's Cloud API directly. The webhook receives, this sends. No BSP in the middle.

**PROMPT:**
```
Build src/lib/whatsapp/meta-cloud-api.ts:

Meta Cloud API client for sending WhatsApp messages directly via graph.facebook.com.
Read docs/whatsapp/TEMPLATES.md for template names.

Base URL: https://graph.facebook.com/v21.0/{META_WHATSAPP_PHONE_NUMBER_ID}/messages
Auth: Bearer token using META_WHATSAPP_ACCESS_TOKEN

1. sendTextMessage(phone: string, text: string): Promise<SendResult>
   - Simple text reply
   - POST body: { messaging_product: "whatsapp", to: phone, type: "text", text: { body: text } }

2. sendQuickReplyButtons(phone: string, body: string, buttons: Button[]): Promise<SendResult>
   - Max 3 buttons (WhatsApp limit)
   - Each button: { id: string, title: string } (title max 20 chars)
   - POST body: { messaging_product: "whatsapp", to: phone, type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons } } }

3. sendListMessage(phone: string, body: string, sections: Section[]): Promise<SendResult>
   - Max 10 items total across all sections
   - Each item: { id: string, title: string, description?: string }
   - POST body: { messaging_product: "whatsapp", to: phone, type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: "Select", sections } } }

4. sendTemplateMessage(phone: string, templateName: string, languageCode: string, components: TemplateComponent[]): Promise<SendResult>
   - For pre-approved templates (order confirmation, payment reminder, etc.)
   - POST body: { messaging_product: "whatsapp", to: phone, type: "template", template: { name: templateName, language: { code: languageCode }, components } }

5. All functions:
   - Use META_WHATSAPP_ACCESS_TOKEN as Bearer token in Authorization header
   - Handle Meta API error responses: parse error.code and error.error_subcode
   - Retry on failure: 2 retries, 1-second backoff
   - Log EVERY outbound message to whatsapp_messages table (direction: 'outbound')
   - Return SendResult: { success, messageId?, error? }

Create/update src/types/whatsapp.ts types for:
- Button, Section, ListItem, TemplateComponent
- SendResult, MetaWebhookPayload, MessageType
- WhatsAppMessageRecord (for DB logging)
- MetaErrorResponse { error: { message, type, code, error_subcode, fbtrace_id } }
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Meta Cloud API client — send text, buttons, lists, templates directly"
git push
```

---

### S2.6 — Interactive Message Builders (2 hours)

**What this does:** Creates all WhatsApp message formats the bot sends — order drafts, modification drafts, cancellation drafts, status summaries, and the clarification helpers. These are the only messages the bot ever sends (Rules A, B, C).

**PROMPT:**
```
Read docs/architecture/MESSAGE_PIPELINE.md — "Three Hard Rules" section.
Read CLAUDE.md WhatsApp Rules A, B, C.

Build TWO files:

FILE 1: src/config/whatsapp-menus.ts
- Define menu constants for the /order and /edit owner commands
  (owner-side only, never sent to customers)

FILE 2: src/lib/whatsapp/interactive.ts

The bot sends exactly THREE types of messages to a chat (Rule A).
Build these builders:

1. buildOrderDraft(data: { quantity, productName, customerName, unit?, urgent? }): string
   Returns plain text (not interactive buttons — owner replies naturally):
   "📋 Order Draft
   
   500 × Valve Body (pcs) | Urgent
   Customer: Mehul Patel
   Ready by: — (reply "ok <date>" to set)
   
   Reply "ok" to confirm · /cancel to discard"

2. buildModificationDraft(data: { mode, originalQuantity, newQuantity, productName, customerName, unit? }): string
   - mode='add': shows new total (original + new), labels it "+200 added"
   - mode='replace': shows new quantity, labels it "quantity updated"
   - mode='ambiguous': asks "Total 950 ke total 450?" with both options
   
3. buildCancellationDraft(data: { orderNumber, quantity, productName, customerName, unit?, quantityProduced? }): string
   - Include "⚠️ X pcs already produced" warning when quantityProduced > 0
   
4. buildStatusSummary(data: { customerName, orders: Array<{orderNumber, quantity, productName, unit, quantityProduced, deliveryDate}> }): string
   "📦 Your Orders — Mehul Patel
   
   ORD-2606-001: 500 × Valve Body — 300 done ✅ Ready: 15 June"
   Omit "Ready:" when deliveryDate is null.

5. buildCustomerList, buildProductList, buildVendorList, buildConfirmation, buildClarification
   (keep existing helpers for the web dashboard / future use)

All amounts in Indian format (₹1,50,000).
All customer-visible text must be i18n-ready (Gujarati/Hindi/English via org preference).
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: WhatsApp interactive message builders — order drafts, mod drafts, status"
git push
```

---

### S2.7 — n8n Master Workflow + Flow Route (2–3 hours)

**What this does:** Creates the n8n workflow (just a router — 7 nodes) and the `/api/whatsapp/flow` endpoint that the flow engine lives behind. All intelligence is in the Next.js app, not in n8n.

**ARCHITECTURE NOTE:** n8n is a dumb router now. It receives the forwarded webhook payload, checks `messageType`, and calls `/api/whatsapp/flow`. The flow engine (`src/lib/whatsapp/flow-engine.ts`) handles ALL logic: AI classification, pending_orders state machine, drafts, confirmations, commands.

**PROMPT:**
```
Read docs/infrastructure/N8N_PIPELINE.md for the updated orchestration boundary.
Read docs/architecture/MESSAGE_PIPELINE.md — "Orchestration Boundary" section.

PART 1: Create n8n/workflows/master-message-handler.json

The workflow has exactly 7 nodes:

1. WhatsApp Webhook (webhook trigger node)
   - Receives POST from /api/webhooks/whatsapp
   - Payload: { messageType, message, chatPhone, orgId, messageId, customerId?, isCommand? }

2. Message Router (switch node, 3 branches):
   - Branch "Customer Message": messageType IN ['customer_text','button_reply','list_reply']
   - Branch "Owner Echo": messageType = 'owner_echo'
   - Fallback (everything else) → Log Only

3. Customer Flow (HTTP Request):
   - POST $env.APP_URL/api/whatsapp/flow
   - Header: x-internal-api-key: $env.INTERNAL_API_KEY
   - Body: full payload from webhook

4. Owner Echo Flow (HTTP Request):
   - POST $env.APP_URL/api/whatsapp/flow
   - Same headers, same body

5. Log Only (HTTP Request):
   - POST $env.APP_URL/api/analytics/log-intent
   - Logs unrecognized messageTypes for analytics
   - NO WhatsApp reply ever (Rule A)

6. Error Trigger node

7. Log Error (HTTP Request):
   - POST $env.APP_URL/api/errors/log
   - NEVER sends a message to the chat (Rule A applies to errors too)

PART 2: Create src/app/api/whatsapp/flow/route.ts

Internal-auth protected endpoint (requireInternalAuth):
- Accepts: { messageType, message, chatPhone, orgId, messageId, customerId?, isCommand? }
- If messageType = 'owner_echo' → await handleOwnerEcho(orgId, chatPhone, message, messageId)
- Otherwise (customer_text/button_reply/list_reply) → await handleCustomerMessage(orgId, chatPhone, customerId ?? null, message, messageId)
- Fire-and-forget: use void async () inside route so n8n gets 200 before the 30s timeout
- Imports from src/lib/whatsapp/flow-engine.ts (built in S3.5)

PART 3: Create /api/ai/route.ts (for benchmark + standalone AI testing):
- Receives { message, orgId }
- Calls routeAndProcess from model-router
- Returns { decision, intent, entities, evalResult }
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
npm run build        # Build succeeds

# Import n8n/workflows/master-message-handler.json into n8n
# Activate it → webhook URL shown: https://n8n.vyaops.com/webhook/whatsapp-message
# Update .env.local: N8N_WEBHOOK_URL=https://n8n.vyaops.com/webhook/whatsapp-message
```

**COMMIT:**
```bash
git add . && git commit -m "feat: n8n master workflow (3-branch router) + /api/whatsapp/flow route"
git push
```

---

### S2.8 — End-to-End Test (2 hours)

**What this does:** Tests the classification pipeline and the echo-confirmed flow. The webhook test script covers 7 scenarios including loop prevention and /status scope guard.

**PROMPT:**
```
Help me test the complete pipeline end-to-end using the new customer-initiated
echo-confirmed architecture.

1. scripts/test-webhook.ts — 7 scenarios via /api/whatsapp/flow:
   a. Customer order message → expect pending_order state='detected', NO outbound send
   b. Owner echo "haa thai jase" (AFFIRM) → expect draft posted, state='draft_posted'
   c. Owner echo "ok 15 june" → expect order created, ✅ confirmation sent, state='confirmed'
   d. Owner echo "ok" with no active pending → expect nothing (silence)
   e. Unknown sender (customerId: null) → expect log-only, no pending_order
   f. LOOP TEST: feed bot's own draft wamid back as echo → expect ignored (loop guard)
   g. /status from owner → expect summary scoped to ONLY that chat's customer
      (seed a second customer with orders and assert their orders do NOT appear)
   Print MANUAL reminder at end:
   "MANUAL: verify Dualhook forwards smb_message_echoes — send FROM the connected
   number and confirm it appears in whatsapp_messages with is_echo=true."

2. scripts/test-ai-pipeline.ts — intent classification + owner-reply classifier:
   Customer intent cases (a–j):
   a. English: "Create order for Raju Patel, 500 pieces Valve Body" → NEW_ORDER
   b. Hindi: "Raju bhai ka order dalo 500 piece valve body" → NEW_ORDER
   c. Gujarati: "Rajubhai no order nakho 500 piece valve body" → NEW_ORDER
   d. Hinglish: "rajubhai order 500 pcs valve body urgent hai" → NEW_ORDER
   e. Ambiguous: "500 valve body" (no customer) → NEW_ORDER, mustNotCreateOrder
   f. "haji 200 piece add karva che" → MODIFY_ORDER
   g. "450 j joiye, badli nakho" → MODIFY_ORDER
   h. "300 piece wala order cancel karo" → CANCEL_ORDER
   i. "250 piece rokvi do" → CANCEL_ORDER
   j. "order ka kya hua" → ORDER_STATUS
   Owner-reply classifier cases (OR-1 to OR-6 from PROMPT_LIBRARY.md):
   - "haa thai jase" → AFFIRM
   - "ok karu chu" → AFFIRM
   - "na nai thay" → DECLINE
   - "kale vat karu" → UNRELATED
   - "haa pan be divas lagse" → AFFIRM
   - Unrelated reply about different topic → UNRELATED

3. Fix ALL issues found. No unhandled errors anywhere.
```

**VERIFY:**
```bash
npx tsx --env-file=.env.local scripts/test-ai-pipeline.ts
npx tsx --env-file=.env.local scripts/test-webhook.ts

# Expected:
# NEW_ORDER confidence > 0.70 for cases a-d
# MODIFY_ORDER detected for f-g
# CANCEL_ORDER detected for h-i
# All owner-reply signals match expected
# Fuzzy match: "Rajubhai" → "Raju Patel"
# Webhook scenarios a-g all pass

npm run type-check   # Zero errors
npm run lint         # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Sprint 2 complete — WhatsApp AI pipeline end-to-end"
git push
```

---
---

# SPRINT 3 — ORDERS + INVOICES (Weeks 5–6)
**Goal: Full order lifecycle — create, track, invoice, get paid**
**Sessions: 9**

---

### S3.1 — Audit Trail Helper (1 hour)

**What this does:** Every action in the app (create order, update price, delete customer) gets logged to an audit trail. If something goes wrong, you can see exactly who did what and when.

**PROMPT:**
```
Read CLAUDE.md security rule #3: "EVERY mutation writes to audit_log."

Build src/lib/utils/audit.ts:

1. logAudit function:
   - logAudit(entry: AuditEntry): Promise<void>
   - Writes to audit_log table using admin client
   - NEVER fails silently — if audit write fails, log to Sentry but don't block the main operation

2. AuditEntry type:
   - organization_id: string
   - user_id: string
   - action: 'create' | 'update' | 'soft_delete' | 'restore' | 'status_change'
   - entity_type: 'order' | 'invoice' | 'customer' | 'vendor' | 'product' | 'production_batch' | 'inventory' | 'user' | 'organization'
   - entity_id: string
   - changes: { field: string, old_value: unknown, new_value: unknown }[]
   - metadata?: Record<string, unknown> (extra context like "via_whatsapp: true")
   - ip_address?: string
   - created_at: auto (UTC timestamp)

3. Helper: diffChanges(oldRecord, newRecord): Change[]
   - Compares two objects, returns only fields that changed
   - Ignores updated_at (that's always changed)

4. Wrapper: withAudit(action, auditParams):
   - Executes the action
   - If successful, logs audit entry
   - Returns the action result
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: audit trail helper — logs every mutation to audit_log"
git push
```

---

### S3.2 — Orders API (2–3 hours)

**What this does:** The backend for creating, reading, updating orders. Every order created via WhatsApp or web goes through this.

**PROMPT:**
```
Read docs/database/SCHEMA.md for the orders table structure.
Read docs/security/EDGE_CASES.md for idempotency and safety rules.

Build the Orders API at src/app/api/orders/route.ts and src/app/api/orders/[id]/route.ts:

GET /api/orders
- List orders for the authenticated user's org
- Filter by: status, customer_id, date range, search query
- Pagination: page + limit (default 20)
- Sort by: created_at desc (default), order_number, customer name, amount
- ALWAYS filter: organization_id = user's org, deleted_at IS NULL
- Return: orders with customer name joined

POST /api/orders
- Create new order
- Validate with Zod schema (src/lib/validations/order.ts):
  - customer_id: required UUID
  - items: array of { product_id, quantity, unit_price_paise }
  - notes?: string
  - status: defaults to "confirmed"
- Calculate total_amount_paise from items
- Generate order_number from sequence
- Idempotency check: hash(org_id + customer_id + product_ids + quantities + date_hour)
  - If duplicate found within 1 hour → return existing order, don't create new one
- Write audit log entry via withAudit()
- Return created order

GET /api/orders/[id]
- Get single order with full details (items, customer, timeline)
- Verify org ownership

PATCH /api/orders/[id]
- Update order (status change, edit items, add notes)
- Optimistic locking: check updated_at matches before applying changes
- Log all changes to audit trail
- Status transitions: draft → confirmed → in_production → completed → delivered
  (only forward transitions allowed, no skipping steps)

Also create src/lib/validations/order.ts:
- Zod schema for order creation
- Zod schema for order update
- Validate: all amounts are positive integers (paise), quantities > 0
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
npm run dev

# Test with curl:
# (You'll need a valid auth token — or test after auth integration)
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Orders API — CRUD with idempotency, audit trail, optimistic locking"
git push
```

---

### S3.3 — Customers API + Page (2 hours)

**What this does:** Customers list and detail page on the web dashboard. Factory owners can see all their customers, add new ones, edit details.

**PROMPT:**
```
Build the Customers feature — API + web page.

API: src/app/api/customers/route.ts and src/app/api/customers/[id]/route.ts

GET /api/customers — list with search, pagination, sort
POST /api/customers — create with Zod validation (name, phone, city, GSTIN, aliases, credit_limit_paise, payment_terms_days)
GET /api/customers/[id] — single customer with order history summary
PATCH /api/customers/[id] — update (audit logged)

All routes: filter by org_id, deleted_at IS NULL, audit logged.
Create src/lib/validations/customer.ts with Zod schemas.

Web page: src/app/(dashboard)/customers/page.tsx
Replace the placeholder with a real page:

1. Customer list table:
   - Columns: Name, City, Phone, Outstanding Amount, Last Order Date
   - Search bar (searches name, aliases, phone)
   - "Add Customer" button → opens dialog/drawer

2. Add Customer dialog (shadcn/ui Dialog):
   - Form: Name, Phone, City, State, GSTIN (optional), Aliases (comma-separated), Credit Limit (₹), Payment Terms (days)
   - Zod validation
   - On submit: POST /api/customers
   - Success → close dialog, refresh list
   - All labels via next-intl

3. Click row → expand or navigate to detail view:
   - Customer info card
   - Recent orders table
   - Outstanding amount
   - Edit button → inline editing

Use Server Components where possible. "use client" only for interactive parts (forms, dialogs).
shadcn/ui: Table, Dialog, Input, Button, Badge.
Mobile-friendly: card layout on small screens instead of table.
```

**VERIFY:**
```bash
npm run dev
# Browser → /customers
# Should see table with seed data customers
# Click "Add Customer" → fill form → submit → new customer appears in table
# Search "Raju" → should filter to matching customers
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Customers API + web page with search, add, edit"
git push
```

---

### S3.4 — Orders Web Page (2–3 hours)

**What this does:** The orders page on the web dashboard — see all orders, filter by status, view details, create new orders from the web.

**PROMPT:**
```
Replace the orders placeholder page with a fully functional orders page.

src/app/(dashboard)/orders/page.tsx:

1. Orders table:
   - Columns: Order #, Customer, Products, Qty, Amount (₹), Status, Date
   - Status badges with colors: draft (gray), confirmed (blue), in_production (yellow), completed (green), delivered (purple)
   - Amount formatted as Indian currency (₹1,50,000)
   - Date formatted as IST (DD/MM/YYYY)

2. Filters bar:
   - Status filter (multi-select: all statuses)
   - Customer filter (searchable dropdown)
   - Date range picker
   - Search (order number, customer name)
   - "Export CSV" button (downloads filtered orders)

3. "New Order" button → opens multi-step dialog:
   Step 1: Select customer (searchable list)
   Step 2: Add line items (select product, enter quantity — auto-calculates from unit price)
   Step 3: Review total + notes → Confirm
   On submit: POST /api/orders → close dialog → refresh list

4. Click order row → order detail view:
   - Order info card (number, date, status, customer)
   - Line items table (product, qty, unit price, line total)
   - Status timeline (visual: draft → confirmed → in_production → completed → delivered)
   - Action buttons based on current status:
     - confirmed → "Start Production" button
     - in_production → "Mark Complete" button
     - completed → "Generate Invoice" button, "Mark Delivered" button
   - Audit trail section (who changed what, when)

Use src/lib/utils/currency.ts for formatting: paiseToCurrency()
Use src/lib/utils/date.ts for formatting: formatIST()
Mobile: card-based layout instead of table on small screens.
All text via next-intl.
```

**VERIFY:**
```bash
npm run dev
# Browser → /orders
# Should see table with 20 seed data orders
# Filter by "confirmed" → shows only confirmed orders
# Click an order → see detail view with timeline
# Click "New Order" → walk through multi-step form → creates order
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Orders web page — table, filters, detail view, create flow"
git push
```

---

### S3.5 — WhatsApp Order Intake — Flow Engine (3 hours)

**What this does:** Builds the pending_orders state machine and flow engine — the brain that routes customer messages and owner echoes to create orders. This is the core of the new architecture.

**ARCHITECTURE — read before coding:**
```
Customer: "500 piece valve body mokljo"
  → Webhook → handleCustomerMessage() → pending_order (state: detected)
  → Bot sends NOTHING

Owner (from his phone): "haa thai jase"
  → Echo → handleOwnerEcho() → classifyOwnerReply → AFFIRM
  → Bot posts ORDER DRAFT to chat:
      📋 Order Draft
      500 × Valve Body (pcs)
      Customer: Mehul Patel
      Ready by: — (reply "ok <date>" to set)
      Reply "ok" to confirm · /cancel to discard
  → pending_order state → draft_posted

Owner: "ok 15 june"
  → Echo → parseConfirmation → confirmed: true, promisedDate: 2026-06-15
  → Order created in orders table (status: confirmed, delivery_date: 2026-06-15)
  → Bot sends: "✅ Order Confirmed — ORD-2606-001\n500 × Valve Body"
  → pending_order state → confirmed
```

**PROMPT:**
```
Read docs/architecture/MESSAGE_PIPELINE.md completely (the new flow).
Read docs/ai/PROMPT_LIBRARY.md — OWNER_REPLY_CLASSIFIER, CONFIRMATION_PARSER,
MODIFY_ORDER parser, CANCEL_ORDER parser.
Read CLAUDE.md WhatsApp Rules A, B, C.
Look at src/app/api/orders/whatsapp-create/route.ts for existing order-creation logic.

PART 1 — Shared order creation module:
Create src/lib/orders/create-order.ts:
- createOrder(params: CreateOrderParams): Promise<CreateOrderResult>
- Accepts: { orgId, customerId, productId, quantity, unitPricePaise, deliveryDate, source, auditMetadata }
- Idempotency key: hash(org_id:customer_id:product_id:qty:date_hour)
- Returns existing order if duplicate within same hour
- Generates order_number via generate_order_number() RPC
- Writes audit log via logAudit()
- Used by BOTH the flow engine AND /api/orders/whatsapp-create
- DO NOT duplicate order-creation logic — one module, two callers

Update /api/orders/whatsapp-create/route.ts to call createOrder() instead of
having inline insert logic.

PART 2 — New AI functions in src/lib/ai/deepseek.ts:
Using prompts from PROMPT_LIBRARY.md:
1. classifyOwnerReply(customerMessage, pendingSummary, ownerReply)
   → { signal: 'AFFIRM'|'DECLINE'|'UNRELATED', confidence }
   Safety default on any failure: UNRELATED (never default to AFFIRM)

2. parseConfirmation(ownerReply, currentISTDate)
   → { confirmed: boolean, promisedDate: string|null, cancel: boolean }
   Safety default: { confirmed: false, promisedDate: null, cancel: false }

3. parseModification(originalOrderSummary, customerMessage)
   → { mode: 'add'|'replace'|'ambiguous', newQuantity, confidence }
   Safety default: { mode: 'ambiguous', newQuantity: 0, confidence: 0 }

PART 3 — Database migration for pending_orders:
Create supabase/migrations/20260610000002_create_pending_orders.sql:
TABLE pending_orders:
- id UUID PK, organization_id UUID NOT NULL FK
- customer_id UUID FK (nullable), customer_phone TEXT NOT NULL
- intent TEXT NOT NULL CHECK IN ('NEW_ORDER','MODIFY_ORDER','CANCEL_ORDER')
- target_order_id UUID FK orders (for modify/cancel)
- extraction JSONB NOT NULL (full AI output)
- state TEXT NOT NULL DEFAULT 'detected'
  CHECK IN ('detected','draft_posted','confirmed','cancelled','expired')
- source_message_id TEXT NOT NULL (customer wamid that triggered this)
- draft_message_id TEXT (wamid of the draft we sent)
- confirmed_order_id UUID FK orders
- expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
- created_at, updated_at, deleted_at (standard)
- Partial unique index: ONE active (detected|draft_posted) per (org_id, customer_phone)
- RLS: enabled (same tenant isolation pattern as other tables)

Also add to organizations migration:
- whatsapp_phone_number_id TEXT UNIQUE (primary webhook→org routing key)
- whatsapp_display_number TEXT (fallback)

Also add to whatsapp_messages migration:
- is_echo BOOLEAN NOT NULL DEFAULT FALSE
- chat_phone TEXT

PART 4 — Flow engine at src/lib/whatsapp/flow-engine.ts:

handleCustomerMessage(orgId, customerPhone, customerId|null, text, messageId):
- If customerId is null → return immediately (unknown sender, already handled)
- Build orgContext → call routeAndProcess (model-router)
- On actionable intent (NEW_ORDER/MODIFY_ORDER/CANCEL_ORDER) with eval score >= 0.5:
  → expire any existing pending for this chat (application-side invariant)
  → insert pending_order (state: detected)
- On informational intent (ORDER_STATUS, GENERAL_QUERY, etc.): log only, no pending

handleOwnerEcho(orgId, chatPhone, text, messageId):
- If text starts with '/' → handleCommand(orgId, chatPhone, text)
- Get active pending (lazily expire past expires_at first)
- If pending.state = 'detected':
  → classifyOwnerReply → AFFIRM: build draft + send → state=draft_posted
  → DECLINE: state=cancelled
  → UNRELATED: nothing
- If pending.state = 'draft_posted':
  → parseConfirmation:
    confirmed+NEW_ORDER: createOrder() → send ✅ → state=confirmed
    confirmed+CANCEL_ORDER: update order status=cancelled + audit → send ✅ → state=confirmed
    confirmed+MODIFY_ORDER: update qty + recalc total + audit → send ✅ → state=confirmed
    cancel: state=cancelled, no send
    ambiguous MODIFY: re-post disambiguation question, stay draft_posted
    unrecognized: stay draft_posted, keep waiting

handleCommand(orgId, chatPhone, command):
- /status → fetch open orders for chat customer ONLY (filter customer_id + org_id)
  Build status summary with production progress → send
- /cancel → expire active pending for this chat, stay silent
- /edit <text> → re-run extraction, re-post draft
- /order <text> → run handleCustomerMessage then immediately auto-affirm (skip echo step)

All customer-visible text must use org language preference (gu/hi/en).
```

**VERIFY:**
```bash
supabase db reset     # migrations apply cleanly
npm run type-check    # Zero errors
npm run dev

# Full flow test (requires local Supabase + seeded org):
npx tsx --env-file=.env.local scripts/test-webhook.ts
# All 7 scenarios should pass

# Manual WhatsApp test (if connected):
# 1. Send from a seeded customer phone: "500 piece valve body mokljo"
# 2. Check whatsapp_messages → 1 inbound row, is_echo=false
# 3. Check pending_orders → 1 row, state=detected
# 4. Reply from owner phone: "haa thai jase"
# 5. Check pending_orders → state=draft_posted
# 6. Check WhatsApp → 📋 Order Draft appears in chat
# 7. Reply "ok 15 june"
# 8. Check orders table → new order with delivery_date set
# 9. Check WhatsApp → ✅ Order Confirmed message
```

**COMMIT:**
```bash
git add . && git commit -m "feat: WhatsApp order intake — flow engine, pending_orders, echo-confirmed flow"
git push
```

---

### S3.6 — Invoice PDF Generation (2 hours)

**What this does:** Generates professional PDF invoices from orders. Factory owners can send these to customers via WhatsApp or download from the web.

**PROMPT:**
```
Build invoice PDF generation using Puppeteer.

1. Install Puppeteer:
   npm install puppeteer

2. Create src/lib/utils/pdf-generator.ts:
   - generateInvoicePDF(invoice: InvoiceData): Promise<Buffer>
   - Creates HTML template → renders with Puppeteer → returns PDF buffer

3. Invoice HTML template (create as a function that returns HTML string):
   - Header: Company name, address, GSTIN, logo placeholder
   - Invoice details: Invoice #, Date, Due Date
   - Customer details: Name, address, GSTIN
   - Line items table: Product, HSN, Qty, Rate, Amount
   - Subtotal, GST breakdown (CGST + SGST for intrastate, IGST for interstate)
   - Total in words (Indian English: "Rupees One Lakh Fifty Thousand Only")
   - Footer: Bank details, terms & conditions
   - Styled for A4 printing

4. GST calculation logic in src/lib/utils/gst.ts:
   - For same-state (Gujarat→Gujarat): CGST 9% + SGST 9% = 18%
   - For different state: IGST 18%
   - Determine from org GSTIN (first 2 digits = state code) vs customer GSTIN
   - All amounts in paise, rounded correctly

5. API endpoint: POST /api/invoices/[id]/pdf
   - Fetches invoice data from DB
   - Calls generateInvoicePDF()
   - Returns PDF as downloadable file
   - Cache generated PDF in Supabase Storage (re-generate only if invoice changes)

All monetary displays in Indian format: ₹1,50,000.00
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
npm run dev

# Test: navigate to an order that's "completed" → click "Generate Invoice"
# Should download a PDF → open it → should look like a real invoice
```

**COMMIT:**
```bash
git add . && git commit -m "feat: invoice PDF generation — Puppeteer + GST calculation"
git push
```

---

### S3.7 — Invoices API + Page (2 hours)

**What this does:** Backend + web page for invoices — create from orders, track payment status, see overdue invoices.

**PROMPT:**
```
Build the Invoices feature — API + web page.

API: src/app/api/invoices/route.ts and src/app/api/invoices/[id]/route.ts

GET /api/invoices — list with filters (status: draft/sent/paid/overdue, customer, date range)
POST /api/invoices — create from order (link to order_id, copy line items, calculate GST)
PATCH /api/invoices/[id] — update status, record payment
  - When status changes to "paid": record payment_date, payment_mode (UPI/cash/cheque/bank transfer)

Create src/lib/validations/invoice.ts with Zod schemas.
All mutations audit-logged.

Web page: src/app/(dashboard)/invoices/page.tsx:

1. Invoice list table:
   - Columns: Invoice #, Customer, Amount, Status, Due Date, Actions
   - Status badges: draft (gray), sent (blue), paid (green), overdue (red)
   - Overdue = due_date < today AND status != paid
   - Sort by due date (most urgent first)

2. "Create Invoice" → select from completed orders that don't have invoices yet
   - Auto-populates line items from order
   - Editable: add GST, adjust amounts, set payment terms
   - Preview PDF before saving

3. Invoice detail view:
   - All invoice data
   - Download PDF button
   - "Send via WhatsApp" button (sends PDF + template message)
   - "Record Payment" button → dialog: amount, date, mode
   - Payment history

4. Summary cards at top:
   - Total outstanding (all unpaid invoices)
   - Overdue amount
   - Paid this month
   - All amounts in ₹ with Indian formatting
```

**VERIFY:**
```bash
npm run dev
# Browser → /invoices
# Should see seed data invoices
# Create invoice from a completed order → should generate with GST
# Download PDF → should look professional
# Record payment → status should change to "paid"
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Invoices API + web page — create, track, PDF, payments"
git push
```

---

### S3.8 — Payment Reminders (n8n workflow) (1–2 hours)

**What this does:** Automatically sends WhatsApp reminders when invoices are overdue. No more manually chasing payments.

**PROMPT:**
```
Create an n8n workflow for automated payment reminders.
Save as n8n/workflows/payment-reminder.json.

Workflow logic:

1. TRIGGER: Cron schedule — runs daily at 10:00 AM IST

2. FETCH: HTTP Request to GET /api/invoices?status=overdue
   - Gets all overdue invoices across all organizations

3. FOR EACH overdue invoice:
   - Calculate days overdue (today - due_date)
   - Determine reminder tier:
     - 1-3 days overdue → "Gentle reminder" template
     - 4-7 days overdue → "Follow-up" template
     - 8-14 days overdue → "Urgent" template
     - 15+ days overdue → "Final notice" template
   - Don't send more than 1 reminder per invoice per day (check last_reminder_sent)

4. SEND: Call Meta Cloud API (via our /api/whatsapp/send endpoint) to send WhatsApp template message
   - Use the appropriate payment_reminder template
   - Variables: customer name, invoice number, amount, days overdue

5. UPDATE: Call PATCH /api/invoices/[id] to record reminder sent
   - Update last_reminder_sent timestamp

6. LOG: HTTP Request to log reminder activity

Also create a /api/invoices/overdue endpoint that returns overdue invoices
with customer phone numbers for the n8n workflow to use.
```

**VERIFY:**
```bash
# Import workflow into n8n → test run manually
# Should fetch overdue invoices from seed data
# Should show correct reminder tier for each

npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: automated payment reminders — n8n workflow + overdue API"
git push
```

---

### S3.9 — Daily Order Summary (n8n workflow) (1 hour)

**What this does:** Every morning, the factory owner gets a WhatsApp summary of yesterday's orders and today's production schedule.

**PROMPT:**
```
Create an n8n workflow for daily order summaries.
Save as n8n/workflows/daily-order-summary.json.

1. TRIGGER: Cron — daily at 8:00 AM IST

2. FOR EACH organization:
   - Fetch yesterday's orders (created_at between yesterday 00:00 and 23:59 IST)
   - Fetch today's production schedule (orders with status: in_production)
   - Fetch overdue invoices count + total amount

3. BUILD summary message:
   "📊 Daily Summary — [Date]
   
   Yesterday's Orders: [count]
   Total Value: ₹[amount]
   
   Today's Production: [count] orders
   [list of order numbers + products]
   
   ⚠️ Overdue Invoices: [count] (₹[amount])
   
   Reply /orders for details"

4. SEND via Meta Cloud API (via our /api/whatsapp/send endpoint) to the org owner's WhatsApp number

5. Only send if there's actual data (don't send empty summaries)
```

**VERIFY:**
```bash
# Import into n8n → test run → should generate summary from seed data
```

**COMMIT:**
```bash
git add . && git commit -m "feat: daily order summary WhatsApp workflow"
git push
# Sprint 3 complete!
```

---
---

# SPRINT 4 — EVAL LOOP + DATA SAFETY (Weeks 7–8)
**Goal: AI gets smarter over time, data can never be accidentally destroyed**
**Sessions: 8**

---

### S4.1 — AI Benchmark Creation (2–3 hours)

**What this does:** Creates 1000 test cases across 10 Gujarat MSME industries, covering Gujlish (Roman-script Gujarati), Hinglish, Hindi, and English. Heavy coverage of factory slang, phonetic misspellings, and voice-to-text errors. A Python generator script produces the cases from industry catalogs.

**STATUS: DONE** — benchmark.json v3.0.0 with 1000 cases is already generated.
- Generator: `tests/ai/generate-benchmark.py`
- Output: `tests/ai/benchmark.json` (469KB)
- Distribution: easy:100, medium:200, hard:200, edge:250, gujlish:250
- Languages: gujlish:580, hinglish:260, en:107, hi:53
- Industries: 100 cases each across foundry, textiles, ceramics, chemicals, pharma, auto_parts, plastics, diamond, food_processing, agri

To regenerate after changing catalogs:
```bash
cd tests/ai && python3 generate-benchmark.py
```

**VERIFY:**
```bash
cat tests/ai/benchmark.json | python3 -m json.tool > /dev/null
# No errors — valid JSON, 1000 cases, no duplicate IDs
```

**COMMIT:**
```bash
git add . && git commit -m "feat: 1000-case AI benchmark — 10 industries, Gujlish/Hinglish/Hindi/English"
git push
```

---

### S4.2 — Benchmark Runner (2 hours)

**PROMPT:**
```
Build the benchmark test runner at tests/ai/run-benchmark.ts.

This script:
1. Loads tests/ai/benchmark.json
2. For each test case:
   a. Sends message to DeepSeek via model-router
   b. Runs eval gate scoring
   c. Compares results against expected values
   d. Records: pass/fail, actual vs expected, latency, token usage
3. Outputs summary:
   - Total: X/1000 passed (XX%)
   - By industry: foundry X/100, textiles X/100, ceramics X/100, ... (10 industries)
   - By difficulty: easy XX%, medium XX%, hard XX%, edge XX%
   - By language: gujlish XX%, hinglish XX%, hindi XX%, english XX%
   - By dimension: customer match XX%, product match XX%, quantity XX%, intent XX%
   - Average latency: XXXms
   - Total tokens used: XXXX
   - Estimated cost: ₹XX
4. Saves detailed results to tests/ai/benchmark-results-[timestamp].json
5. FAIL (exit code 1) if overall pass rate < 80%

Make it runnable as: npm run test:benchmark
Update package.json script if needed.

Pass criteria per test case:
- Intent matches expected_intent → +1
- Customer fuzzy-matches expected customer (confidence > 0.80) → +1
- Product fuzzy-matches expected product (confidence > 0.80) → +1
- Quantity exact match → +1
- Eval gate score >= expected_min_score → +1
- Pass if 4/5 or 5/5 criteria met
```

**VERIFY:**
```bash
npm run test:benchmark
# Should run all 1000 cases (takes 10-20 minutes — API calls)
# Should output pass rate — aim for > 80%
# Should save results file
# Layer 0 dialect lookup runs before each AI call — verify resolved tokens logged
```

**COMMIT:**
```bash
git add . && git commit -m "feat: AI benchmark runner — 1000 cases across 10 industries, auto-scored"
git push
```

---

### S4.3 — Correction Pipeline (1 hour)

**PROMPT:**
```
Build a correction → new test case pipeline.

When an AI extraction is wrong and the user corrects it (via WhatsApp "Edit" button):

1. Log the correction to a corrections table:
   - original_message, wrong_extraction, correct_extraction, user_id, org_id, timestamp

2. Create a script: scripts/corrections-to-benchmark.ts
   - Reads recent corrections from the database
   - Converts each into a benchmark test case format
   - Appends to tests/ai/benchmark.json
   - Avoids duplicates (checks if similar message already exists)

3. Over time, this grows the benchmark from 1000 → 2000+ cases automatically.

4. DIALECT LEARNING INTEGRATION:
   When a correction reveals a dialect issue (AI didn't know a word/alias):
   - Call analyzeCorrection() from src/lib/ai/dialect-learner.ts
   - If is_dialect_issue=true, call learnFromCorrection() to:
     a. Upsert the new term→canonical mapping into org_dictionary (Tier 4)
     b. Check promotion eligibility (3+ orgs → industry/global dictionary)
   - This means corrections improve BOTH the benchmark AND the dialect dictionary

Also create the database migration for the corrections table:
- supabase/migrations/20260621000002_create_corrections_table.sql
  (the illustrative 20260615000001 collided with the applied
  20260615000001_create_invoices_storage_bucket.sql, so it was bumped)
```

**VERIFY:**
```bash
supabase db reset    # Migration applies without error
npm run type-check   # Zero errors
# Test: simulate a correction → verify it creates a benchmark case AND updates org_dictionary
```

**COMMIT:**
```bash
git add . && git commit -m "feat: correction pipeline — wrong AI outputs become test cases + dialect learning"
git push
```

---

### S4.3b — Dialect Dictionary: Migration + Static Files (2 hours)

**What this does:** Creates the 5-tier dialect dictionary system that pre-processes WhatsApp messages BEFORE they hit the AI. Resolves known Gujarati/Gujlish/Hindi words at zero API cost — numbers ("pachso"→500), verbs ("moklo"→send), industry jargon, and org-specific aliases.

**PROMPT:**
```
Read docs/ai/DIALECT_DICTIONARY.md completely — this is the 5-tier lookup system spec.
Read docs/database/SCHEMA.md — the 3 new dictionary tables (org_dictionary, industry_dictionary, global_dictionary).
Read docs/security/RLS_POLICIES.md — the dialect dictionary RLS section.

PART 1: Create Supabase migration for 3 dictionary tables.
File: supabase/migrations/20260619000001_create_dialect_tables.sql

TABLE industry_dictionary (platform-wide, no org_id):
- id UUID PK, term TEXT NOT NULL, term_normalized TEXT NOT NULL
- canonical TEXT NOT NULL, category TEXT NOT NULL
  CHECK IN ('product','unit','process','defect','material','tool','measurement')
- industry_segment TEXT NOT NULL, language TEXT DEFAULT 'gujlish'
- confidence NUMERIC(3,2) DEFAULT 1.0, source TEXT DEFAULT 'seed'
- promotion_count INT DEFAULT 0, is_active BOOLEAN DEFAULT TRUE
- created_at, updated_at (NO deleted_at — platform table)
- UNIQUE (term_normalized, industry_segment) WHERE is_active = TRUE
- RLS: enabled, SELECT for authenticated, no INSERT/UPDATE for anon

TABLE org_dictionary (per-org, standard RLS):
- id UUID PK, organization_id UUID NOT NULL FK
- term TEXT NOT NULL, term_normalized TEXT NOT NULL
- canonical TEXT NOT NULL, category TEXT NOT NULL
  CHECK IN ('product','customer','vendor','unit','alias','custom')
- entity_id UUID (FK to products/customers/vendors), entity_type TEXT
- source TEXT DEFAULT 'onboarding', confidence NUMERIC(3,2) DEFAULT 1.0
- is_active BOOLEAN DEFAULT TRUE
- created_at, updated_at, deleted_at (standard soft delete)
- UNIQUE (organization_id, term_normalized) WHERE deleted_at IS NULL AND is_active
- RLS: enabled, standard tenant isolation

TABLE global_dictionary (platform-wide, no org_id):
- id UUID PK, term TEXT NOT NULL, term_normalized TEXT NOT NULL
- canonical TEXT NOT NULL, category TEXT NOT NULL
  CHECK IN ('number','verb','noun','unit','greeting','slang')
- language TEXT DEFAULT 'gujlish'
- taught_by_count INT DEFAULT 1, first_seen_at TIMESTAMPTZ DEFAULT now()
- last_confirmed_at TIMESTAMPTZ DEFAULT now()
- confidence NUMERIC(3,2) DEFAULT 0.7, is_active BOOLEAN DEFAULT TRUE
- created_at, updated_at (NO deleted_at — platform table)
- UNIQUE (term_normalized, canonical) WHERE is_active = TRUE
- RLS: enabled, SELECT for authenticated, no INSERT/UPDATE for anon

PART 2: Verify these static JSON files exist and are valid:
- src/config/dialect/universal.json (Tier 1: ~350 entries — numbers, verbs, postpositions, time words, units, honorifics)
- src/config/dialect/business.json (Tier 2: ~200 entries — order, payment, invoice, delivery, inventory, production, compliance terms)

If they don't exist, create them following DIALECT_DICTIONARY.md specs.
```

**VERIFY:**
```bash
supabase db reset
# All migrations apply including new dictionary tables

# Check tables exist:
# http://localhost:54323 → Table Editor → industry_dictionary, org_dictionary, global_dictionary

# Validate JSON files:
cat src/config/dialect/universal.json | python3 -m json.tool > /dev/null
cat src/config/dialect/business.json | python3 -m json.tool > /dev/null
```

**COMMIT:**
```bash
git add . && git commit -m "feat: dialect dictionary — 3 DB tables + static Tier 1/2 JSON files"
git push
```

---

### S4.3c — Dialect Dictionary: Lookup Module (2–3 hours)

**What this does:** The core lookup engine. Every WhatsApp message passes through this BEFORE hitting DeepSeek. It tokenizes the message, looks up each token across 5 tiers (org→industry→global→business→universal), and returns pre-resolved entities that the AI validates rather than discovers from scratch.

**PROMPT:**
```
Read docs/ai/DIALECT_DICTIONARY.md — especially the "Lookup Algorithm" and "Normalization" sections.
Read docs/ai/DATA_ALIGNMENT_ENGINE.md — Layer 0 integration.

Build src/lib/ai/dialect-lookup.ts:

1. normalizeDialectTerm(raw: string): string
   - Lowercase, trim whitespace
   - Remove punctuation except hyphens
   - Unicode NFC normalization
   - Strip trailing honorifics: -bhai, -saheb, -ben, -ji, -seth, -sheth, -kaka
   - Collapse multiple spaces to single

2. tokenize(message: string): string[]
   - Split on whitespace
   - Also try 2-gram and 3-gram sliding windows (for multi-word terms like "valve body")
   - Return all possible token combinations, longest first

3. lookupDialect(params: DialectLookupParams): Promise<DialectLookupResult>
   Params: { message, orgId, industrySegment }
   
   Algorithm:
   a. Tokenize the message
   b. For each token (longest first, greedy match):
      - Tier 4: query org_dictionary WHERE organization_id = orgId AND term_normalized = normalize(token) AND is_active AND deleted_at IS NULL
      - Tier 3: query industry_dictionary WHERE industry_segment = industrySegment AND term_normalized = normalize(token) AND is_active
      - Tier 5: query global_dictionary WHERE term_normalized = normalize(token) AND is_active
      - Tier 2: lookup in business.json (in-memory, loaded once at startup)
      - Tier 1: lookup in universal.json (in-memory, loaded once at startup)
      - First hit wins — stop checking lower tiers for this token
   c. Build pre-structured hints:
      - If a number was resolved → pre_structured.quantity = resolved value
      - If a product was resolved → pre_structured.product_hint = canonical
      - If a customer alias was resolved → pre_structured.customer_hint = canonical
      - If an intent verb was resolved → pre_structured.intent_hint = mapped intent
   
   Return DialectLookupResult:
   {
     resolved_tokens: Array<{ token, canonical, tier, category, confidence }>,
     pre_structured: { quantity?, customer_hint?, product_hint?, intent_hint? },
     unresolved_tokens: string[],
     raw_message: string,
     lookup_time_ms: number
   }

4. Caching:
   - Cache org_dictionary per org for 5 minutes (Map<orgId, {entries, expiry}>)
   - Cache industry_dictionary per segment for 30 minutes
   - global_dictionary cached for 30 minutes
   - Static JSON (Tier 1/2) loaded once at module init, never expires

5. Types in src/types/ai.ts:
   - DialectLookupParams, DialectLookupResult, ResolvedToken, PreStructuredHints

6. Integration point:
   - Update src/lib/ai/model-router.ts routeAndProcess():
     BEFORE calling classifyIntent, call lookupDialect()
     If resolved_tokens exist → use Prompt #9 (dialect-aware) instead of Prompt #1
     Pass DialectLookupResult alongside raw message to AI
```

**VERIFY:**
```bash
npm run type-check   # Zero errors

# Manual test in Node REPL or a test script:
# lookupDialect({ message: "pachso valv bodi moklo", orgId: "...", industrySegment: "foundry" })
# Expected: resolved_tokens includes pachso→500 (tier 1), moklo→send (tier 1)
# pre_structured.quantity = 500, pre_structured.intent_hint = "NEW_ORDER"
```

**COMMIT:**
```bash
git add . && git commit -m "feat: dialect lookup module — 5-tier token resolution with caching"
git push
```

---

### S4.3d — Dialect Dictionary: Learning Module (2 hours)

**What this does:** When an owner corrects a draft, the system learns. If the AI misidentified "pamp bodi" as "Valve Body" and the owner changed it to "Pump Housing", the correction gets stored so it never happens again. When 3+ orgs teach the same word, it gets promoted to the shared dictionary.

**PROMPT:**
```
Read docs/ai/DIALECT_DICTIONARY.md — "Learning Loop" and "Promotion Logic" sections.
Read docs/ai/PROMPT_LIBRARY.md — Prompt #11 (Correction Analyzer).

Build src/lib/ai/dialect-learner.ts:

1. analyzeCorrection(params: CorrectionParams): Promise<CorrectionAnalysis>
   Params: { rawMessage, aiExtraction, ownerCorrection, orgId, industrySegment, orgDictionarySummary }
   
   - Call Prompt #11 via model-router (DeepSeek)
   - Returns: { is_dialect_issue, new_mappings: [{term, canonical, category, likely_scope}], reasoning }
   - Zod-validate the AI response

2. learnFromCorrection(analysis: CorrectionAnalysis, orgId: string): Promise<void>
   For each new_mapping:
   a. Upsert into org_dictionary (Tier 4):
      - term_normalized = normalizeDialectTerm(term)
      - Link entity_id if category is 'product' or 'customer' (fuzzy match canonical against master data)
      - source = 'owner_correction', confidence = 0.9
      - If already exists, bump confidence (max 1.0)
   b. Check promotion eligibility:
      - Query org_dictionary across ALL orgs for same term_normalized→canonical
      - If 3+ different orgs have this mapping AND likely_scope = 'industry':
        → Upsert into industry_dictionary (Tier 3) via service-role
        → Set promotion_count = number of confirming orgs
      - If 3+ orgs across ANY industry:
        → Upsert into global_dictionary (Tier 5) via service-role
        → Set taught_by_count = number of confirming orgs

3. generateOnboardingDictionary(params: OnboardingParams): Promise<OnboardingDictResult>
   Params: { orgId, industrySegment, products, customers, languagePreference }
   
   - Call Prompt #10 via model-router (DeepSeek)
   - Returns generated aliases for each product and customer
   - Bulk-insert into org_dictionary with source = 'onboarding_ai'
   - These entries have confidence = 0.7 (AI-generated, not owner-confirmed)

4. confirmOnboardingEntry(orgId: string, entryId: string): Promise<void>
   - Owner reviews AI-generated aliases on "Dictionary Review" screen
   - Confirmed → confidence bumps to 1.0
   - Rejected → is_active = false (soft disable)

5. Types in src/types/ai.ts:
   - CorrectionParams, CorrectionAnalysis, OnboardingParams, OnboardingDictResult
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
```

**COMMIT:**
```bash
git add . && git commit -m "feat: dialect learning module — corrections, promotions, onboarding generator"
git push
```

---

### S4.3e — Dialect Dictionary: Seed Industry Data (1–2 hours)

**What this does:** Pre-loads the industry_dictionary with jargon for 50 Gujarat MSME segments — foundry, textiles, ceramics, chemicals, pharma, auto parts, plastics, diamond, food processing, agri, and 40 more. Factory owners get accurate results from day one.

**PROMPT:**
```
Read docs/ai/DIALECT_DICTIONARY.md — "Tier 3: Industry Dictionary" section.

Create supabase/migrations/20260619000002_seed_industry_dictionary.sql:

Seed industry_dictionary with terms for these 10 major Gujarat MSME industries
(~20-30 terms each = ~250 rows total):

1. foundry: saancho→mould, dhatu→metal, casting→casting, bhatti→furnace, lokhandi→iron, pittal→brass, tambanu→copper, kaathli→lathe, chamkavo→polish, ghadhvo→forge, pattern→pattern, chhippu→chip/flash, pighlaavu→melt, taliya→sprue, riser→riser
2. textiles: thaan→bolt, kapadh→cloth/fabric, dhago→thread/yarn, rangaai→dyeing, vanavat→weaving, chhapkaam→printing, suti→cotton, reshmi→silk, bunvu→weave, katraan→cutting_waste, khadi→handloom, synthetic→synthetic, metre→metres, loom→loom
3. ceramics: rangoli→glaze, bhatti→kiln, maati→clay, tile→tile, firing→firing, vitrified→vitrified, slip→slip, biscuit→bisque, polski→polish, sanitaryware→sanitaryware, tableware→tableware
4. chemicals: dravya→chemical, acid→acid, alkali→alkali, solvent→solvent, catalyst→catalyst, compound→compound, batch→batch, reactor→reactor, distillation→distillation, pigment→pigment
5. pharma: goli→tablet, capsule→capsule, dawai→medicine, syrup→syrup, injection→injection, batch→batch, strip→strip, formulation→formulation, api→api_ingredient, excipient→excipient
6. auto_parts: patti→sheet, nut_bolt→nut_bolt, washer→washer, bearing→bearing, brake→brake, silencer→silencer, radiator→radiator, clutch→clutch, gasket→gasket, bushing→bushing
7. plastics: danu→granules, mould→mould, injection→injection_moulding, extrusion→extrusion, blow→blow_moulding, pet→pet, hdpe→hdpe, pp→polypropylene, scrap→regrind, preform→preform
8. diamond: heero→diamond, polishing→polishing, ghaat→faceting, kaankaro→rough_stone, four_p→4p_cut, marking→marking, sawing→sawing, laser→laser_cutting, carat→carat, sieve→sieve_size
9. food_processing: masalo→spice, daal→lentil, tel→oil, ghee→ghee, atta→flour, packaging→packaging, grading→grading, cleaning→cleaning, roasting→roasting, grinding→grinding
10. agri: khaatar→fertilizer, beej→seed, dawai→pesticide, paak→crop, sinchai→irrigation, tractor→tractor, harvest→harvest, spray→spraying, soil→soil, organic→organic

All terms in Gujlish (Roman-script Gujarati). Set language='gujlish', source='seed', confidence=1.0.
Include Gujarati script variants where common.
```

**VERIFY:**
```bash
supabase db reset
# Check industry_dictionary table → should have ~250 rows across 10 segments

# Quick count check:
# http://localhost:54323 → SQL Editor
# SELECT industry_segment, COUNT(*) FROM industry_dictionary GROUP BY industry_segment;
# Each segment should have 15-30 entries
```

**COMMIT:**
```bash
git add . && git commit -m "feat: seed industry dictionary — 250 terms across 10 Gujarat MSME segments"
git push
```

---

### S4.4 — Soft Delete System (1–2 hours)

**PROMPT:**
```
Read CLAUDE.md security rule #2: "NEVER hard delete any record."
Read docs/security/EDGE_CASES.md for soft delete patterns.

Implement comprehensive soft delete across the entire application:

1. Create src/lib/utils/soft-delete.ts:
   - softDelete(table, id, orgId, userId): Promise<void>
     - Sets deleted_at = NOW()
     - Logs to audit trail
   - restore(table, id, orgId, userId): Promise<void>
     - Sets deleted_at = NULL
     - Logs to audit trail
   - Verify org ownership before any delete/restore

2. Update ALL existing API routes to:
   - ALWAYS include "deleted_at IS NULL" in queries (defense in depth over RLS)
   - Use softDelete() instead of actual DELETE
   - Return 404 for soft-deleted records (not the actual data)

3. Update ALL list queries to filter deleted_at IS NULL

4. Add "Undo Delete" capability:
   - When something is deleted, show a toast: "Deleted. [Undo]"
   - Undo button calls restore() within 30 seconds
   - After 30 seconds, undo disappears

5. Admin route to view deleted records (for recovery):
   - GET /api/admin/deleted?table=orders → shows soft-deleted records
   - POST /api/admin/restore → restores a specific record
```

**VERIFY:**
```bash
npm run dev
# Go to /customers → delete a customer → should see "Deleted. [Undo]" toast
# Click Undo → customer reappears
# Check database → deleted_at is set then cleared
# Try to view deleted customer directly → should get 404
```

**COMMIT:**
```bash
git add . && git commit -m "feat: soft delete system — delete, restore, undo toast, audit trail"
git push
```

---

### S4.5 — Destructive Action Confirmations (1–2 hours)

**PROMPT:**
```
Read docs/security/EDGE_CASES.md for the confirmation patterns.

Implement destructive action confirmations for both WhatsApp and web:

WEB:
1. Create a reusable ConfirmDialog component (shadcn/ui AlertDialog):
   - Title: "Are you sure?"
   - Description: explains what will happen
   - Buttons: "Cancel" (default focus) + "Confirm Delete" (red)
   - For extra-dangerous actions: require typing the item name to confirm

2. Apply to all destructive actions:
   - Delete customer → "This will hide [Customer Name] from all lists. You can undo this."
   - Cancel order → "This will cancel Order #[number]. This cannot be undone."
   - Change order status backward → "Going back to [status] will reset production data."

WHATSAPP:
3. When user says "delete" or "cancel" on WhatsApp:
   - Send confirmation: "⚠️ Delete [item]? This action will [explanation]. Reply YES to confirm."
   - Wait for explicit "YES" or "हा" or "હા" confirmation
   - Any other response → cancel the delete

4. Never auto-delete. Never delete on first request. Always confirm.
```

**VERIFY:**
```bash
npm run dev
# Try to delete a customer → confirmation dialog appears → must click confirm
# Try to cancel an order → confirmation dialog with explanation
```

**COMMIT:**
```bash
git add . && git commit -m "feat: destructive action confirmations — web dialogs + WhatsApp safety"
git push
```

---

### S4.6 — Idempotency Checks (1 hour)

**PROMPT:**
```
Read docs/security/EDGE_CASES.md for idempotency rules.

Strengthen idempotency across the app:

1. Order creation idempotency (already partially built):
   - Idempotency key = hash(org_id + customer_id + sorted product_ids + sorted quantities + date_hour)
   - Before creating: check if order with same key exists in last 1 hour
   - If exists: return existing order with flag { duplicate: true, existing_order_id }
   - On WhatsApp: "This looks like a duplicate of Order #[number] from [time ago]. Create anyway? [Yes] [No]"

2. Invoice creation idempotency:
   - One invoice per order (unless explicitly creating a partial invoice)
   - Check: if order already has an invoice → warn before creating another

3. Payment recording idempotency:
   - hash(invoice_id + amount + date)
   - Prevent double-recording the same payment

4. API-level idempotency:
   - Accept optional X-Idempotency-Key header on all POST requests
   - If same key seen within 1 hour → return cached response
   - Store in a simple key-value table or in-memory cache
```

**VERIFY:**
```bash
npm run dev
# Create an order → try to create identical order within 1 hour → should warn about duplicate
```

**COMMIT:**
```bash
git add . && git commit -m "feat: idempotency checks — orders, invoices, payments"
git push
```

---

### S4.7 — Sentry Error Monitoring (1 hour)

**PROMPT:**
```
Set up Sentry error monitoring for the Next.js app.

1. Install: npm install @sentry/nextjs

2. Configure Sentry:
   - sentry.client.config.ts
   - sentry.server.config.ts
   - sentry.edge.config.ts
   - Update next.config.ts with Sentry webpack plugin

3. Error context:
   - Always include: org_id, user_role, action being performed
   - NEVER include: full phone numbers, GSTIN numbers, monetary amounts, passwords
   - Mask phone: 91XXXX1234
   - Mask GSTIN: XXXXXXXXXXXX1ZX

4. Create src/lib/utils/sentry.ts:
   - captureWithContext(error, context): wraps Sentry.captureException with masked context
   - Use this everywhere instead of raw Sentry calls

5. Update ALL existing catch blocks to use captureWithContext instead of console.error
```

**VERIFY:**
```bash
npm run build   # Should build with Sentry integration
# Trigger a test error → check Sentry dashboard → should see the error with context
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Sentry error monitoring with masked context"
git push
```

---

### S4.8 — CSV Data Export (1 hour)

**PROMPT:**
```
Build CSV export functionality for all major data types.

1. Create src/lib/utils/csv-export.ts:
   - exportToCSV(data: Record<string, unknown>[], filename: string): Response
   - Handles: proper CSV escaping, Unicode (Gujarati/Hindi names), BOM for Excel compatibility
   - Monetary values exported as rupees (not paise) with 2 decimal places

2. API endpoints:
   - GET /api/orders/export?format=csv&status=confirmed&from=2026-01-01&to=2026-06-30
   - GET /api/invoices/export?format=csv
   - GET /api/customers/export?format=csv

3. Web integration:
   - "Export CSV" button on Orders, Invoices, Customers pages
   - Exports current filtered view (respects active filters)
   - Downloads file: vyaops-orders-2026-06-15.csv

4. Column mappings:
   - Orders: Order#, Customer, Products, Qty, Amount(₹), Status, Date
   - Invoices: Invoice#, Customer, Amount(₹), GST(₹), Total(₹), Status, Due Date
   - Customers: Name, City, Phone, GSTIN, Outstanding(₹), Last Order
```

**VERIFY:**
```bash
npm run dev
# Go to /orders → click "Export CSV" → downloads file
# Open in Excel → data should be correct, Gujarati names should display properly
```

**COMMIT:**
```bash
git add . && git commit -m "feat: CSV export for orders, invoices, customers"
git push
# Sprint 4 complete!
```

---
---

# SPRINT 5 — PRODUCTION + INVENTORY + VENDORS (Weeks 9–10)
**Goal: Track what's being made, what's in stock, and where materials come from**
**Sessions: 9**

---

### S5.1 — Production Batch Logging via WhatsApp (2 hours)

**PROMPT:**
```
Read docs/database/SCHEMA.md for the production_batches table structure.

Build production logging that workers can do from the factory floor via WhatsApp:

IMPORTANT: All WhatsApp messages pass through Layer 0 (dialect dictionary lookup via
src/lib/ai/dialect-lookup.ts) BEFORE hitting the AI. This means production-related
Gujarati/Gujlish terms like "utpadan" (production), "nakaro" (rejection), "ret" (sand),
are already resolved to English canonicals before DeepSeek sees them.
When building the WhatsApp flow, call lookupDialect() first, then pass both raw message
AND resolved tokens to the AI classification pipeline.

1. WhatsApp production flow:
   - Worker sends "production" or taps Production menu item
   - Bot shows list of in_production orders assigned to them
   - Worker selects order → enters: quantity_produced, quantity_rejected, rejection_reason
   - Bot confirms: "Logged: 480 good + 20 rejected (sand holes) for Order #042"

2. API: src/app/api/production/route.ts
   POST /api/production — create production batch
   - Validate: order_id (must be in_production status), quantity_produced, quantity_rejected, rejection_reason
   - Worker role can create (RLS allows this)
   - Auto-calculate: yield_percentage = (produced - rejected) / produced * 100
   - Audit logged

   GET /api/production — list batches with filters (order, worker, date range)
   GET /api/production/[id] — single batch details

3. Create src/lib/validations/production.ts with Zod schemas

4. Update WhatsApp interactive builders:
   - buildOrderListForProduction(orgId, workerId) — shows only in_production orders
   - buildProductionConfirmation(batchData) — shows what was logged
```

**VERIFY:**
```bash
npm run type-check
```

**COMMIT:**
```bash
git add . && git commit -m "feat: production batch logging via WhatsApp + API"
git push
```

---

### S5.2 — Auto-Updates on Production Log (1–2 hours)

**PROMPT:**
```
When a production batch is logged, automatically update related data:

1. Order progress:
   - Sum all batches for this order
   - If total_produced >= order_quantity → auto-change order status to "completed"
   - Update order.produced_quantity and order.rejected_quantity

2. Inventory update:
   - Subtract raw materials consumed (based on BOM/product config if available)
   - Add finished goods produced to inventory
   - If inventory drops below minimum_stock → trigger low stock alert

3. Quality metrics:
   - Update running rejection rate for this product
   - Update running rejection rate for this order

Implement these as database triggers OR as post-insert logic in the API route.
Use transactions to ensure all updates succeed or all fail together.
```

**VERIFY:**
```bash
npm run dev
# Create a production batch via API
# Check: order quantity updated, inventory changed, no orphaned data
```

**COMMIT:**
```bash
git add . && git commit -m "feat: auto-update order progress + inventory on production log"
git push
```

---

### S5.3 — Production Web Page (2 hours)

**ARCHITECTURE NOTE:** Read docs/architecture/SYSTEM_OVERVIEW.md "Production Planning Philosophy" before coding.
- `delivery_date` on orders = owner's promised date (set at WhatsApp "ok 15 june" confirmation)
- The page is a **drag-to-reorder priority queue** — advisory only
- **NEVER** add auto-schedule, auto-date-suggest, or deadline-push features

**PROMPT:**
```
Read docs/architecture/SYSTEM_OVERVIEW.md — "Production Planning Philosophy" section.
Read docs/BUILD_GUIDE.md Sprint 5 for the correct production page spec.

Replace the production placeholder with a real page.

src/app/(dashboard)/production/page.tsx:

1. Priority queue (main view):
   - Shows in_production and confirmed orders sorted by delivery_date (soonest first)
   - Drag handle on each row to manually reorder priority
   - Each card shows: order #, customer, product, qty remaining, progress bar, promised date
   - ADVISORY PACE WARNING only (no auto-scheduling):
     "Promised 15 June — at current pace: 18 June ⚠️"
     Calculate from: (qty_remaining / recent_daily_output) + today
     Mark ⚠️ if projected finish > delivery_date, never change the date
   - NO "Suggest date" button, NO "Auto-schedule" button

2. Production log table (secondary tab):
   - Columns: Date, Order #, Product, Produced, Rejected, Yield %, Worker
   - Filter by: date range, order, product, worker
   - Sort by date (newest first)

3. "Log Production" button → dialog:
   - Select order (shows in_production orders only)
   - Enter: quantity produced, quantity rejected
   - Select rejection reason (sand holes, dimensional, porosity, etc.)
   - Submit → creates batch via POST /api/production

4. Production summary cards:
   - Today's production: X pieces
   - Today's rejection rate: X%
   - This week's total: X pieces
   - Orders at risk (projected late): count

Mobile-friendly. All text via next-intl.
```

**VERIFY:**
```bash
npm run dev
# Browser → /production → see production logs from seed data
# Log a new batch → appears in table, order progress updates
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Production web page — log, table, progress tracking"
git push
```

---

### S5.4 — Quality Web Page (2 hours)

**PROMPT:**
```
Replace the quality placeholder with the quality analytics page.

src/app/(dashboard)/quality/page.tsx:

1. Key metrics cards:
   - Overall rejection rate (this month vs last month, with trend arrow)
   - ₹ Saved counter (monetary value of quality improvements)
   - Total pieces produced this month
   - Best performing product (lowest rejection rate)

2. Rejection trends chart (use recharts or a chart library):
   - Line chart: daily rejection rate over last 30 days
   - Compare against target rejection rate (show as dotted line)

3. Defect Pareto chart:
   - Bar chart: rejection reasons ranked by frequency
   - Shows: sand holes (40%), dimensional (25%), porosity (20%), other (15%)
   - Helps identify biggest quality issue to fix

4. Rejection rate by product:
   - Table: Product, Total Produced, Total Rejected, Rate %, Trend
   - Highlight products above 5% rejection in red

5. ₹ Saved calculation explanation:
   - Show: "If your rejection rate was 12% last quarter and is now 8%..."
   - Formula: (old_rate - new_rate) × total_produced × avg_unit_cost
   - This is the key value metric for factory owners

Install recharts if not already installed.
```

**VERIFY:**
```bash
npm run dev
# Browser → /quality → charts should render with seed data
# ₹ Saved counter should show a calculated value
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Quality page — rejection trends, Pareto chart, ₹ Saved counter"
git push
```

---

### S5.5 — Inventory System (2 hours)

**PROMPT:**
```
Build the inventory management system.

API: src/app/api/inventory/route.ts

GET /api/inventory — list all inventory items for org
PATCH /api/inventory/[id] — manual stock adjustment (with reason)
POST /api/inventory/adjust — bulk adjustment

Inventory logic:
1. Each product has: current_stock, minimum_stock, unit
2. Stock changes happen automatically:
   - Production batch logged → finished goods increase, raw materials decrease
   - Order delivered → finished goods decrease
   - Manual adjustment (damaged, received from vendor, physical count correction)

3. Every stock change logged to inventory_transactions table:
   - product_id, change_quantity (+/-), reason, reference_type (production/order/manual), reference_id
   - Running balance maintained

4. Low stock alerts:
   - When current_stock < minimum_stock → create alert
   - Alert goes to: web dashboard notification + WhatsApp message to owner
   - Don't spam: max 1 alert per product per day

Create migration for inventory_transactions table if not in original schema.
```

**VERIFY:**
```bash
supabase db reset    # If new migration added
npm run type-check
```

**COMMIT:**
```bash
git add . && git commit -m "feat: inventory system — stock tracking, auto-updates, low stock alerts"
git push
```

---

### S5.6 — Inventory Web Page (1–2 hours)

**PROMPT:**
```
Replace inventory placeholder with real page.

src/app/(dashboard)/inventory/page.tsx:

1. Inventory table:
   - Columns: Product, Current Stock, Minimum Stock, Unit, Status, Last Updated
   - Status: "OK" (green), "Low" (yellow if < 1.5× minimum), "Critical" (red if < minimum)
   - Search by product name
   - Sort by status (critical first)

2. "Adjust Stock" button → dialog:
   - Select product
   - Enter quantity change (+/-)
   - Select reason: received_from_vendor, manual_count, damaged, returned, other
   - Notes field
   - Submit → updates stock

3. Stock movement history (expandable per product):
   - Shows: date, change, reason, who did it, running balance
   - Last 30 days

4. Summary cards:
   - Total products: X
   - Low stock items: X (click to filter)
   - Critical stock items: X (click to filter)
```

**VERIFY:**
```bash
npm run dev
# Browser → /inventory → see stock levels
# Adjust stock → value updates, transaction logged
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Inventory web page — stock levels, adjustments, movement history"
git push
```

---

### S5.7 — Vendor Management + PO Creation (2 hours)

**PROMPT:**
```
Build vendor management with purchase order creation.

API: src/app/api/vendors/route.ts and src/app/api/vendors/[id]/route.ts

GET /api/vendors — list with search
POST /api/vendors — create vendor (name, city, phone, GSTIN, products_supplied, payment_terms)
PATCH /api/vendors/[id] — update
All audit logged, soft delete only.

Create src/lib/validations/vendor.ts.

Purchase Orders:
POST /api/vendors/[id]/purchase-orders — create PO
- Auto-generate PO number from sequence
- Line items: product, quantity, agreed_unit_price
- Terms: delivery date, payment terms
- Status: draft → sent → partially_received → received → paid

Create PO PDF (similar to invoice PDF but for purchases):
- src/lib/utils/po-pdf-generator.ts
- "To: [Vendor Name]" format
```

**VERIFY:**
```bash
npm run type-check
npm run dev
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Vendor management + purchase order API and PDF"
git push
```

---

### S5.8 — Vendor Web Page (1–2 hours)

**PROMPT:**
```
Replace vendor placeholder with real page.

src/app/(dashboard)/vendors/page.tsx:

1. Vendor list table:
   - Columns: Name, City, Products Supplied, Outstanding POs, Last Order
   - Search, pagination, sort
   - "Add Vendor" button → dialog form

2. Vendor detail view:
   - Contact info, GSTIN, payment terms
   - Purchase order history table
   - "Create PO" button → multi-step form (select products, quantities, prices)
   - Outstanding amount

3. Click PO → detail view:
   - PO info, line items, status
   - "Mark Received" button (updates inventory automatically)
   - Download PO PDF
```

**VERIFY:**
```bash
npm run dev
# Browser → /vendors → see seed data vendors
# Add vendor, create PO → should work end to end
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Vendor web page — list, detail, PO creation"
git push
```

---

### S5.9 — Production Summary Workflows (1 hour)

**PROMPT:**
```
Create two n8n workflows:

1. n8n/workflows/morning-production-plan.json:
   - Trigger: daily at 7:30 AM IST
   - For each org: fetch today's production orders
   - Send WhatsApp: "🏭 Today's Production Plan: [list of orders with quantities]"

2. n8n/workflows/evening-production-summary.json:
   - Trigger: daily at 6:30 PM IST
   - For each org: fetch today's production batches
   - Calculate: total produced, total rejected, yield %
   - Send WhatsApp: "📊 Today's Production: [produced] pieces, [reject%] rejection rate"
   - If rejection rate > 10%, add: "⚠️ High rejection rate — check quality"
```

**VERIFY:**
```bash
# Import into n8n → test run both workflows
```

**COMMIT:**
```bash
git add . && git commit -m "feat: morning + evening production summary WhatsApp workflows"
git push
# Sprint 5 complete!
```

---
---

# SPRINT 6 — FINANCIAL + ANALYTICS (Weeks 11–12)
**Goal: Money dashboard, KPIs, the ₹ Saved counter that sells the product**
**Sessions: 4**

---

### S6.1 — Cash Flow Page (3 hours)

**PROMPT:**
```
Replace cash flow placeholder with the financial analytics page.

src/app/(dashboard)/cash-flow/page.tsx:

1. Receivables aging table:
   - Columns: Customer, Invoice #, Amount, Due Date, Days Overdue, Status
   - Group by aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days
   - Total per bucket
   - Click customer → see all their outstanding invoices

2. Payables summary:
   - Outstanding purchase orders by vendor
   - Upcoming payment dates

3. 30-day cash flow forecast:
   - Expected inflows: upcoming invoice due dates
   - Expected outflows: PO payment dates, known expenses
   - Net cash position projection
   - Simple bar chart showing daily projected balance

4. Summary cards:
   - Total receivables: ₹X
   - Total payables: ₹X
   - Net position: ₹X
   - Largest outstanding: [Customer] — ₹X

5. "Send Reminder" button next to overdue invoices:
   - Triggers payment reminder WhatsApp message
   - Uses same template as automated reminders

All amounts in Indian format (₹1,50,000).
Use recharts for the forecast chart.
```

**VERIFY:**
```bash
npm run dev
# Browser → /cash-flow → see aging table with seed data
# Forecast chart should render
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Cash Flow page — receivables aging, payables, 30-day forecast"
git push
```

---

### S6.2 — ₹ Saved Calculation Engine (2 hours)

**PROMPT:**
```
Build the ₹ Saved calculation engine — this is the hero metric that proves ROI to factory owners.

Create src/lib/utils/rupees-saved.ts:

Calculate ₹ Saved across these dimensions:

1. QUALITY SAVINGS:
   - Compare current rejection rate vs baseline (first month's rate, or industry avg 12%)
   - Formula: (baseline_rate - current_rate) × total_produced × avg_unit_cost
   - Example: 12% → 8% on 10,000 pieces at ₹500 each = ₹2,00,000 saved

2. PAYMENT COLLECTION SPEED:
   - Compare current avg collection days vs baseline
   - Formula: (baseline_days - current_days) × daily_revenue × cost_of_capital_rate
   - Example: 45 → 30 days on ₹5L monthly revenue at 12% annual = ₹7,500/month saved

3. DUPLICATE ORDER PREVENTION:
   - Count idempotency catches (orders that would have been duplicates)
   - Formula: duplicate_count × avg_order_value
   - Example: 3 duplicates prevented × ₹50,000 each = ₹1,50,000 saved

4. TIME SAVINGS:
   - Estimate hours saved on manual processes
   - Formula: hours_saved × hourly_value (₹200/hour default)

Create API endpoint: GET /api/analytics/rupees-saved
- Returns breakdown by category and total
- Supports date range filter (this month, last 3 months, all time)
- Caches result for 1 hour
```

**VERIFY:**
```bash
npm run type-check
npm run dev
# GET /api/analytics/rupees-saved → should return calculated values from seed data
```

**COMMIT:**
```bash
git add . && git commit -m "feat: ₹ Saved calculation engine — quality, payments, duplicates, time"
git push
```

---

### S6.3 — Dashboard Page (3 hours)

**PROMPT:**
```
Replace the dashboard placeholder with the main command center page.

src/app/(dashboard)/page.tsx:

This is the FIRST thing the factory owner sees. Make it count.

1. ₹ Saved hero counter (top of page, large, animated):
   - Big number: "₹4,32,500 Saved This Month"
   - Expandable breakdown: Quality ₹2L, Payments ₹1.5L, Duplicates ₹82K
   - Trend vs last month (arrow up/down + percentage)

2. Key metric cards (4 in a row):
   - Orders this month: count + value
   - Production yield: percentage + trend
   - Outstanding receivables: amount
   - Low stock alerts: count (red if > 0)

3. Action items section:
   - Overdue invoices needing follow-up (top 5)
   - Orders stuck in production (no batch logged in 3+ days)
   - Low stock products needing reorder
   - Each item has action button (Send Reminder, Check Status, Create PO)

4. Recent activity feed:
   - Last 20 actions across the org (from audit_log)
   - "Jayesh created Order #042 for Raju Patel"
   - "Kiran logged 480 pieces for Order #039"
   - Timestamp in IST

5. Quick actions bar:
   - "New Order" button
   - "Log Production" button
   - "Create Invoice" button

Server Component. Fetch all data server-side for fast initial load.
Use React Suspense for progressive loading.
Mobile: stack cards vertically, reduce to 2 columns.
```

**VERIFY:**
```bash
npm run dev
# Browser → /dashboard → should see ₹ Saved counter, metrics, action items
# All data should populate from seed data
# Mobile view should stack properly
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Dashboard — ₹ Saved hero counter, KPIs, action items, activity feed"
git push
```

---

### S6.4 — Finalize Scheduled Workflows (1–2 hours)

**PROMPT:**
```
Review and finalize ALL n8n scheduled WhatsApp workflows:

1. Daily order summary (8 AM) — already built, verify still works
2. Payment reminders (10 AM) — already built, verify still works
3. Morning production plan (7:30 AM) — already built, verify still works
4. Evening production summary (6:30 PM) — already built, verify still works

5. NEW: Weekly business summary (Sunday 9 AM):
   Create n8n/workflows/weekly-summary.json:
   - This week's orders: count + value
   - This week's production: pieces + yield %
   - This week's collections: amount collected
   - ₹ Saved this week
   - Top customer by order value

6. NEW: Low stock alert (runs every 6 hours):
   Create n8n/workflows/low-stock-alert.json:
   - Check inventory levels
   - If any product below minimum_stock AND no alert sent in last 24 hours
   - Send WhatsApp: "⚠️ Low Stock Alert: [Product] has [X] pieces left (minimum: [Y])"

Test all workflows by running them manually in n8n.
```

**VERIFY:**
```bash
# All 6 workflows in n8n → test run each → verify output messages
```

**COMMIT:**
```bash
git add . && git commit -m "feat: finalize all scheduled WhatsApp workflows — weekly summary + low stock"
git push
# Sprint 6 complete!
```

---
---

# SPRINT 7 — COMPLIANCE + SOPs + BILLING (Weeks 13–14)
**Goal: Regulatory calendar, process documentation, and getting paid**
**Sessions: 5**

---

### S7.1 — Compliance Calendar (2 hours)

**PROMPT:**
```
Replace compliance placeholder with a regulatory compliance tracker.

src/app/(dashboard)/compliance/page.tsx:

1. Compliance calendar view:
   - Monthly calendar showing due dates for:
     - GST return filing (GSTR-1: 11th, GSTR-3B: 20th)
     - TDS filing (7th of each month)
     - PF/ESI deposits (15th)
     - Factory license renewal (annual)
     - Pollution control certificate (annual)
     - Fire safety certificate (annual)
     - Custom deadlines added by user

2. Upcoming deadlines list (next 30 days):
   - Date, compliance type, status (pending/completed/overdue)
   - "Mark Complete" button
   - Documents section (upload proof of filing)

3. "Add Reminder" button → dialog:
   - Name, due date, recurrence (monthly/quarterly/annual), notes

4. n8n workflow for compliance reminders:
   Create n8n/workflows/compliance-reminder.json:
   - Runs daily at 9 AM
   - Check deadlines coming up in next 3 days
   - Send WhatsApp: "📋 Compliance Due: [Type] is due on [Date]. Don't forget!"
   - Send again on due date if not marked complete

API: src/app/api/compliance/route.ts — CRUD for compliance entries
```

**VERIFY:**
```bash
npm run dev
# Browser → /compliance → see calendar with GST dates
# Add custom deadline → appears on calendar
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Compliance calendar — regulatory tracking + WhatsApp reminders"
git push
```

---

### S7.2 — SOP Builder (2–3 hours)

**PROMPT:**
```
Replace SOP Builder placeholder with a process documentation tool.

src/app/(dashboard)/sop-builder/page.tsx:

1. SOP list:
   - Table: SOP Name, Category, Version, Last Updated, Status (draft/published)
   - Categories: Quality Control, Production Process, Safety, Maintenance

2. "Create SOP" button → rich text editor page:
   - Use a lightweight rich text editor (consider Tiptap or basic contentEditable with formatting)
   - Toolbar: Bold, Italic, Headings, Bullet list, Numbered list, Image upload
   - Template starters: "Quality Inspection Checklist", "Machine Startup Procedure"

3. SOP versioning:
   - Save creates a new version
   - View version history (diff view optional)
   - "Publish" locks the version and makes it visible to all workers

4. SOP viewing:
   - Clean read-only view for published SOPs
   - Print-friendly layout
   - WhatsApp sharing: "Share via WhatsApp" sends a link to the SOP

API: src/app/api/sop/route.ts — CRUD with versioning
Database migration for sop table if not in original schema.
```

**VERIFY:**
```bash
npm run dev
# Browser → /sop-builder → create an SOP → rich text editor works
# Save, publish, view → all work
```

**COMMIT:**
```bash
git add . && git commit -m "feat: SOP Builder — rich text editor, versioning, publishing"
git push
```

---

### S7.3 — Razorpay Billing Integration (3 hours)

**PROMPT:**
```
Read docs/billing/RAZORPAY_INTEGRATION.md completely.

Build the Razorpay subscription billing system:

1. src/lib/billing/razorpay.ts:
   - Initialize Razorpay SDK with RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
   - createSubscription(orgId, planId): creates Razorpay subscription
   - cancelSubscription(subscriptionId): cancels
   - getSubscriptionStatus(subscriptionId): current status
   - verifyWebhookSignature(payload, signature): validates webhook

2. Razorpay Plans (create via Razorpay dashboard or API):
   - tier_1 (Starter): ₹999/month
   - tier_2 (Professional): ₹2,499/month
   - tier_3 (Enterprise): ₹4,999/month
   - All with UPI Autopay support

3. Webhook handler: src/app/api/webhooks/razorpay/route.ts
   - Verify signature
   - Handle events:
     - subscription.activated → update org tier
     - subscription.charged → record payment
     - subscription.cancelled → downgrade org to free/expired
     - payment.failed → notify owner via WhatsApp
   - Update organizations.tier and organizations.subscription_status

4. Checkout flow:
   - API: POST /api/billing/checkout → creates Razorpay checkout session
   - Returns checkout URL/session for frontend to open Razorpay modal

5. Subscription management:
   - API: GET /api/billing/subscription → current plan details
   - API: POST /api/billing/cancel → cancel subscription
   - API: POST /api/billing/change-plan → upgrade/downgrade
```

**VERIFY:**
```bash
npm run type-check
# Test with Razorpay test mode keys
# Create a test subscription → webhook should fire → org tier should update
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Razorpay integration — subscriptions, webhooks, tier management"
git push
```

---

### S7.4 — Feature Toggle System (1–2 hours)

**PROMPT:**
```
Read docs/security/FEATURE_GATING.md.

Complete the feature toggle system end-to-end:

1. Middleware (update src/middleware.ts):
   - On every request: check org tier from session
   - If accessing a route beyond their tier → redirect to upsell page
   - tier_1 can access: dashboard, orders, invoices, customers, vendors, settings
   - tier_2 adds: production, quality, inventory, cash-flow
   - tier_3 adds: compliance, sop-builder

2. API gating (create src/lib/utils/feature-gate.ts):
   - requireTier(requiredTier, orgTier): throws 403 if insufficient
   - Use at the top of every API route
   - Example: POST /api/production requires tier_2

3. WhatsApp gating:
   - Update buildMainMenu() to only show features for their tier
   - If user tries to access gated feature via text: "This feature requires the Professional plan. Upgrade at [link]"

4. Dashboard gating:
   - Nav items already hidden (Sprint 1)
   - Verify upsell pages still work correctly
   - Add "Current Plan" badge in sidebar footer

5. After Razorpay payment:
   - Tier change should IMMEDIATELY unlock new features
   - No logout/login required (update session/JWT)
```

**VERIFY:**
```bash
npm run dev
# Create a tier_1 org → try to access /production → should see upsell page
# Upgrade to tier_2 → /production should now be accessible
```

**COMMIT:**
```bash
git add . && git commit -m "feat: complete feature toggle system — middleware, API, WhatsApp, dashboard"
git push
```

---

### S7.5 — Settings Page (2 hours)

**PROMPT:**
```
Replace settings placeholder with the full settings page.

src/app/(dashboard)/settings/page.tsx:

Use tabs (shadcn/ui Tabs) for different settings sections:

TAB 1 — Organization Profile:
- Edit: Company name, address, city, state, GSTIN, phone, email
- Upload company logo (Supabase Storage)
- Industry selection

TAB 2 — Team Management:
- List of users in org (name, email, role, last active)
- "Invite User" button → email invitation
- Change user role (owner can change manager/worker roles)
- Remove user from org (soft delete)
- Workers: can only access production logging
- Managers: can access orders, invoices, customers, production, inventory
- Owners: full access including settings and billing

TAB 3 — Billing:
- Current plan badge (Starter/Professional/Enterprise)
- Subscription status (active, cancelled, past_due)
- Next billing date
- "Change Plan" button → shows plan comparison + Razorpay checkout
- "Cancel Plan" button → confirmation dialog
- Payment history table

TAB 4 — Preferences:
- Default language (gu/hi/en)
- WhatsApp notification preferences (toggle each type)
- Timezone (defaults to Asia/Kolkata)
- Currency display format

TAB 5 — Data:
- "Export All Data" button → downloads ZIP of all CSVs
- "Delete Account" → requires typing org name to confirm → soft delete everything
```

**VERIFY:**
```bash
npm run dev
# Browser → /settings → all tabs load
# Edit org profile → saves
# View billing → shows plan info
# Invite user → sends invite (test mode)
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Settings page — org profile, team, billing, preferences, data"
git push
# Sprint 7 complete!
```

---
---

# SPRINT 8 — POLISH + LAUNCH (Weeks 15–16)
**Goal: Smooth rough edges, deploy, get first real users**
**Sessions: 7**

---

### S8.1 — Onboarding Wizard (2 hours)

**PROMPT:**
```
Build a new-user onboarding wizard that runs after first signup.

src/app/(dashboard)/onboarding/page.tsx:

Multi-step wizard (7 steps):

STEP 1 — Welcome:
- "Welcome to VyaOps, [Name]! Let's set up your factory in 5 minutes."
- Language selection (gu/hi/en) — saves preference

STEP 2 — Company Details:
- Company name (pre-filled from signup), address, GSTIN
- Industry confirmation (foundry, ceramics, brass — affects product templates)
- Upload logo (optional, skip button)

STEP 3 — Add Your First 5 Customers:
- Quick-add form: Name, Phone, City
- "Import from Excel" option (upload CSV/Excel with customer list)
- Skip button: "I'll add later"

STEP 4 — Add Your Products:
- Show industry-specific templates (e.g., foundry: Valve Body, Pump Housing, etc.)
- One-click to add template products
- Edit prices before saving
- "Add Custom Product" option

STEP 5 — Generate Dialect Dictionary:
After products + customers are saved, auto-generate dialect dictionary entries:
- Call generateOnboardingDictionary() from src/lib/ai/dialect-learner.ts (Prompt #10)
- Pass: industrySegment, languagePreference, products list, customers list
- AI generates likely Gujlish/Hindi aliases for each product and customer name
- Show results to owner for review: "We think 'vb' means 'Valve Body' — correct?"
- Owner confirms/rejects each alias via confirmOnboardingEntry()
- Confirmed aliases saved to org_dictionary (Tier 4) with confidence=1.0
- Skippable: "I'll review later" button

STEP 6 — Connect WhatsApp:
- Instructions to connect their WhatsApp number via Dualhook Embedded Signup
- One-click Embedded Signup flow (connects their existing WhatsApp Business App number to Cloud API via Coexistence)
- "I'll do this later" option

STEP 7 — Done!
- "Your factory is ready! 🏭"
- Quick tour: "Here's what you can do..."
- "Go to Dashboard" button

After completion: set organization.onboarding_status = "complete"
Don't show wizard again for completed orgs.
```

**VERIFY:**
```bash
npm run dev
# Create new account → should redirect to onboarding wizard
# Walk through all 7 steps → should save data at each step
# Step 5: dialect dictionary aliases generated and shown for review
# Finish → redirect to dashboard → wizard doesn't show again
```

**COMMIT:**
```bash
git add . && git commit -m "feat: onboarding wizard — 7-step setup with dialect dictionary generation"
git push
```

---

### S8.2 — Admin Dashboard (2 hours)

**PROMPT:**
```
Build the internal admin dashboard at src/app/(admin)/.

This is for YOUR team to monitor all customers, not visible to factory owners.

src/app/(admin)/page.tsx:

1. Admin-only access:
   - Create an "admin" role check in middleware
   - Your personal email(s) get admin access
   - All other users → 403

2. Customer overview:
   - Table: Org Name, Owner, Tier, Created Date, Last Active, Orders Count, ₹ Saved
   - Sort by any column
   - Search by org name

3. System health:
   - WhatsApp messages processed today: count
   - AI calls today: count + avg latency + error rate
   - DeepSeek API usage: tokens + estimated cost
   - OpenRouter API usage: tokens + estimated cost
   - Active subscriptions by tier

4. Revenue:
   - MRR (Monthly Recurring Revenue): total across all paid subscriptions
   - Breakdown by tier
   - Churn: orgs that cancelled this month

5. Quick actions:
   - View any org's data (switch org context)
   - Manually change org tier (for beta users, comps)
   - View error logs from Sentry
```

**VERIFY:**
```bash
npm run dev
# Login with admin email → /admin should load
# Login with regular email → /admin should show 403
```

**COMMIT:**
```bash
git add . && git commit -m "feat: Admin dashboard — org overview, system health, revenue"
git push
```

---

### S8.3 — End-to-End Testing (2–3 hours)

**PROMPT:**
```
Run through EVERY user flow in the app and fix all issues.

Test checklist — go through each one:

AUTH:
- [ ] Signup → creates org + user → redirects to onboarding
- [ ] Onboarding wizard → all 6 steps → completes
- [ ] Login → redirects to dashboard
- [ ] Logout → redirects to login
- [ ] Wrong password → shows error
- [ ] Session expired → redirects to login

DASHBOARD:
- [ ] ₹ Saved counter shows calculated value
- [ ] KPI cards show correct data
- [ ] Action items list is populated
- [ ] Activity feed shows recent actions
- [ ] Quick action buttons work

ORDERS:
- [ ] View orders list with filters
- [ ] Create order via web → appears in list
- [ ] Create order via WhatsApp → appears in web list
- [ ] View order detail + timeline
- [ ] Change order status → updates correctly
- [ ] Generate invoice from completed order

INVOICES:
- [ ] View invoices with filters
- [ ] Download PDF → renders correctly
- [ ] Record payment → status changes
- [ ] Send WhatsApp reminder → message sent

PRODUCTION:
- [ ] Log production batch via WhatsApp
- [ ] Log production batch via web
- [ ] Auto-updates: order progress, inventory
- [ ] Quality page: charts render with data

INVENTORY:
- [ ] View stock levels
- [ ] Manual adjustment → logged correctly
- [ ] Low stock alert triggers

CUSTOMERS + VENDORS:
- [ ] Add, edit, search, delete (soft) + undo
- [ ] Vendor PO creation + PDF

CASH FLOW:
- [ ] Aging table shows correct buckets
- [ ] Forecast chart renders

COMPLIANCE + SOPs:
- [ ] Calendar shows deadlines
- [ ] Create and publish SOP

SETTINGS:
- [ ] Edit org profile
- [ ] Team management works
- [ ] Billing shows plan info

FEATURE GATING:
- [ ] tier_1 org can't access production
- [ ] tier_2 org can access production
- [ ] Upsell pages render correctly

DIALECT DICTIONARY:
- [ ] Layer 0 lookup resolves known Gujlish terms before AI call
- [ ] org_dictionary entries created during onboarding (Prompt #10)
- [ ] Owner correction triggers dialect learning (analyzeCorrection → learnFromCorrection)
- [ ] Promotion works: 3+ orgs with same mapping → industry/global dictionary
- [ ] Cache invalidation works after new terms learned
- [ ] Static JSON files (universal.json, business.json) load correctly

i18n:
- [ ] All pages work in Gujarati
- [ ] All pages work in Hindi
- [ ] Language persists across navigation

MOBILE:
- [ ] All pages render on 375px width
- [ ] Sidebar collapses
- [ ] Tap targets >= 44px

Fix EVERY bug found. Don't move on until all pass.
```

**VERIFY:**
```bash
npm run type-check   # Zero errors
npm run lint         # Zero errors
npm run build        # Production build succeeds
npm run test:benchmark  # AI benchmark > 80% pass rate
```

**COMMIT:**
```bash
git add . && git commit -m "fix: end-to-end test fixes — all flows verified"
git push
```

---

### S8.4 — Performance Optimization (1–2 hours)

**PROMPT:**
```
Optimize the app for slow Indian internet connections (2G/3G).

1. Server Components:
   - Audit all pages — make sure only interactive parts are client components
   - Move data fetching to server components where possible

2. Bundle analysis:
   - Run: npx @next/bundle-analyzer
   - Identify any unexpectedly large client-side bundles
   - Lazy-load heavy components (charts, PDF viewer, rich text editor)

3. Image optimization:
   - Use next/image everywhere
   - Set appropriate sizes and quality

4. Database query optimization:
   - Add any missing indexes for common queries
   - Ensure pagination is used everywhere (no loading 1000+ rows)
   - Add proper select() to only fetch needed columns (not select('*'))

5. Caching:
   - React cache() for repeated server-side data fetches
   - Revalidation: dashboard data every 60 seconds, static pages longer

6. Loading states:
   - Add loading.tsx files for all major routes
   - Use React Suspense with skeleton loaders
   - No blank screens while loading

Target: First Contentful Paint < 2 seconds on 3G.
```

**VERIFY:**
```bash
npm run build
# Check output: total bundle sizes should be reasonable
# Chrome DevTools → Network → throttle to "Slow 3G" → pages should still load
```

**COMMIT:**
```bash
git add . && git commit -m "perf: optimize for slow connections — SSR, lazy loading, caching"
git push
```

---

### S8.5 — Security Audit (2 hours)

**PROMPT:**
```
Run a comprehensive security audit and fix all issues.

1. RLS verification:
   - Write test queries that try to access another org's data → must return empty
   - Test: user with role "worker" trying to update orders → must fail
   - Test: client-side request without auth → must return 401
   - Test: org_dictionary RLS — org A can't see org B's dictionary entries
   - Test: industry_dictionary + global_dictionary — authenticated can SELECT, cannot INSERT/UPDATE
   - Test: anon key cannot write to any dictionary table

2. Webhook security:
   - WhatsApp webhook: signature verification is enforced (reject invalid signatures)
   - Razorpay webhook: signature verification is enforced
   - Both webhooks: replay protection (check timestamp, reject > 5 min old)

3. Input validation:
   - Every API route validates input with Zod before processing
   - SQL injection: all queries use parameterized inputs (Supabase client does this)
   - XSS: all user-generated content is escaped before rendering

4. Service role key:
   - Grep entire codebase: service_role key should ONLY appear in admin.ts
   - Should NEVER be in any client component or exposed to browser

5. Sensitive data:
   - Grep for console.log → remove any that log phone numbers, GSTINs, amounts
   - Verify Sentry context masking is working

6. Auth:
   - Session expiry is configured (e.g., 24 hours)
   - CSRF protection on all form submissions
   - Rate limiting on auth endpoints (login, signup)

Create a file: docs/security/AUDIT_RESULTS.md with findings and fixes.
```

**VERIFY:**
```bash
npm run type-check
npm run lint
npm run build
# All pass, no security issues remaining
```

**COMMIT:**
```bash
git add . && git commit -m "security: comprehensive audit — RLS, webhooks, input validation, secrets"
git push
```

---

### S8.6 — Production Deployment (2–3 hours)

**PROMPT:**
```
Deploy the complete application to production.

1. Vercel (Next.js app):
   - Ensure all environment variables are set in Vercel dashboard (production values, not test)
   - Set NEXT_PUBLIC_APP_URL to your production domain
   - Enable: automatic deployments from main branch
   - Custom domain: app.vyaops.com (or your domain)

2. Supabase (database):
   - Push all migrations to production Supabase project:
     npx supabase db push --linked
   - Verify all tables, RLS policies, triggers exist
   - Run seed.sql ONLY if needed for demo data
   - Set up database backups (Supabase Pro plan includes daily backups)

3. n8n on Hetzner:
   - Verify all 6+ workflows are imported and activated
   - Update webhook URLs to point to production (app.vyaops.com, not ngrok)
   - Set up SSL (Caddy or certbot)
   - Set up monitoring (simple uptime check)

4. Cloudflare:
   - DNS pointing to Vercel and Hetzner
   - SSL configured
   - Basic DDoS protection enabled

5. Dualhook + Meta Cloud API:
   - Update Webhook Override URL to production endpoint (app.vyaops.com/api/webhooks/whatsapp)
   - Verify all templates are approved in Meta Business Suite
   - Upgrade Dualhook to Platform tier if needed for customer count
   - Verify Coexistence heartbeat is active (Meta requires 1 API message every 13 days per number)

6. Monitoring:
   - Sentry: verify errors flow in from production
   - PostHog: verify analytics events
   - Set up uptime monitoring (UptimeRobot free tier)

Create a deployment checklist: docs/infrastructure/DEPLOYMENT_CHECKLIST.md
```

**VERIFY:**
```bash
# Open https://app.vyaops.com (or your domain) → should load the app
# Sign up → onboarding → dashboard → all features work
# Send WhatsApp message to production number → should get response
# Check Sentry → no critical errors
# Check n8n → workflows running on schedule
```

**COMMIT:**
```bash
git add . && git commit -m "deploy: production deployment — Vercel, Supabase, n8n, Cloudflare"
git push
```

---

### S8.7 — First 5 Customers (MANUAL — not Claude Code)

**What this does:** Onboard your first real paying customers. This is relationship work, not code.

**Steps:**
1. Identify 5 factory owners in Rajkot (from your engineering association network)
2. Meet them in person or call them
3. Walk them through signup + onboarding wizard together
4. Help them add their first customers and products
5. Send their first test order via WhatsApp
6. Collect feedback: what's confusing? what's missing? what's broken?
7. Fix issues found → commit
8. Get them on a paid plan (even ₹999 tier_1 counts as revenue)

**Track:**
```
Customer 1: [Name] — [Status: onboarded/active/churned] — [Feedback]
Customer 2: [Name] — [Status] — [Feedback]
Customer 3: [Name] — [Status] — [Feedback]
Customer 4: [Name] — [Status] — [Feedback]
Customer 5: [Name] — [Status] — [Feedback]
```

---
---

# YOU'RE LIVE. 🏭

Your product is deployed, customers are using it, and WhatsApp messages are flowing through your AI pipeline. From here:

**Month 5–6:** Focus on customer success. Fix what they tell you is broken. Grow the AI benchmark to 500+ cases.

**Month 7–8:** Auto-mode graduation (eval gate auto-processes more as accuracy improves). Tally accounting integration.

**Month 9–10:** Expand to Morbi ceramics and Jamnagar brass factories.

**Month 11–12:** Advanced analytics, worker attendance tracking.

Refer to BUILD_GUIDE.md POST-LAUNCH section for the full roadmap.

---

## EMERGENCY CHEAT SHEET

**Something broke in production:**
```
Tell Claude Code: "Production is showing this error: [paste error]. 
The relevant code is in [file path]. Fix it immediately."
```

**Need to rollback:**
```bash
git log --oneline -10    # Find the last good commit
git revert [commit-hash] # Creates a new commit that undoes the bad one
git push                 # Deploys the fix
```

**Database needs fixing:**
```bash
# NEVER manually edit production database. Create a migration:
Tell Claude Code: "Create a migration to [describe the fix]."
npx supabase db push --linked   # Apply to production
```

**WhatsApp stopped working:**
1. Check Dualhook dashboard → is the Webhook Override URL pointing to your production endpoint?
2. Check Meta Business Suite → WhatsApp Manager → is the webhook subscription active?
3. Check n8n (n8n.vyaops.com) → is the master-message-handler workflow ACTIVE?
4. Verify Meta webhook verification: GET /api/webhooks/whatsapp must return hub.challenge
5. Check Sentry → any errors in webhook or flow-engine?
6. Check Supabase → do orgs have whatsapp_phone_number_id set? (required for org lookup)
7. Echoes not working? → Confirm Dualhook has smb_message_echoes subscribed
   Test: send a message FROM the connected number → check whatsapp_messages for is_echo=true row

**Customer message received but no draft posted:**
1. Check pending_orders table → is there a row in 'detected' state?
   If yes: owner echo not arriving or being filtered by loop guard
   If no: check whatsapp_messages → was the inbound message logged? If not, org lookup failed
2. Check is the customer's phone in the customers table with a normalized phone (no + prefix)?
3. Check eval score in pending_orders.extraction → score < 0.5 means AI classified it as low-confidence

**Draft posted but no order created:**
1. Check pending_orders state = 'draft_posted' → owner "ok" echo not arriving
2. Check whatsapp_messages for owner echo rows (direction=outbound, is_echo=true)
3. Check if loop guard is over-filtering → ensure bot draft wamids are logged before sending

**AI giving wrong answers:**
1. Add the wrong case to tests/ai/benchmark.json
2. Run `npm run test:benchmark` to see current accuracy
3. Adjust prompts in docs/ai/PROMPT_LIBRARY.md
4. Re-run benchmark until it passes
