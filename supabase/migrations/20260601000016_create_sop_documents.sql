-- Standard Operating Procedure documents.
-- Content stored as markdown. Versioned by integer increment.

CREATE TABLE sop_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title            TEXT        NOT NULL,
  category         TEXT        CHECK (category IN ('production', 'quality', 'safety', 'maintenance')),
  content          TEXT        NOT NULL,
  version          INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
  status           TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'published', 'archived')),
  published_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON sop_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_sop_documents_org ON sop_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sop_documents_status ON sop_documents(organization_id, status) WHERE deleted_at IS NULL;
