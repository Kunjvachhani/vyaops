# IMPLEMENTATION GUIDE — VyaOps
### Step-by-Step: From Zero to Live Product
### Machine: MacBook Pro M2 | Tool: Claude Code
*You are a non-coder. This guide assumes exactly that.*

---

## HOW TO USE THIS GUIDE

Each step has three parts:
1. **WHAT** you're doing (and why it matters)
2. **EXACTLY WHAT TO TYPE** in your terminal or tell Claude Code
3. **HOW TO VERIFY** it worked (what you should see)

Follow the steps in order. Don't skip. Don't jump ahead.
If something fails, tell Claude Code: "The last command failed with this error: [paste error]. Fix it."

---

## PHASE 0: MACHINE SETUP (Day 0 — 2-3 hours)

### Step 0.1: Install Homebrew
**What:** Package manager for macOS. You'll use it to install everything else.
```bash
# Open Terminal (Command + Space → type "Terminal" → Enter)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
**Verify:** Type `brew --version` → should show version number.

### Step 0.2: Install Node.js
**What:** JavaScript runtime. Your entire app runs on this.
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Close and reopen Terminal, then:
nvm install 20
nvm use 20
nvm alias default 20
```
**Verify:** `node --version` → should show v20.x.x

### Step 0.3: Install Docker Desktop
**What:** Runs Supabase locally on your machine for development.
```
1. Go to: https://www.docker.com/products/docker-desktop/
2. Download "Docker Desktop for Mac — Apple Silicon"
3. Install and open Docker Desktop
4. Wait until the whale icon in menu bar shows "Docker Desktop is running"
```
**Verify:** `docker --version` → should show version number.

### Step 0.4: Install Supabase CLI
**What:** Command-line tool to manage your database.
```bash
brew install supabase/tap/supabase
```
**Verify:** `supabase --version` → should show version number.

### Step 0.5: Install Claude Code
**What:** Your AI developer. This builds the entire product.
```bash
npm install -g @anthropic-ai/claude-code
```
**Verify:** `claude --version` → should show version number.
**Note:** You need a Claude Pro or Max subscription. $20/mo Pro works, $100/mo Max 5x recommended during heavy building.

### Step 0.6: Install Git & VS Code
**What:** Version control + code editor (for reviewing what Claude Code writes).
```bash
brew install git
# VS Code: download from https://code.visualstudio.com/
```

### Step 0.7: Create All Accounts
**What:** External services your product depends on.
```
Do these NOW (some take days for verification):

1. GitHub (github.com) → create account if you don't have one
2. Supabase (supabase.com) → sign up, create a new project
   - Project name: vyaops
   - Region: South Asia (Mumbai) or Southeast Asia (Singapore)
   - Generate a strong database password → SAVE IT
   - Wait for project to initialize (~2 min)
   - Go to Settings → API → copy:
     • Project URL (NEXT_PUBLIC_SUPABASE_URL)
     • anon public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
     • service_role key (SUPABASE_SERVICE_ROLE_KEY) ← KEEP SECRET

3. Vercel (vercel.com) → sign up with GitHub account

4. Hetzner (hetzner.com/cloud) → sign up, add payment method
   - Create server: CX22, Ubuntu 24.04, Falkenstein location
   - Add SSH key from your Mac: cat ~/.ssh/id_rsa.pub (create one if needed)
   - Note the server IP address

5. AiSensy (aisensy.com) → sign up
   - Explore their docs on WhatsApp Coexistence
   - You'll set up Coexistence in Sprint 2

6. OpenRouter (openrouter.ai) → sign up, add credits ($10 to start)
   - Create API key → save as OPENROUTER_API_KEY

7. DeepSeek (platform.deepseek.com) → sign up
   - You get 5M free tokens
   - Create API key → save as DEEPSEEK_API_KEY

8. Razorpay (razorpay.com) → sign up for business account
   - KYC verification takes 2-3 business days
   - Start this NOW so it's ready by Sprint 7

9. Cloudflare (cloudflare.com) → sign up (free)
   - Add your domain → configure DNS

10. Sentry (sentry.io) → sign up, create Next.js project
    - Copy DSN → save as SENTRY_DSN

11. PostHog (posthog.com) → sign up
    - Copy project API key → save as NEXT_PUBLIC_POSTHOG_KEY
```

**Save all keys in a secure note (Apple Notes with password lock, or 1Password).
You'll need them in Step 1.2.**

