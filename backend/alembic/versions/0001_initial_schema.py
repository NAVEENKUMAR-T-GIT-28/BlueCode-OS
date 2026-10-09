"""Initial schema: 9 tables, composite tenant FKs, Row-Level Security, grants.

Revision ID: 0001
Revises:
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# NOTE: no percent signs and no colon-prefixed words anywhere in this SQL
# (it is passed through SQLAlchemy text() and a DBAPI driver).

SCHEMA_SQL = """
CREATE TABLE startups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  plan              TEXT NOT NULL DEFAULT 'pilot',
  status            TEXT NOT NULL DEFAULT 'trial'
                    CHECK (status IN ('trial','active','expired','suspended')),
  trial_ends_at     TIMESTAMPTZ NOT NULL,
  booking_link      TEXT,
  smtp_config_enc   BYTEA,
  imap_config_enc   BYTEA,
  sender_name       TEXT,
  sender_address    TEXT,
  daily_send_cap    INT NOT NULL DEFAULT 30,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id     UUID NOT NULL REFERENCES startups(id),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','member')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE icps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id           UUID NOT NULL REFERENCES startups(id),
  product_description  TEXT NOT NULL,
  criteria_json        JSONB NOT NULL,
  confirmed            BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, startup_id)
);

CREATE TABLE prospects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id      UUID NOT NULL REFERENCES startups(id),
  icp_id          UUID NOT NULL,
  apollo_org_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  domain          TEXT,
  industry        TEXT,
  headcount       INT,
  geo             TEXT,
  raw_json        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, apollo_org_id),
  UNIQUE (id, startup_id),
  FOREIGN KEY (icp_id, startup_id) REFERENCES icps (id, startup_id)
);

CREATE TABLE decision_makers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id        UUID NOT NULL REFERENCES startups(id),
  prospect_id       UUID NOT NULL,
  apollo_person_id  TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  title             TEXT,
  email             TEXT,
  email_status      TEXT CHECK (email_status IN ('verified','unverified','missing')),
  linkedin_url      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, apollo_person_id),
  UNIQUE (id, startup_id),
  FOREIGN KEY (prospect_id, startup_id) REFERENCES prospects (id, startup_id)
);

CREATE TABLE leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id         UUID NOT NULL REFERENCES startups(id),
  prospect_id        UUID NOT NULL,
  dm_id              UUID NOT NULL,
  score              INT CHECK (score BETWEEN 0 AND 100),
  band               TEXT CHECK (band IN ('hot','high','medium','low')),
  rationale          TEXT,
  state              TEXT NOT NULL DEFAULT 'discovered'
                     CHECK (state IN ('discovered','dm_found','scored','filtered_out','drafted',
                       'approved','sent','followup_due','followup_sent','no_response','replied',
                       'positive','link_sent','booked','negative','unsubscribed','closed')),
  state_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed         BOOLEAN NOT NULL DEFAULT false,
  booked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, dm_id),
  UNIQUE (id, startup_id),
  FOREIGN KEY (prospect_id, startup_id) REFERENCES prospects (id, startup_id),
  FOREIGN KEY (dm_id, startup_id) REFERENCES decision_makers (id, startup_id)
);

CREATE TABLE outreach_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id         UUID NOT NULL REFERENCES startups(id),
  lead_id            UUID NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  kind               TEXT NOT NULL
                     CHECK (kind IN ('cold_email','apollo_dm','followup_1','followup_2','reply')),
  channel            TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','apollo')),
  subject            TEXT,
  body               TEXT NOT NULL,
  status             TEXT NOT NULL
                     CHECK (status IN ('draft','approved','sent','failed','bounced','received')),
  intent             TEXT CHECK (intent IN ('positive','negative','question','unsubscribe','auto_reply')),
  intent_confidence  REAL,
  handled            BOOLEAN NOT NULL DEFAULT false,
  scheduled_for      TIMESTAMPTZ,
  sent_at            TIMESTAMPTZ,
  received_at        TIMESTAMPTZ,
  message_id_header  TEXT,
  in_reply_to        TEXT,
  error              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (lead_id, startup_id) REFERENCES leads (id, startup_id)
);

