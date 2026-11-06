-- BlueCode OS consolidated initial schema. Run once on a new Supabase project.
-- BlueCode OS — normalized schema v2 (Supabase / Postgres)
-- Tenant model: one startup = one tenant. Every business table carries startup_id.
-- Child tables use composite FKs (id, startup_id) so a row can never point at another tenant's parent.
-- The API connects with the service-role key and always filters by startup_id from the JWT.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── 1. TENANT + USERS ─────────────
create table startups (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null default '',
  product          text not null default '',
  geography        text not null default 'India',
  customers        text not null default '',
  sales_objective  text not null default 'Book qualified discovery conversations' check (sales_objective = 'Book qualified discovery conversations'),
  booking_url      text check (booking_url is null or booking_url ~* '^https://\S+$'),
  setup_complete   boolean not null default false,
  status           text not null default 'active' check (status in ('active','suspended')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table users (
  id             uuid primary key default gen_random_uuid(),
  startup_id     uuid not null references startups(id) on delete cascade,
  name           text not null,
  email          text not null,
  password_hash  text not null,
  role           text not null default 'owner' check (role in ('owner','member','admin')),
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));
create index users_startup_idx on users (startup_id);

-- ───────────── 2. PLANS / TRIAL / USAGE ─────────────
create table plans (
  code                text primary key,            -- 'trial','starter','growth','pro'
  name                text not null,
  price_inr           int  not null default 0,
  max_users           int  not null,
  max_icps            int  not null,
  max_prospects       int  not null,               -- AI prospects per period
  max_dm_searches     int  not null,
  max_emails          int  not null,
  api_cost_cap_inr    int  not null,
  duration_days       int                          -- trial = 15, paid = null
);
insert into plans values
 ('trial',   '15-Day Free Trial', 0,     1, 1, 50,   50,  50,  1000, 15),
 ('starter', 'Starter',           2500,  1, 1, 100,  50,  100, 1000, null),
 ('growth',  'Growth',            5000,  3, 3, 500,  250, 500, 2000, null),
 ('pro',     'Pro',               10000, 10,10,2000, 1000,2000,5000, null)
on conflict do nothing;

create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  startup_id    uuid not null references startups(id) on delete cascade,
  plan_code     text not null references plans(code),
  status        text not null default 'trialing' check (status in ('trialing','active','expired','cancelled')),
  started_at    timestamptz not null default now(),
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index subscriptions_startup_idx on subscriptions (startup_id, status);

create table usage_events (
  id           bigint generated always as identity primary key,
  startup_id   uuid not null references startups(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  kind         text not null check (kind in ('ai_prospect','dm_search','email_draft','ai_evaluation','email_sent','follow_up')),
  units        int  not null default 1,
  cost_inr     numeric(10,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index usage_startup_kind_idx on usage_events (startup_id, kind, created_at);

-- ───────────── 3. ICP ─────────────
create table icps (
  id            uuid primary key default gen_random_uuid(),
  startup_id    uuid not null references startups(id) on delete cascade,
  name          text not null default 'Primary ICP',
  industries    text[] not null default '{}',
  company_size  text not null default '',
  geography     text not null default '',
  roles         text[] not null default '{}',
  pain_points   text not null default '',
  exclusions    text not null default '',
  objective     text not null default 'Book qualified discovery conversations' check (objective = 'Book qualified discovery conversations'),
  is_approved   boolean not null default false,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, startup_id)
);
create index icps_startup_idx on icps (startup_id);
create unique index icps_one_active_idx on icps (startup_id) where is_approved;  -- one approved ICP per startup (MVP)

-- ───────────── 4. PROSPECTS ─────────────
create table prospects (
  id                 uuid primary key default gen_random_uuid(),
  startup_id         uuid not null references startups(id) on delete cascade,
  icp_id             uuid,
  company            text not null,
  domain             text,
  website            text,
  industry           text,
  location           text,
  company_size       text,
  description        text,
  source             text not null default 'manual',      -- 'Hunter','manual','demo'
  icp_fit_score      int check (icp_fit_score between 0 and 100),
  priority           text generated always as (
                       case when icp_fit_score is null then null
                            when icp_fit_score >= 90 then 'Hot'
                            when icp_fit_score >= 70 then 'High'
                            when icp_fit_score >= 50 then 'Medium'
                            else 'Low' end) stored,
  score_source       text,                                 -- 'openrouter','heuristic'
  icp_evaluated      boolean not null default false,
  fit_reasons        text[] not null default '{}',
  evaluation         jsonb,                                -- raw AI evaluation (display only, never filtered on)
  pipeline_status    text not null default 'Target',
  status_changed_at  timestamptz not null default now(),
  why_now            text,
  data_expires_at    timestamptz,                         -- set only for provider-sourced records with an applicable retention term
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, startup_id),
  foreign key (icp_id, startup_id) references icps (id, startup_id) on delete set null (icp_id)
);
create unique index prospects_domain_key on prospects (startup_id, lower(domain)) where domain is not null;
create index prospects_rank_idx   on prospects (startup_id, icp_fit_score desc);
create index prospects_status_idx on prospects (startup_id, pipeline_status);
create index prospects_expiry_idx on prospects (data_expires_at);

-- Trigger / Buying signal / Intent, each with its evidence (per client feedback)
create table prospect_signals (
  id            uuid primary key default gen_random_uuid(),
  startup_id    uuid not null,
  prospect_id   uuid not null,
  signal_type   text not null check (signal_type in ('trigger','buying_signal','intent')),
  description   text not null,
  evidence      text,
  evidence_url  text,
  confidence    text check (confidence in ('verified','likely','unverified')),
  observed_at   timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (prospect_id, startup_id) references prospects (id, startup_id) on delete cascade
);
create index signals_prospect_idx on prospect_signals (prospect_id, signal_type);

create table decision_makers (
  id                 uuid primary key default gen_random_uuid(),
  startup_id         uuid not null,
  prospect_id        uuid not null,
  first_name         text,
  last_name          text,
  name               text not null,
  email              text,
  position           text,
  department         text,
  seniority          text,
  is_decision_maker  boolean not null default false,
  is_primary         boolean not null default false,
  confidence         int check (confidence between 0 and 100),
  verification       text,
  provenance         text,
  sources            jsonb not null default '[]',
  data_expires_at    timestamptz,                         -- set only for provider-sourced records with an applicable retention term
  created_at         timestamptz not null default now(),
  unique (id, startup_id),
  foreign key (prospect_id, startup_id) references prospects (id, startup_id) on delete cascade
);
create index dm_prospect_idx on decision_makers (prospect_id);
create unique index dm_email_key on decision_makers (prospect_id, lower(email)) where email is not null;
create unique index dm_one_primary_idx on decision_makers (prospect_id) where is_primary;

-- ───────────── 5. OUTREACH ─────────────
create table outreach (
  id                 uuid primary key default gen_random_uuid(),
  startup_id         uuid not null,
  prospect_id        uuid not null,
  decision_maker_id  uuid,
  subject            text not null default '',
  body               text not null default '',
  status             text not null default 'draft'
                       check (status in ('draft','approved','sent','replied','closed')),
  approved_at        timestamptz,
  sent_at            timestamptz,
  draft_provider     text,
  draft_model        text,
  draft_generated_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, startup_id),
  foreign key (prospect_id, startup_id) references prospects (id, startup_id) on delete cascade,
  foreign key (decision_maker_id, startup_id) references decision_makers (id, startup_id) on delete set null (decision_maker_id)
);
create index outreach_prospect_idx on outreach (startup_id, prospect_id);
create index outreach_status_idx   on outreach (startup_id, status);

create table outreach_replies (
  id                 uuid primary key default gen_random_uuid(),
  startup_id         uuid not null,
  outreach_id        uuid not null,
  body               text not null,
  intent             text not null default 'unknown' check (intent in ('positive','neutral','negative','unknown')),
  intent_reason      text,
  intent_source      text,                    -- 'openrouter','keyword'
  received_at        timestamptz not null default now(),
  response_subject   text,
  response_body      text,
  response_saved     boolean not null default false,
  created_at         timestamptz not null default now(),
  foreign key (outreach_id, startup_id) references outreach (id, startup_id) on delete cascade
);
create index replies_outreach_idx on outreach_replies (outreach_id, received_at desc);

create table follow_ups (
  id             uuid primary key default gen_random_uuid(),
  startup_id     uuid not null,
  outreach_id    uuid not null,
  sequence_no    int  not null check (sequence_no in (1,2)),
  subject        text,
  body           text,
  status         text not null default 'pending' check (status in ('pending','recorded','sent','cancelled')),
  due_at         timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  foreign key (outreach_id, startup_id) references outreach (id, startup_id) on delete cascade,
  unique (outreach_id, sequence_no)
);
create index followups_due_idx on follow_ups (startup_id, status, due_at);

-- Future SES events (sent/delivered/open/click/bounce/complaint/reply) land here; unused in MVP
create table email_events (
  id           bigint generated always as identity primary key,
  startup_id   uuid not null,
  outreach_id  uuid not null,
  event_type   text not null check (event_type in ('sent','delivered','open','click','bounce','complaint','reply')),
  provider_id  text,
  occurred_at  timestamptz not null default now(),
  raw          jsonb,
  foreign key (outreach_id, startup_id) references outreach (id, startup_id) on delete cascade
);
create unique index email_events_idem_key on email_events (provider_id, event_type) where provider_id is not null;

-- ───────────── 6. ACTIVITY + AUDIT ─────────────
create table activities (
  id           bigint generated always as identity primary key,
  startup_id   uuid not null references startups(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  title        text not null,
  detail       text not null default '',
  kind         text not null default 'mail',
  prospect_id  uuid,
  created_at   timestamptz not null default now()
);
create index activities_feed_idx on activities (startup_id, created_at desc);

create table audit_events (
  id          bigint generated always as identity primary key,
  startup_id  uuid references startups(id) on delete set null,
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ───────────── 7. HOUSEKEEPING ─────────────
create trigger trg_startups_upd  before update on startups  for each row execute function set_updated_at();
create trigger trg_icps_upd      before update on icps      for each row execute function set_updated_at();
create trigger trg_prospects_upd before update on prospects for each row execute function set_updated_at();
create trigger trg_outreach_upd  before update on outreach  for each row execute function set_updated_at();

-- Provider retention: only explicitly marked Hunter-sourced records are eligible.
-- Manually entered records have NULL data_expires_at and are never removed by this function.
create or replace function purge_expired_provider_data() returns void language plpgsql as $$
begin
  delete from decision_makers
    where lower(coalesce(provenance, '')) = 'hunter'
      and data_expires_at is not null and data_expires_at < now();
  delete from prospects
    where lower(coalesce(source, '')) = 'hunter'
      and data_expires_at is not null and data_expires_at < now();
end;
$$;

-- RLS on, no policies: the public/anon key can read nothing. Only the API (service role) accesses data.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop; end $$;


-- ───────────── 8. WORKSPACE COMPATIBILITY FIELDS ─────────────
alter table startups add column ui jsonb not null default '{}';
alter table prospects add column client_ref text;
alter table prospects add column ui jsonb not null default '{}';
alter table prospects add column sync_hash text;
alter table prospects add column sort_order bigint not null default 0;
alter table outreach add column client_ref text;
alter table outreach add column ui jsonb not null default '{}';
alter table outreach add column sync_hash text;
alter table outreach add column sort_order bigint not null default 0;
alter table activities add column client_ref text;
-- Workspace UI statuses are free-text labels (e.g. "Needs review" and "Approved (demo)").
alter table outreach drop constraint if exists outreach_status_check;
create unique index prospects_client_ref_key on prospects(startup_id, client_ref) where client_ref is not null;
create unique index outreach_client_ref_key on outreach(startup_id, client_ref) where client_ref is not null;
create unique index activities_client_ref_key on activities(startup_id, client_ref) where client_ref is not null;
create index prospect_signals_tenant_idx on prospect_signals(startup_id, prospect_id);
create index decision_makers_tenant_idx on decision_makers(startup_id, prospect_id);
