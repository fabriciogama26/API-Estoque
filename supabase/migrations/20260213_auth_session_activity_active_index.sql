-- Permite historico de sessoes e garante apenas uma sessao ativa por user/session_id.

drop index if exists public.auth_session_activity_user_session_uidx;

create unique index if not exists auth_session_activity_user_session_active_uidx
  on public.auth_session_activity (user_id, session_id)
  where revoked_at is null;
