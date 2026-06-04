import type { Tier } from '@/lib/constants'

export interface MenuOption {
  id: string
  title: string
  description?: string
}

export interface WhatsAppMenu {
  buttonText: string
  sections: Array<{
    title: string
    rows: MenuOption[]
  }>
}

const MAIN_MENU_TIER_1: WhatsAppMenu = {
  buttonText: 'Menu',
  sections: [
    {
      title: 'Orders',
      rows: [
        { id: 'new_order', title: 'New Order', description: 'Place a new order' },
        { id: 'check_order', title: 'Check Order', description: 'Check order status' },
      ],
    },
    {
      title: 'Invoices',
      rows: [
        { id: 'create_invoice', title: 'Create Invoice', description: 'Generate an invoice' },
      ],
    },
  ],
}

const MAIN_MENU_TIER_2: WhatsAppMenu = {
  ...MAIN_MENU_TIER_1,
  sections: [
    ...MAIN_MENU_TIER_1.sections,
    {
      title: 'Production',
      rows: [
        { id: 'log_production', title: 'Log Production', description: 'Record production output' },
        { id: 'quality_check', title: 'Quality Check', description: 'Log quality inspection' },
      ],
    },
  ],
}

const MAIN_MENU_TIER_3: WhatsAppMenu = {
  ...MAIN_MENU_TIER_2,
  sections: [
    ...MAIN_MENU_TIER_2.sections,
    {
      title: 'Analytics',
      rows: [
        { id: 'cash_flow', title: 'Cash Flow', description: 'View cash flow report' },
        { id: 'compliance', title: 'Compliance', description: 'Check compliance status' },
      ],
    },
  ],
}

export function getMainMenu(tier: Tier): WhatsAppMenu {
  switch (tier) {
    case 'tier_3':
      return MAIN_MENU_TIER_3
    case 'tier_2':
      return MAIN_MENU_TIER_2
    default:
      return MAIN_MENU_TIER_1
  }
}
