-- Regulatory compliance calendar (GST, PF, ESI, factory permits, etc).

CREATE TABLE compliance_tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  task_name        TEXT        NOT NULL,
  category         TEXT        NOT NULL
                                 CHECK (category IN ('gst', 'pf', 'esi', 'factory', 'pollution', 'fire', 'electrical')),
  frequency        TEXT        NOT NULL
                                 CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'biannual')),
  due_date         DATE        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'na')),
  completed_date   DATE,
  completed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  reminder_sent    BOOLEAN     NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_compliance_tasks_org ON compliance_tasks(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_tasks_due ON compliance_tasks(due_date) WHERE status NOT IN ('completed', 'na') AND deleted_at IS NULL;
