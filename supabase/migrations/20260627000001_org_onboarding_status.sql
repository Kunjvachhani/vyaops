-- Track new-org onboarding wizard progress.
-- 'pending'  → owner has not finished the onboarding wizard (force into /onboarding)
-- 'complete' → wizard finished (or skipped through); never show wizard again.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_onboarding_status_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_onboarding_status_check
      CHECK (onboarding_status IN ('pending', 'complete'));
  END IF;
END $$;

-- Backfill: any org that already has onboarded_at set predates the wizard and is
-- considered complete, so existing owners are not bounced into onboarding.
UPDATE organizations
  SET onboarding_status = 'complete'
  WHERE onboarded_at IS NOT NULL
    AND onboarding_status <> 'complete';
