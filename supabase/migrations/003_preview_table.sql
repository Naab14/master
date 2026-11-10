-- A separate table for Vercel preview deployments, so trying out a branch
-- never reads or changes the real data in app_state. Same shape and the same
-- lock-down: only the server's secret key can reach it.
create table if not exists public.app_state_preview (
  key text primary key check (key in ('boards', 'manageclip', 'vacation', 'workforce', 'attendance', 'admin', 'sketches')),
  data jsonb not null default 'null'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.app_state_preview enable row level security;
revoke all on table public.app_state_preview from anon, authenticated;
