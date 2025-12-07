-- Adiciona colunas de status (ativo) no historico de credenciais.

alter table public.app_users_credential_history
  add column if not exists before_active boolean,
  add column if not exists after_active boolean;