CREATE TABLE usage_tracker (
  startup_id            UUID PRIMARY KEY REFERENCES startups(id),
  cap_minor             BIGINT NOT NULL DEFAULT 100000,
  reserved_minor        BIGINT NOT NULL DEFAULT 0,
  spent_minor           BIGINT NOT NULL DEFAULT 0,
  prospects_used        INT NOT NULL DEFAULT 0,
  dm_lookups_used       INT NOT NULL DEFAULT 0,
  messages_generated    INT NOT NULL DEFAULT 0,
  emails_sent           INT NOT NULL DEFAULT 0,
  apollo_dms_generated  INT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_minor >= 0 AND spent_minor >= 0),
  CHECK (spent_minor + reserved_minor <= cap_minor)
);

CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID NOT NULL REFERENCES startups(id),
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','succeeded','partial','failed','paused_budget')),
  total         INT NOT NULL DEFAULT 0,
  done          INT NOT NULL DEFAULT 0,
  failed        INT NOT NULL DEFAULT 0,
  params_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  error         TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX leads_startup_state_idx ON leads (startup_id, state);
CREATE INDEX leads_startup_band_idx ON leads (startup_id, band);
CREATE INDEX outreach_startup_lead_idx ON outreach_history (startup_id, lead_id, created_at);
CREATE INDEX outreach_followup_idx ON outreach_history (startup_id, direction, status, sent_at);
CREATE INDEX outreach_msgid_idx ON outreach_history (message_id_header);
CREATE INDEX jobs_queue_idx ON jobs (status, run_after);
CREATE INDEX jobs_startup_created_idx ON jobs (startup_id, created_at DESC);
"""

RLS_SQL = """
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','icps','prospects','decision_makers','leads',
                           'outreach_history','usage_tracker','jobs']
  LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE ' || quote_ident(t) || ' FORCE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY tenant_isolation ON ' || quote_ident(t)
         || ' USING (startup_id = nullif(current_setting(''app.current_startup_id'', true), '''')::uuid)'
         || ' WITH CHECK (startup_id = nullif(current_setting(''app.current_startup_id'', true), '''')::uuid)';
  END LOOP;
END
$$;

ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE startups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON startups
  USING (id = nullif(current_setting('app.current_startup_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.current_startup_id', true), '')::uuid);

-- Login must find a user by email before any tenant is known. This extra policy
-- exposes ONLY the single row whose email matches the transaction-local setting,
-- and ONLY for SELECT.
CREATE POLICY auth_lookup ON users FOR SELECT
  USING (nullif(current_setting('app.auth_email', true), '') IS NOT NULL
         AND email = current_setting('app.auth_email', true));
"""

GRANTS_SQL = """
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['app_user','worker_user']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE 'GRANT USAGE ON SCHEMA public TO ' || quote_ident(r);
      EXECUTE 'GRANT SELECT, INSERT, UPDATE ON startups, users, icps, prospects, decision_makers, '
           || 'leads, outreach_history, usage_tracker, jobs TO ' || quote_ident(r);
    END IF;
  END LOOP;

  -- The worker must claim queued jobs across all tenants. This policy is limited
  -- to the jobs table; every other table still requires a tenant context.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_user') THEN
    EXECUTE 'CREATE POLICY worker_queue ON jobs TO worker_user USING (true) WITH CHECK (true)';
  END IF;
END
$$;
"""


def upgrade() -> None:
    op.execute(SCHEMA_SQL)
    op.execute(RLS_SQL)
    op.execute(GRANTS_SQL)


def downgrade() -> None:
    op.execute(
        "DROP TABLE IF EXISTS jobs, usage_tracker, outreach_history, leads, "
        "decision_makers, prospects, icps, users, startups CASCADE"
    )
