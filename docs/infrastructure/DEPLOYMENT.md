# Deployment & Infrastructure

## Environments
| Env | Next.js | Supabase | n8n | Purpose |
|-----|---------|----------|-----|---------|
| Development | localhost:3000 | Local (Docker) | Local (Docker) | Building + testing |
| Staging | Vercel Preview | Supabase branch | Hetzner (same VPS, different port) | Pre-production testing |
| Production | Vercel Pro | Supabase Cloud Pro | Hetzner CX22 | Live customers |

## Hosting Stack
- Next.js: Vercel (auto-deploy from GitHub main branch)
- Supabase: Supabase Cloud Pro ($25/mo) — Mumbai or Singapore region
- n8n: Hetzner Cloud CX22 (2 vCPU, 4GB RAM, €4.35/mo) — Docker Compose
- Hermes Agent: Same Hetzner VPS (shared)
- Backups: Hetzner Storage Box (100GB, €3.81/mo)
- CDN/DNS: Cloudflare (free)
- Error Monitoring: Sentry (free tier, 5K errors/mo)
- Analytics: PostHog (free tier, 1M events/mo)

## Docker Compose (n8n)
```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
    volumes:
      - n8n_data:/home/node/.n8n
  caddy:
    image: caddy:latest
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
volumes:
  n8n_data:
  caddy_data:
```

## Backup Strategy
- Supabase: daily automated backup (included in Pro plan)
- n8n workflows: exported as JSON in git repo (version controlled)
- Additional: nightly pg_dump to Hetzner Storage Box via cron

## CI/CD Pipeline (GitHub Actions)
```
Push to main → Vercel auto-deploys → Sentry release tracking
Push to any branch → Vercel preview deployment
PR opened → TypeScript check + ESLint + unit tests
```

## Webhook Security
- WhatsApp (two-layer auth per CLAUDE.md):
  - Layer 1: X-Hub-Signature-256 HMAC — first try DUALHOOK_SIGNING_SECRET, then META_WHATSAPP_APP_SECRET
  - Layer 2 (fallback): secret URL token (?t= query param, WHATSAPP_WEBHOOK_URL_TOKEN) baked into the Dualhook webhook URL. Required because Dualhook Coexistence deliveries are signed by their tech-provider app secret.
- Razorpay: verify X-Razorpay-Signature with RAZORPAY_WEBHOOK_SECRET
- REJECT any webhook that fails ALL applicable verification layers
- Log all rejected webhooks to Sentry for monitoring
