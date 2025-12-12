-- Cria a tabela de planos por usuário para registrar assinaturas e limites.
create table if not exists public.planos_users (
  id uuid not null default gen_random_uuid(),
  planos character varying null,
  description text null,
  price numeric null,
  billing_period character varying null,
  max_clients integer null,
  max_orders integer null,
  max_users integer null,
  features json null,
  is_active boolean null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint planos_users_pkey primary key (id)
);