---

## PHASE 1: PROJECT INITIALIZATION (Day 1 — 3-4 hours)

### Step 1.1: Create Project Folder
```bash
cd ~/Documents  # or wherever you want the project
mkdir vyaops
cd vyaops
git init
```

### Step 1.2: Set Up the Skeleton
**What:** Copy all the doc files from the zip I gave you into this folder.
```bash
# Unzip the skeleton I provided:
# Drag the vyaops-skeleton.zip to this folder and:
unzip vyaops-skeleton.zip -d temp
cp -r temp/vyaops/* .
rm -rf temp

# Create .env.local from the template:
cp .env.example .env.local
# Open .env.local in VS Code and fill in ALL the keys you saved in Step 0.7
code .env.local
```

### Step 1.3: Start Claude Code and Build the Project Foundation
```bash
# Make sure you're in the vyaops folder
cd ~/Documents/vyaops

# Start Claude Code
claude
```

**Your first instruction to Claude Code:**
```
Read the CLAUDE.md file in this project root. This is your operating manual.
Then initialize a Next.js 15 project with:
- TypeScript in strict mode
- Tailwind CSS 4
- App Router (not Pages Router)
- ESLint
Do NOT use create-next-app — set up manually so we control the structure exactly.
Install these packages: @supabase/supabase-js next-intl zod lucide-react
Set up shadcn/ui with the default theme.
Create the project structure exactly as shown in CLAUDE.md.
```

**Verify:** 
```bash
npm run dev
# Open http://localhost:3000 in browser — should see default Next.js page
```

### Step 1.4: Initialize Local Supabase
```bash
# In a new terminal tab (keep npm run dev running):
supabase init
supabase start
```
**Verify:** Supabase Studio opens at http://localhost:54323 — you should see a database dashboard.

### Step 1.5: First Git Commit
```bash
git add .
git commit -m "chore: initial project setup"

# Create GitHub repo and push:
# Go to github.com → New Repository → name: vyaops → Private → Create
git remote add origin https://github.com/YOUR_USERNAME/vyaops.git
git push -u origin main
```

### Step 1.6: Connect Vercel
```
1. Go to vercel.com
2. Click "Add New Project"
3. Import your vyaops repo from GitHub
4. Framework: Next.js (auto-detected)
5. Add environment variables (copy all from .env.local)
6. Deploy
```
**Verify:** Vercel gives you a URL (something.vercel.app) — it should load your app.

---

## PHASE 2: SPRINT 1 — DATABASE + AUTH + LAYOUT (Week 1-2)

### Step 2.1: Create Database Schema
**Open Claude Code and tell it:**
```
Read docs/database/SCHEMA.md completely — all 16 tables.
Create Supabase SQL migration files in supabase/migrations/ for every table.
Name them with timestamps: 20260603000001_create_organizations.sql, etc.
Include:
- The update_updated_at trigger function
- All indexes specified in the schema
- Sequence generators for order/invoice/PO numbers
- All foreign key constraints
Apply them in the correct order (organizations first, then users, then the rest).
```

**Then apply:**
```bash
supabase db reset
# This applies all migrations and should show no errors
```
**Verify:** Open http://localhost:54323 → Table Editor → you should see all 16 tables.

### Step 2.2: Create Seed Data
**Tell Claude Code:**
```
Create supabase/seed.sql with test data:
- 1 organization (Shree Ambica Engineering, Rajkot, tier_2)
- 3 users (owner, manager, worker) with different roles
- 10 customers with realistic Rajkot names and aliases
- 5 vendors (Ambuja Steel, Jamnagar Metals, etc.)
- 8 products (Valve Body, Pump Housing, Bearing Cap, etc. with HSN codes)
- 20 orders in various statuses (draft, confirmed, in_production, completed)
- 5 invoices (2 paid, 2 overdue, 1 sent)
- 10 production batches with various rejection rates
```

```bash
supabase db reset  # re-applies migrations + runs seed
```

### Step 2.3: Create RLS Policies
**Tell Claude Code:**
```
Read docs/security/RLS_POLICIES.md. Create a migration file that:
- Enables RLS on every table (except audit_log and whatsapp_messages)
- Creates tenant isolation policies (select, insert, update based on org_id from JWT)
- Creates role-based restrictions (workers can only insert production_batches)
- No DELETE policies anywhere (soft delete only via application code)
```

