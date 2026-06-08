import type { Tier } from '@/lib/constants'

export type OrgTier = Tier

// ─── Top-level menu item ──────────────────────────────────────────────────────

export interface MenuItemDef {
  id: string
  featureKey: string
  icon: string
  title: string        // max 24 chars (WhatsApp list row title limit)
  description: string  // max 72 chars
}

// ─── Sub-menu item ────────────────────────────────────────────────────────────

export interface SubMenuItemDef {
  id: string
  title: string        // max 24 chars
  description: string  // max 72 chars
}

export interface SubMenuDef {
  featureKey: string
  triggerId: string
  sectionTitle: string
  items: SubMenuItemDef[]
}

// ─── All top-level menu items (tier_1 first, tier_2 additions, tier_3 additions)

export const ALL_MENU_ITEMS: MenuItemDef[] = [
  // tier_1
  {
    id: 'menu_orders',
    featureKey: 'orders',
    icon: '📦',
    title: '📦 Orders',
    description: 'Place or track customer orders',
  },
  {
    id: 'menu_invoices',
    featureKey: 'invoices',
    icon: '🧾',
    title: '🧾 Invoices',
    description: 'Create or send GST invoices',
  },
  {
    id: 'menu_customers',
    featureKey: 'customers',
    icon: '👥',
    title: '👥 Customers',
    description: 'View or manage customers',
  },
  {
    id: 'menu_vendors',
    featureKey: 'vendors',
    icon: '🏭',
    title: '🏭 Vendors',
    description: 'View or manage vendors',
  },
  // tier_2 additions
  {
    id: 'menu_production',
    featureKey: 'production',
    icon: '⚙️',
    title: '⚙️ Production',
    description: 'Track jobs and production progress',
  },
  {
    id: 'menu_quality',
    featureKey: 'quality',
    icon: '✅',
    title: '✅ Quality',
    description: 'Log and view quality checks',
  },
  {
    id: 'menu_inventory',
    featureKey: 'inventory',
    icon: '🏪',
    title: '🏪 Inventory',
    description: 'Check and update stock levels',
  },
  {
    id: 'menu_cash_flow',
    featureKey: 'cash_flow',
    icon: '💰',
    title: '💰 Cash Flow',
    description: 'Payments received and outstanding',
  },
  // tier_3 additions
  {
    id: 'menu_compliance',
    featureKey: 'compliance',
    icon: '📋',
    title: '📋 Compliance',
    description: 'GST returns and compliance status',
  },
  {
    id: 'menu_sop_builder',
    featureKey: 'sop_builder',
    icon: '📝',
    title: '📝 SOP Builder',
    description: 'Standard operating procedures',
  },
]

// ─── Sub-menus per feature ────────────────────────────────────────────────────

export const SUBMENU_DEFS: SubMenuDef[] = [
  {
    featureKey: 'orders',
    triggerId: 'menu_orders',
    sectionTitle: 'Order Actions',
    items: [
      { id: 'order_new', title: '📦 New Order', description: 'Place a new customer order' },
      { id: 'order_status', title: '📊 Order Status', description: 'Check status of an order' },
      { id: 'order_history', title: '📜 Order History', description: 'View past orders' },
    ],
  },
  {
    featureKey: 'invoices',
    triggerId: 'menu_invoices',
    sectionTitle: 'Invoice Actions',
    items: [
      { id: 'invoice_create', title: '🧾 Create Invoice', description: 'Generate a new GST invoice' },
      { id: 'invoice_pending', title: '⏰ Pending Invoices', description: 'View unpaid invoices' },
      { id: 'invoice_history', title: '📜 Invoice History', description: 'View past invoices' },
    ],
  },
  {
    featureKey: 'customers',
    triggerId: 'menu_customers',
    sectionTitle: 'Customer Actions',
    items: [
      { id: 'customer_list', title: '👥 Customer List', description: 'Browse all customers' },
      { id: 'customer_add', title: '➕ Add Customer', description: 'Register a new customer' },
      { id: 'customer_dues', title: '💸 Customer Dues', description: 'Outstanding amounts by customer' },
    ],
  },
  {
    featureKey: 'vendors',
    triggerId: 'menu_vendors',
    sectionTitle: 'Vendor Actions',
    items: [
      { id: 'vendor_list', title: '🏭 Vendor List', description: 'Browse all vendors' },
      { id: 'vendor_po', title: '📋 Purchase Order', description: 'Place a vendor purchase order' },
      { id: 'vendor_dues', title: '💸 Vendor Dues', description: 'Outstanding amounts to vendors' },
    ],
  },
  {
    featureKey: 'production',
    triggerId: 'menu_production',
    sectionTitle: 'Production Actions',
    items: [
      { id: 'production_update', title: '⚙️ Update Progress', description: 'Update job completion count' },
      { id: 'production_view', title: '📊 View Jobs', description: 'See all active production jobs' },
      { id: 'production_report', title: '📋 Daily Report', description: "Today's production summary" },
    ],
  },
  {
    featureKey: 'quality',
    triggerId: 'menu_quality',
    sectionTitle: 'Quality Actions',
    items: [
      { id: 'quality_log', title: '✅ Log Check', description: 'Record a quality inspection' },
      { id: 'quality_view', title: '📊 Quality Reports', description: 'View recent quality checks' },
    ],
  },
  {
    featureKey: 'inventory',
    triggerId: 'menu_inventory',
    sectionTitle: 'Inventory Actions',
    items: [
      { id: 'inventory_check', title: '🏪 Check Stock', description: 'View current inventory levels' },
      { id: 'inventory_update', title: '📝 Update Stock', description: 'Record stock in or out' },
      { id: 'inventory_low', title: '⚠️ Low Stock', description: 'Items below reorder level' },
    ],
  },
  {
    featureKey: 'cash_flow',
    triggerId: 'menu_cash_flow',
    sectionTitle: 'Cash Flow Actions',
    items: [
      { id: 'cashflow_today', title: "💰 Today's Summary", description: 'Cash received vs outstanding today' },
      { id: 'cashflow_pending', title: '⏰ Pending Payments', description: 'Overdue customer payments' },
    ],
  },
  {
    featureKey: 'compliance',
    triggerId: 'menu_compliance',
    sectionTitle: 'Compliance Actions',
    items: [
      { id: 'compliance_gst', title: '📋 GST Status', description: 'GST filing status and dues' },
      { id: 'compliance_docs', title: '📄 Documents', description: 'Compliance documents archive' },
    ],
  },
  {
    featureKey: 'sop_builder',
    triggerId: 'menu_sop_builder',
    sectionTitle: 'SOP Actions',
    items: [
      { id: 'sop_view', title: '📝 View SOPs', description: 'Browse standard procedures' },
      { id: 'sop_create', title: '➕ Create SOP', description: 'Draft a new procedure' },
    ],
  },
]

