export const FEATURE_ACCESS: Record<string, string> = {
  dashboard_basic: 'tier_1', orders: 'tier_1', invoices: 'tier_1',
  customers: 'tier_1', vendors: 'tier_1', settings: 'tier_1',
  whatsapp_orders: 'tier_1', whatsapp_invoices: 'tier_1',
  whatsapp_vendor_po: 'tier_1', daily_summaries: 'tier_1',
  payment_reminders: 'tier_1',
  production: 'tier_2', quality: 'tier_2', inventory: 'tier_2',
  cash_flow: 'tier_2', auto_mode: 'tier_2',
  whatsapp_production: 'tier_2', whatsapp_inventory: 'tier_2',
  rupee_saved_counter: 'tier_2',
  low_stock_alerts: 'tier_2', weekly_summaries: 'tier_2',
  compliance: 'tier_3', sop_builder: 'tier_3',
  advanced_analytics: 'tier_3', cash_flow_forecast: 'tier_3',
  custom_reports: 'tier_3',
};
export type Tier = 'tier_1' | 'tier_2' | 'tier_3';
export const TIER_HIERARCHY: Record<Tier, number> = { tier_1: 1, tier_2: 2, tier_3: 3 };
export function hasAccess(orgTier: Tier, featureKey: string): boolean {
  const required = FEATURE_ACCESS[featureKey];
  if (!required) return false;
  return TIER_HIERARCHY[orgTier] >= TIER_HIERARCHY[required as Tier];
}

// Maps a gated dashboard route prefix → its feature key. The route's required tier is then
// derived from FEATURE_ACCESS, so there is ONE source of truth for tier gating (no separate
// hardcoded prefix→tier table in middleware that can drift). See docs/security/FEATURE_GATING.md.
export const ROUTE_FEATURE: Record<string, string> = {
  '/production': 'production',
  '/quality': 'quality',
  '/inventory': 'inventory',
  '/cash-flow': 'cash_flow',
  '/compliance': 'compliance',
  '/sop-builder': 'sop_builder',
};

// Returns the minimum tier required to access `pathname`, or null if the route is ungated.
export function requiredTierForRoute(pathname: string): Tier | null {
  for (const [prefix, featureKey] of Object.entries(ROUTE_FEATURE)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      const required = FEATURE_ACCESS[featureKey];
      if (required && required in TIER_HIERARCHY) return required as Tier;
    }
  }
  return null;
}

// billing_status values that still grant paid (tier_2+) route access. A halted subscription
// keeps access through its grace period; suspended/cancelled lose it immediately.
const PAID_ACCESS_BILLING_STATUSES = new Set(['active', 'grace_period']);
export function billingAllowsPaidAccess(billingStatus: string | null | undefined): boolean {
  return PAID_ACCESS_BILLING_STATUSES.has(billingStatus ?? '');
}