### Step 2.4: Build Supabase Client Files
**Tell Claude Code:**
```
Create the three Supabase client files as specified in CLAUDE.md:
- src/lib/supabase/client.ts (browser)
- src/lib/supabase/server.ts (server components with cookies)
- src/lib/supabase/admin.ts (service-role for webhooks)
Also run: npx supabase gen types ts --local > src/types/database.ts
```

### Step 2.5: Build Auth System
**Tell Claude Code:**
```
Build the authentication system:
- src/app/(auth)/login/page.tsx — email login with Supabase Auth
  (phone OTP can be added later, email first for simplicity)
- src/app/(auth)/signup/page.tsx — creates user + organization
  (fields: name, email, password, company name, city, industry)
- Auth callback route
- src/middleware.ts — check auth, redirect unauthenticated to /login
After login, store org_id and role in user session metadata.
```

**Verify:** 
```bash
npm run dev
# Go to localhost:3000/signup → create account → should redirect to dashboard
# Go to localhost:3000/login → login → should redirect to dashboard
```

### Step 2.6: Build Dashboard Layout
**Tell Claude Code:**
```
Build src/app/(dashboard)/layout.tsx:
- Sidebar with navigation icons (lucide-react)
- Items: Dashboard, Orders, Invoices, Customers, Vendors (tier_1)
  Production, Quality, Inventory, Cash Flow (tier_2)
  Compliance, SOP Builder (tier_3)
  Settings (all tiers)
- Read src/config/features.ts for tier mapping
- Show/hide items based on user's org tier
- Top bar: org name, language switcher (gu/hi/en), user menu
- Mobile: collapsible sidebar (hamburger menu)
- Use shadcn/ui sidebar and navigation components
```

### Step 2.7: Build Placeholder Pages
**Tell Claude Code:**
```
Create page.tsx for all 12 dashboard routes:
(dashboard)/page.tsx, orders/page.tsx, invoices/page.tsx,
production/page.tsx, quality/page.tsx, inventory/page.tsx,
cash-flow/page.tsx, compliance/page.tsx, sop-builder/page.tsx,
customers/page.tsx, vendors/page.tsx, settings/page.tsx

Each page: title + description + "Building this in Sprint X" message.
If user's tier doesn't include the feature, show upsell screen:
"This feature is available on [tier name]. [Upgrade →]"
```

### Step 2.8: Set Up i18n
**Tell Claude Code:**
```
Set up next-intl with three locales: gu (Gujarati), hi (Hindi), en (English).
Create src/i18n/gu.json, hi.json, en.json with translations for:
- All navigation labels
- All page titles
- Common buttons: confirm, cancel, delete, save, edit, back
- Common messages: loading, error, success, no data
Wire up the language switcher in the top bar to change locale.
```

### Step 2.9: Test Everything + Commit
```bash
npm run dev
# Test: login/signup, sidebar navigation, page access, language switching
npm run type-check  # should pass with no errors
npm run lint        # should pass
git add . && git commit -m "feat: complete sprint 1 — database, auth, layout"
git push
```

**Manual task (not Claude Code):** Go to AiSensy dashboard and submit all 11 WhatsApp message templates from docs/whatsapp/TEMPLATES.md. Submit in English, Hindi, and Gujarati.

---

## PHASE 3: SPRINT 2 — WHATSAPP BRAIN (Week 3-4)

*Follow the same pattern: read BUILD_GUIDE.md Sprint 2, execute each session with Claude Code. Key milestone: send a WhatsApp message → get an AI-processed response back.*

**Critical setup for this sprint:**
```bash
# Install ngrok (tunnels local dev to public URL for webhook testing)
brew install ngrok
ngrok http 3000
# Copy the https://xxx.ngrok.io URL → use as webhook URL in AiSensy
```

---

## PHASE 4-8: SPRINTS 3-8 (Weeks 5-16)

*Each sprint follows the same pattern:*
1. Open BUILD_GUIDE.md → find the sprint's task list
2. Start Claude Code session
3. For each task: tell Claude Code which doc to read + what to build
4. Review in browser (npm run dev)
5. Run type-check and lint
6. Commit and push
7. Next task

*See BUILD_GUIDE.md for the complete task list for each sprint.*

---

## DEPLOYING N8N ON HETZNER (Do during Sprint 2)

