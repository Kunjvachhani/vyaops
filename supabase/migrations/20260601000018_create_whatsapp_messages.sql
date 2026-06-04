-- Raw message log for AI training data and audit trail.
-- APPEND-ONLY for inbound messages: no updates, no deletes.
-- organization_id is raw UUID (no FK) so messages are retained even after org changes.
-- processing_result JSONB: extracted entities and matched records from the NLP pipeline.

CREATE TABLE whatsapp_messages (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL,
  message_id         TEXT         NOT NULL,
  direction          TEXT         NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_phone       TEXT         NOT NULL,
  message_type       TEXT         NOT NULL
                                    CHECK (message_type IN ('text', 'image', 'document', 'interactive', 'template')),
  message_body       TEXT,
  media_url          TEXT,
  intent_classified  TEXT,
  intent_confidence  NUMERIC(3,2) CHECK (intent_confidence >= 0 AND intent_confidence <= 1),
  eval_score         NUMERIC(3,2) CHECK (eval_score >= 0 AND eval_score <= 1),
  was_triggered      BOOLEAN      NOT NULL DEFAULT FALSE,
  was_processed      BOOLEAN      NOT NULL DEFAULT FALSE,
  processing_result  JSONB,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_org ON whatsapp_messages(organization_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);
CREATE INDEX idx_whatsapp_messages_sender ON whatsapp_messages(organization_id, sender_phone);
CREATE INDEX idx_whatsapp_messages_unprocessed ON whatsapp_messages(organization_id)
  WHERE was_triggered = TRUE AND was_processed = FALSE;
