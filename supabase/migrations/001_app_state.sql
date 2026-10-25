-- Master app data for the Vercel API (api/index.js).
-- One row per app section. data mirrors what backend/data/db.json held;
-- version is bumped on every write so concurrent serverless requests can
-- detect each other (optimistic concurrency).
create table public.app_state (
  key text primary key check (key in ('boards', 'manageclip', 'vacation')),
  data jsonb not null default 'null'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Server-only table: RLS on with no policies, and no grants to the public
-- API roles. Only the secret (service role) key used by the Vercel function
-- can read or write it.
alter table public.app_state enable row level security;
revoke all on table public.app_state from anon, authenticated;

-- 'null' data means "not initialised yet"; the API seeds on first use.
insert into public.app_state (key) values ('boards'), ('manageclip'), ('vacation');