### Step: SSH into your Hetzner server and set up n8n
```bash
# From your MacBook:
ssh root@YOUR_HETZNER_IP

# On the server:
apt update && apt upgrade -y
apt install docker.io docker-compose-v2 -y

# Create n8n directory
mkdir -p /opt/n8n
cd /opt/n8n

# Create docker-compose.yml (copy from your repo's n8n/docker-compose.yml)
nano docker-compose.yml
# Paste the content, save (Ctrl+X, Y, Enter)

# Create Caddyfile for HTTPS
nano Caddyfile
# Content:
# n8n.yourdomain.com {
#   reverse_proxy n8n:5678
# }

# Start n8n
docker compose up -d

# Verify:
# Open https://n8n.yourdomain.com in browser → should see n8n setup wizard
```

---

## DAILY DEVELOPMENT ROUTINE

```
Morning:
1. Open Terminal
2. cd ~/Documents/vyaops
3. npm run dev (start dev server)
4. Open browser to localhost:3000
5. Open Claude Code: claude
6. "Read CLAUDE.md. Continue from where we left off. Next task: [describe task]"

Building:
7. Give Claude Code a specific task from BUILD_GUIDE.md
8. Review the code it writes in VS Code or browser
9. If correct → commit. If not → tell Claude Code to fix.
10. Move to next task.

End of Day:
11. git add . && git commit -m "[description]"
12. git push
13. Check Vercel preview deployment works
14. Note what's next in BUILD_GUIDE.md
```

---

## TROUBLESHOOTING

### "Claude Code ran out of usage"
You're on the Pro plan ($20/mo). Upgrade to Max 5x ($100/mo) for heavy building.
Or wait for the limit to reset (usually daily/weekly).

### "Supabase won't start"
Make sure Docker Desktop is running. Check: `docker ps` — should show containers.
If nothing: `supabase stop && supabase start`

### "npm run dev shows errors"
Tell Claude Code: "npm run dev shows this error: [paste error]. Fix it."
It'll read the error and fix the code.

### "Build fails on Vercel"
Check Vercel deployment logs. Copy the error.
Tell Claude Code: "Vercel build failed with: [paste error]. Fix it."

### "WhatsApp webhook not receiving messages"
1. Check ngrok is running and URL matches AiSensy webhook config
2. Check AiSensy dashboard for delivery status
3. Check your API route has correct signature verification
4. Tell Claude Code: "The webhook at /api/webhooks/whatsapp isn't receiving. Here's what I see: [describe]"

### "AI extraction is wrong"
This is expected — that's what the eval loop fixes. Add the incorrect extraction as a new test case in tests/ai/benchmark.json. Over time, accuracy improves.

---

## COST TRACKER (What You'll Spend During Development)

| Item | Monthly Cost | When |
|------|-------------|------|
| Claude Pro/Max subscription | $20-100 | Month 1 onward |
| Supabase Cloud Pro | $25 (~₹2,100) | Month 2 onward (free for local dev) |
| Hetzner CX22 | €4.35 (~₹400) | Month 1 onward (for n8n) |
| DeepSeek API | ~₹500 | Month 1 onward (testing) |
| OpenRouter API (Qwen 3.7 Max) | ~₹500 | Month 2 onward (testing) |
| AiSensy | ₹0-999 | Free tier for testing, paid when live |
| Domain | ~₹800/year | Once |
| Vercel | $0-20 | Free tier during dev, Pro when live |
| ngrok | $0 | Free tier sufficient |
| **Dev phase total** | **~₹5,000-12,000/month** | |

---

## MILESTONE CHECKPOINTS

| Week | Milestone | How to Verify |
|------|-----------|---------------|
| 2 | Can login, see dashboard, navigate all pages | Login → sidebar → all 12 pages load |
| 4 | WhatsApp responds to triggered messages | Send message → get AI response |
| 6 | Can create orders + generate invoices via WhatsApp | Full order → invoice → PDF flow |
| 8 | Eval loop active, soft delete working | Run benchmark > 85% pass, delete + undo works |
| 10 | Production logging + quality dashboard working | Log batch → see rejection chart update |
| 12 | Cash flow dashboard + daily summaries live | See receivables aging, get morning WhatsApp |
| 14 | Billing + feature gating complete | Razorpay checkout works, tier restrictions enforced |
| 16 | First 5 customers live | Real factory owner using it daily |

---

*This guide is your North Star. Follow it step by step. When stuck, paste the error to Claude Code. When confused about what to build, read the relevant doc in /docs. When in doubt, build less but build right.*

*Let's go. 🏭*
