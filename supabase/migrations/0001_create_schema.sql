-- supabase/migrations/0001_create_schema.sql
-- Cria as tabelas principais usadas pelo backend API Estoque.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  username text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fabricante text not null,
  validade_dias integer not null check (validade_dias > 0),
  ca text,
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  ativo boolean not null default true,
  usuario_cadastro text not null default 'sistema',
  data_cadastro timestamptz not null default now()
);

create unique index if not exists materiais_nome_fabricante_idx
  on public.materiais (lower(nome), lower(fabricante));

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text,
  local text not null,
  cargo text not null,
  usuario_cadastro text not null default 'sistema',
  criado_em timestamptz not null default now()
);

create table if not exists public.precos_historico (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete cascade,
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  data_registro timestamptz not null default now(),
  usuario_responsavel text not null default 'sistema'
);

create index if not exists precos_material_idx on public.precos_historico(material_id, data_registro desc);

create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  data_entrada timestamptz not null default now(),
  usuario_responsavel text
);

create index if not exists entradas_material_idx on public.entradas(material_id, data_entrada desc);

create table if not exists public.saidas (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete restrict,
  pessoa_id uuid not null references public.pessoas(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  data_entrega timestamptz not null default now(),
  data_troca timestamptz,
  status text not null default 'entregue',
  usuario_responsavel text
);

create index if not exists saidas_material_idx on public.saidas(material_id, data_entrega desc);
create index if not exists saidas_pessoa_idx on public.saidas(pessoa_id, data_entrega desc);

