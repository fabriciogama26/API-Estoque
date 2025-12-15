-- Garante coluna action no historico de credenciais.

alter table if exists public.app_users_credential_history
  add column if not exists action text default 'update';

comment on column public.app_users_credential_history.action is 'Tipo da acao (ex.: update, password_reset).';
