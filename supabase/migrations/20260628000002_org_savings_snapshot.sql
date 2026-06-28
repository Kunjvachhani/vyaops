-- S8.2 follow-up (#4): cached "₹ saved" snapshot on organizations.
--
-- The full rupees-saved engine (src/lib/utils/rupees-saved.ts) runs ~10 queries per org,
-- which is too heavy to compute for every org on the platform-admin dashboard load. A daily
-- cron (/api/cron/savings-snapshot) recomputes the all-time total per org and writes it here,
-- so the admin customer-overview reads ONE cheap column instead of estimating.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS total_saved_paise   BIGINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS savings_calculated_at TIMESTAMPTZ;
