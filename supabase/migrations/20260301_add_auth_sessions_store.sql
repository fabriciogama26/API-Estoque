-- Cria tabela de sessoes server-side para auth via cookie HttpOnly.

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_owner_id uuid not null references public.app_users (id) on delete restrict,
  access_token text not null,
  refresh_token text not null,
  access_expires_at timestamptz not null,
  last_refresh_at timestamptz,
  ip_hash text,
  ua_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists auth_sessions_session_id_uidx
  on public.auth_sessions (session_id);

create index if not exists auth_sessions_user_id_idx
  on public.auth_sessions (user_id);

create index if not exists auth_sessions_owner_id_idx
  on public.auth_sessions (account_owner_id);

comment on table public.auth_sessions is 'Sessao server-side (cookie HttpOnly). Tokens nao ficam no frontend.';

-- Atualiza updated_at automaticamente.
drop trigger if exists auth_sessions_set_updated_at on public.auth_sessions;
create trigger auth_sessions_set_updated_at
  before update on public.auth_sessions
  for each row
  execute function public.set_current_timestamp_updated_at();

-- RLS: somente service_role.
alter table public.auth_sessions enable row level security;
alter table public.auth_sessions force row level security;

drop policy if exists "auth_sessions service role" on public.auth_sessions;
create policy "auth_sessions service role" on public.auth_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
