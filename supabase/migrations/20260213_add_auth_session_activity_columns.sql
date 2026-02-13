-- Ajusta colunas faltantes na tabela de controle de sessoes.

alter table public.auth_session_activity
  add column if not exists last_reauth_at timestamptz null,
  add column if not exists revoked_at timestamptz null,
  add column if not exists ip_hash text null,
  add column if not exists ua_hash text null;

create index if not exists auth_session_activity_revoked_idx
  on public.auth_session_activity (revoked_at);
