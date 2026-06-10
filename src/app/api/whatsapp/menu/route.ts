// DEPRECATED: The owner-facing guided menu no longer exists in the new
// customer-initiated echo-confirmed flow. This route is retained only in case
// it is repurposed for future admin tooling. It is NOT wired into the n8n
// master-message-handler workflow and should NOT be called from customer chats.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { sendRawMessage } from '@/lib/whatsapp/meta-cloud-api'
import { buildMainMenu, buildCustomerList, buildVendorList } from '@/lib/whatsapp/interactive'
import { SUBMENU_DEFS } from '@/config/whatsapp-menus'
import { requireInternalAuth } from '@/lib/utils/internal-auth'
import type { InteractiveMessage } from '@/types/whatsapp'
import type { Tier } from '@/lib/constants'

const LIST_TITLE_MAX = 24
const LIST_DESC_MAX = 72
const trunc = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`)

// Body sent by the n8n Get SubMenu / Send Main Menu nodes.
const RequestSchema = z.object({
  menuId: z.string().min(1),
  orgId: z.string().uuid(),
  sender: z.string().min(5),
  sendDirect: z.boolean().optional().default(false),
})

// Builds the right InteractiveMessage for a menu id. Customers/vendors resolve
// to live lists; other feature triggers render their static sub-menu.
async function buildMenu(menuId: string, orgId: string, tier: Tier): Promise<InteractiveMessage> {
  if (menuId === 'menu_main') return buildMainMenu(tier)
  if (menuId === 'menu_customers') return buildCustomerList(orgId)
  if (menuId === 'menu_vendors') return buildVendorList(orgId)

  const submenu = SUBMENU_DEFS.find((d) => d.triggerId === menuId)
  if (submenu) {
    return {
      type: 'list',
      body: 'Choose an action:',
      sections: [
        {
          title: submenu.sectionTitle,
          rows: submenu.items.map((i) => ({
            id: i.id,
            title: trunc(i.title, LIST_TITLE_MAX),
            description: trunc(i.description, LIST_DESC_MAX),
          })),
        },
      ],
    }
  }

  // Unknown id → fall back to the main menu rather than erroring on the user.
  return buildMainMenu(tier)
}

// Convert our internal InteractiveMessage into a Meta Cloud API `interactive` object.
function toMetaInteractive(msg: InteractiveMessage): Record<string, unknown> {
  if (msg.type === 'list') {
    return {
      type: 'list',
      body: { text: msg.body },
      action: { button: 'Select', sections: msg.sections },
    }
  }
  return {
    type: 'button',
    body: { text: msg.body },
    action: {
      buttons: msg.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
    },
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalAuth(request)
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { menuId, orgId, sender, sendDirect } = parsed.data

  try {
    const { data: org, error: orgErr } = await adminClient
      .from('organizations')
      .select('tier')
      .eq('id', orgId)
      .is('deleted_at', null)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Org not found', code: 'ORG_NOT_FOUND' }, { status: 404 })
    }

    const menu = await buildMenu(menuId, orgId, org.tier as Tier)
    const interactive = toMetaInteractive(menu)

    // Two-step path: return the interactive object for n8n to forward to /send.
    if (!sendDirect) {
      return NextResponse.json({ interactive })
    }

    // Direct path: send it ourselves and report the message id.
    const result = await sendRawMessage(sender, { type: 'interactive', interactive }, orgId)
    if (!result.success) {
      return NextResponse.json({ error: result.error, code: 'META_SEND_FAILED' }, { status: 502 })
    }
    return NextResponse.json({ sent: true, messageId: result.messageId })
  } catch (error) {
    return NextResponse.json(
      { error: 'Menu build failed', code: 'MENU_ERROR', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
