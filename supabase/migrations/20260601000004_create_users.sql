-- Platform users: web access + WhatsApp triggers.
-- Roles: owner (1 per org) | manager | worker | viewer

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email            TEXT        UNIQUE,
  phone            TEXT,
  full_name        TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'worker'
                                 CHECK (role IN ('owner', 'manager', 'worker', 'viewer')),
  avatar_url       TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at    TIMESTAMPTZ,
  supabase_auth_id UUID        UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_users_org ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_supabase_auth ON users(supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;
