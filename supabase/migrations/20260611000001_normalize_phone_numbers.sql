-- Normalize all stored phone numbers to digit-only format (no + or spaces).
-- This matches what normalizePhone() in src/lib/utils/phone.ts produces,
-- ensuring webhook lookups (which normalize incoming numbers before querying) work.

UPDATE customers
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone ~ '[^0-9]';

UPDATE vendors
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone ~ '[^0-9]';

UPDATE users
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone ~ '[^0-9]';

UPDATE organizations
SET whatsapp_phone = regexp_replace(whatsapp_phone, '[^0-9]', '', 'g')
WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone ~ '[^0-9]';
