-- Adiciona coluna de acao para registrar eventos como reset de senha.

alter table public.app_users_credential_history
  add column if not exists action text default 'update';
