-- Add parent_id to sop_documents for versioning.
-- parent_id IS NULL → root (version 1) document, shown in list.
-- parent_id = <root_id> → subsequent versions of that SOP.

ALTER TABLE sop_documents
  ADD COLUMN parent_id UUID REFERENCES sop_documents(id) ON DELETE CASCADE;

CREATE INDEX idx_sop_documents_parent ON sop_documents(parent_id) WHERE parent_id IS NOT NULL;
