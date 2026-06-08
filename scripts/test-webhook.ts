/**
 * Webhook routing test.
 *
 * Simulates inbound WhatsApp events hitting the n8n master message handler,
 * using the documented forward contract:
 *   { message, sender, orgId, messageType, isTriggered }
 *
 * For each case it POSTs to the n8n production webhook, then (if an n8n API key
 * is available) polls the executions API to report which branch ran and whether
 * any node errored.
 *
 * Run:  npm run test:webhook
 * (env preloaded via `tsx --env-file=.env.local`)
 *
 * Requires: N8N_WEBHOOK_URL + N8N_API in .env.local, workflow active.
 */

import { adminClient } from '@/lib/supabase/admin'

const ORG_PHONE = '+919876543210'
const WORKFLOW_ID = 'vyaops-master-message-handler'

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? ''
const N8N_API_KEY = process.env.N8N_API ?? ''
// Derive the API base + UI base from the webhook URL host.
const N8N_ORIGIN = WEBHOOK_URL ? new URL(WEBHOOK_URL).origin : ''

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}
const ok = (s: string) => `${C.green}✓${C.reset} ${s}`
const warn = (s: string) => `${C.yellow}⚠${C.reset} ${s}`
const fail = (s: string) => `${C.red}✗${C.reset} ${s}`
const hr = () => console.log(C.dim + '─'.repeat(72) + C.reset)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type WebhookCase = {
  label: string
  description: string
  expectedBranch: string
  payload: Record<string, unknown>
}

function buildCases(orgId: string): WebhookCase[] {
  const sender = ORG_PHONE
  return [
    {
      label: 'a',
      description: '"menu" command (free text, triggered)',
      expectedBranch: 'Branch B (AI) → reject_show_menu → Send Main Menu',
      payload: { message: 'menu', sender, orgId, messageType: 'text', isTriggered: true },
    },
    {
      label: 'b',
      description: 'button tap "menu_orders"',
      expectedBranch: 'Branch A (Guided) → menu_ → Get SubMenu (customer list)',
      payload: {
        message: 'Orders',
        sender,
        orgId,
        messageType: 'button_reply',
        isTriggered: true,
        buttonReply: { id: 'menu_orders', title: 'Orders' },
      },
    },
    {
      label: 'c',
      description: 'free text order (triggered)',
      expectedBranch: 'Branch B (AI) → classify/extract/eval',
      payload: {
        message: 'rajubhai no order 500 piece valve body',
        sender,
        orgId,
        messageType: 'text',
        isTriggered: true,
      },
    },
    {
      label: 'd',
      description: 'non-triggered chatter',
      expectedBranch: 'Branch C (Log Only) — no reply',
      payload: {
        message: 'hello bhai kaam thay gyu',
        sender,
        orgId,
        messageType: 'text',
        isTriggered: false,
      },
    },
  ]
}

async function resolveOrgId(): Promise<string> {
  try {
    const { data } = await adminClient
      .from('organizations')
      .select('id')
      .eq('whatsapp_phone', ORG_PHONE)
      .is('deleted_at', null)
      .single()
    if (data?.id) return data.id
  } catch {
    /* fall through to placeholder */
  }
  console.log(warn('could not resolve org from Supabase — using placeholder orgId'))
  return '00000000-0000-0000-0000-000000000001'
}

type ExecSummary = { id: string; status: string; lastNode?: string; error?: string }

async function latestExecution(afterIso: string): Promise<ExecSummary | null> {
  if (!N8N_API_KEY || !N8N_ORIGIN) return null
  // Poll up to ~8s for a finished execution started after `afterIso`.
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(2000)
    try {
      const res = await fetch(`${N8N_ORIGIN}/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=3&includeData=true`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY, Accept: 'application/json' },
      })
      if (!res.ok) return null
      const body = (await res.json()) as { data?: Array<Record<string, unknown>> }
      const recent = (body.data ?? []).find((e) => String(e.startedAt ?? '') >= afterIso)
      if (!recent) continue
      const status = String(recent.status ?? (recent.finished ? 'success' : 'running'))
      if (status === 'running' || status === 'new') continue

      // Dig out the last executed node + error message if present.
      const data = recent.data as { resultData?: { lastNodeExecuted?: string; error?: { message?: string } } } | undefined
      return {
        id: String(recent.id),
        status,
        lastNode: data?.resultData?.lastNodeExecuted,
        error: data?.resultData?.error?.message,
      }
    } catch {
      return null
    }
  }
  return null
}

let hardFailures = 0

async function runCase(c: WebhookCase): Promise<void> {
  console.log(`${C.bold}[${c.label}] ${c.description}${C.reset}`)
  console.log(`    expect  : ${c.expectedBranch}`)

  const startedAt = new Date().toISOString()
  let acked = false
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c.payload),
    })
    const text = await res.text()
    if (res.ok) {
      acked = true
      console.log('    ' + ok(`webhook acked (${res.status}) ${C.dim}${text.slice(0, 80)}${C.reset}`))
    } else {
      console.log('    ' + fail(`webhook returned ${res.status}: ${text.slice(0, 160)}`))
      if (res.status === 404) {
        console.log('    ' + warn('workflow likely inactive — activate it in the n8n editor'))
      }
      hardFailures++
    }
  } catch (err) {
    console.log('    ' + fail(`POST failed: ${err instanceof Error ? err.message : String(err)}`))
    hardFailures++
  }

  if (acked) {
    const exec = await latestExecution(startedAt)
    if (!exec) {
      console.log('    ' + warn('no execution status (no API key, or still running) — check the n8n Executions tab'))
    } else if (exec.status === 'success') {
      console.log('    ' + ok(`execution ${exec.id} succeeded${exec.lastNode ? ` (last node: ${exec.lastNode})` : ''}`))
    } else {
      console.log(
        '    ' +
          warn(
            `execution ${exec.id} ${exec.status}` +
              (exec.lastNode ? ` at "${exec.lastNode}"` : '') +
              (exec.error ? ` — ${exec.error.slice(0, 120)}` : '')
          )
      )
    }
  }
  console.log()
}

async function main(): Promise<void> {
  console.log(C.bold + '\nVyaOps — webhook routing test\n' + C.reset)

  if (!WEBHOOK_URL) {
    console.error(fail('N8N_WEBHOOK_URL is not set in .env.local'))
    process.exit(1)
  }
  console.log(`Target: ${C.cyan}${WEBHOOK_URL}${C.reset}`)
  console.log(N8N_API_KEY ? ok('n8n API key present — will report execution status') : warn('no N8N_API key — POST acks only'))
  hr()

  const orgId = await resolveOrgId()
  const cases = buildCases(orgId)

  for (const c of cases) {
    await runCase(c)
  }

  hr()
  console.log(
    C.dim +
      'Note: Branches A/B/C call back into the app at $env.APP_URL\n' +
      '(/api/whatsapp/*, /api/session/*, /api/analytics/*, /api/orders).\n' +
      'Only /api/ai exists today, so downstream nodes will error until those\n' +
      'endpoints are implemented — see the run summary.' +
      C.reset
  )
  hr()
  if (hardFailures === 0) {
    console.log(ok(`${C.bold}All webhooks acked${C.reset}`))
  } else {
    console.log(fail(`${C.bold}${hardFailures} webhook failure(s)${C.reset}`))
  }
  console.log()
  process.exit(hardFailures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n' + fail(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`))
  process.exit(1)
})
