-- Storage bucket for generated invoice PDFs.
-- PRIVATE: invoices carry GSTINs, amounts and customer details — sensitive financial
-- data. No public/anon access. All reads/writes go through adminClient (service role,
-- which bypasses storage RLS), mirroring the service-role-only pattern of audit_log
-- and whatsapp_messages. Consumers mint short-lived signed URLs on demand.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
