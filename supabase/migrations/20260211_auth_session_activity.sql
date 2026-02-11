-- Controle de sessoes autenticadas (timebox + idle).

create table if not exists public.auth_session_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_owner_id uuid null references public.app_users(id) on delete set null,
  session_id text not null,
  last_seen_at timestamptz null,
  last_reauth_at timestamptz null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  ip_hash text null,
  ua_hash text null
);

comment on table public.auth_session_activity is 'Controle de sessoes autenticadas (timebox, idle, revogacao).';

create unique index if not exists auth_session_activity_user_session_uidx
  on public.auth_session_activity (user_id, session_id);

create index if not exists auth_session_activity_owner_idx
  on public.auth_session_activity (account_owner_id);

create index if not exists auth_session_activity_last_seen_idx
  on public.auth_session_activity (last_seen_at);

create index if not exists auth_session_activity_expires_idx
  on public.auth_session_activity (expires_at);

create index if not exists auth_session_activity_revoked_idx
  on public.auth_session_activity (revoked_at);

alter table public.auth_session_activity enable row level security;
alter table public.auth_session_activity force row level security;

drop policy if exists auth_session_activity_service_role on public.auth_session_activity;
create policy auth_session_activity_service_role on public.auth_session_activity
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
