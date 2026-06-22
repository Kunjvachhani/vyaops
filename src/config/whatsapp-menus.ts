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

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getSubMenuDef(featureKey: string): SubMenuDef | undefined {
  return SUBMENU_DEFS.find((d) => d.featureKey === featureKey)
}