// ─── Button ID → pipeline action ─────────────────────────────────────────────

export const BUTTON_ACTION_MAP: Record<string, string> = {
  // top-level feature triggers
  menu_orders: 'show_orders_submenu',
  menu_invoices: 'show_invoices_submenu',
  menu_customers: 'show_customer_list',
  menu_vendors: 'show_vendor_list',
  menu_production: 'show_production_submenu',
  menu_quality: 'show_quality_submenu',
  menu_inventory: 'show_inventory_submenu',
  menu_cash_flow: 'show_cashflow_submenu',
  menu_compliance: 'show_compliance_submenu',
  menu_sop_builder: 'show_sop_submenu',
  // orders
  order_new: 'start_order_flow',
  order_status: 'show_order_status',
  order_history: 'show_order_history',
  // invoices
  invoice_create: 'start_invoice_flow',
  invoice_pending: 'show_pending_invoices',
  invoice_history: 'show_invoice_history',
  // customers
  customer_list: 'show_customer_list',
  customer_add: 'start_customer_add_flow',
  customer_dues: 'show_customer_dues',
  // vendors
  vendor_list: 'show_vendor_list',
  vendor_po: 'start_vendor_po_flow',
  vendor_dues: 'show_vendor_dues',
  // production
  production_update: 'start_production_update_flow',
  production_view: 'show_production_jobs',
  production_report: 'show_production_report',
  // quality
  quality_log: 'start_quality_log_flow',
  quality_view: 'show_quality_reports',
  // inventory
  inventory_check: 'show_inventory_levels',
  inventory_update: 'start_inventory_update_flow',
  inventory_low: 'show_low_stock',
  // cash flow
  cashflow_today: 'show_cashflow_today',
  cashflow_pending: 'show_pending_payments',
  // compliance
  compliance_gst: 'show_gst_status',
  compliance_docs: 'show_compliance_docs',
  // sop
  sop_view: 'show_sop_list',
  sop_create: 'start_sop_create_flow',
  // clarification
  clarify_retype: 'prompt_retype',
  // confirmation
  confirm_order: 'commit_order',
  edit_order: 'edit_order',
  cancel_order: 'cancel_order_flow',
  confirm_invoice: 'commit_invoice',
  edit_invoice: 'edit_invoice',
  cancel_invoice: 'cancel_invoice_flow',
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getSubMenuDef(featureKey: string): SubMenuDef | undefined {
  return SUBMENU_DEFS.find((d) => d.featureKey === featureKey)
}

export function resolveAction(buttonId: string): string | undefined {
  // Handle dynamic confirm/edit/cancel IDs (e.g. confirm_order, edit_invoice)
  if (buttonId in BUTTON_ACTION_MAP) return BUTTON_ACTION_MAP[buttonId]
  const [prefix, ...rest] = buttonId.split('_')
  const genericKey = `${prefix}_${rest.join('_')}`
  return BUTTON_ACTION_MAP[genericKey]
}
