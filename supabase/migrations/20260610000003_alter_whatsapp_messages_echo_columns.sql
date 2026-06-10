-- Add echo-tracking columns to whatsapp_messages.
-- is_echo: true when this record came via smb_message_echoes (owner outbound from phone).
-- chat_phone: the customer-side phone of the chat, for both directions.
--   For inbound:  equals sender_phone (the customer).
--   For echoes:   the recipient (the customer the owner was replying to).
-- These columns make it easy to:
--   a) loop-guard: check if a wamid is an outbound we already logged
--   b) correlate all messages in a chat regardless of direction

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_echo    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chat_phone TEXT;

COMMENT ON COLUMN whatsapp_messages.is_echo IS
  'TRUE when this message arrived via smb_message_echoes (owner reply from his phone).';

COMMENT ON COLUMN whatsapp_messages.chat_phone IS
  'Customer-side phone of the chat. For inbound = sender_phone; for echoes = recipient phone.';

-- Index for echo loop guard: given a wamid, confirm it is outbound (not customer inbound)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_outbound_echo
  ON whatsapp_messages (message_id, direction)
  WHERE direction = 'outbound';
