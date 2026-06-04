-- Razorpay webhook events for billing history.
-- APPEND-ONLY: immutable event log, no updated_at, no deleted_at.
-- razorpay_event_id UNIQUE prevents duplicate webhook processing.

CREATE TABLE billing_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  event_type          TEXT        NOT NULL,
  razorpay_event_id   TEXT        NOT NULL UNIQUE,
  payload             JSONB       NOT NULL,
  processed           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_events_org ON billing_events(organization_id, created_at DESC);
CREATE INDEX idx_billing_events_unprocessed ON billing_events(organization_id) WHERE processed = FALSE;
