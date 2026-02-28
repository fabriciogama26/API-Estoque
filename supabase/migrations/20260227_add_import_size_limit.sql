-- Limite de tamanho (MB) para importacoes por plano.

alter table if exists public.planos_users
  add column if not exists limit_import_mb integer default 2;

comment on column public.planos_users.limit_import_mb is 'Limite de tamanho (MB) para importacoes por tenant.';
