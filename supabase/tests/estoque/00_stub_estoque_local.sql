-- Stub das tabelas de estoque para validar o saldo unico em um PostgreSQL local e descartavel
-- (NUNCA executar no projeto Supabase real). Roda depois de supabase/tests/validades/00_stub_supabase_local.sql,
-- que cria roles, auth.uid(), app_users, RBAC, is_master() e has_permission().
--
-- Reproduz so as colunas usadas por 20260930_stock_physical_corrections.sql e 20261003_estoque_saldo_unico.sql.

alter table public.permissions add column if not exists updated_at timestamptz default now();

create table if not exists public.grupos_material_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null
);

create table if not exists public.fabricantes (
  id uuid primary key default gen_random_uuid(),
  fabricante text not null
);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text,
  fabricante text,
  descricao text,
  "grupoMaterial" text,
  "valorUnitario" numeric default 0,
  "estoqueMinimo" integer,
  ativo boolean default true,
  account_owner_id uuid not null references public.app_users(id)
);

create table if not exists public.centros_estoque (
  id uuid primary key default gen_random_uuid(),
  almox text not null,
  ativo boolean default true,
  created_at timestamptz default now(),
  account_owner_id uuid not null references public.app_users(id)
);

create table if not exists public.status_entrada (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  ativo boolean default true
);

create table if not exists public.status_saida (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  ativo boolean default true
);

create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  "materialId" uuid not null references public.materiais(id),
  quantidade numeric not null check (quantidade > 0),
  "dataEntrada" timestamptz not null,
  centro_estoque uuid not null references public.centros_estoque(id),
  status uuid references public.status_entrada(id),
  create_at timestamptz default now(),
  account_owner_id uuid not null references public.app_users(id)
);

create table if not exists public.saidas (
  id uuid primary key default gen_random_uuid(),
  "materialId" uuid not null references public.materiais(id),
  "pessoaId" uuid,
  quantidade numeric not null check (quantidade > 0),
  "dataEntrega" timestamptz not null,
  centro_estoque uuid references public.centros_estoque(id),
  centro_custo uuid,
  centro_servico uuid,
  "usuarioResponsavel" uuid,
  "dataTroca" timestamptz,
  status uuid not null references public.status_saida(id),
  "criadoEm" timestamptz default now(),
  account_owner_id uuid not null references public.app_users(id)
);

create table if not exists public.inventory_material_override (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null,
  material_id uuid not null,
  minimo numeric,
  maximo numeric,
  motivo text,
  inicio_em timestamptz default now(),
  expira_em timestamptz,
  revogado_em timestamptz
);

-- Previsao (forecast) usada pelo orcamento anual (20260801_purchase_budget_*).
create table if not exists public.inventory_forecast (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id),
  periodo_base_inicio date not null,
  periodo_base_fim date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.f_previsao_gasto_mensal (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null,
  inventory_forecast_id uuid not null,
  ano_mes date not null,
  cenario text not null default 'base',
  valor_previsto numeric not null default 0
);

-- Placeholder: em producao a funcao ja existia antes de 20260930, que cria o trigger e depois a recria.
create or replace function public.validar_saldo_saida()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

-- Politica padrao fixa (a real le inventory_policy com fallback para estes valores).
create or replace function public.inventory_policy_effective(p_owner_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'modo', 'monitorar',
    'cobertura_minima_meses', 1,
    'cobertura_alvo_meses', 2,
    'cobertura_excesso_meses', 6,
    'divergencia_tolerancia_pct', 30,
    'janela_sem_consumo_dias', 90
  );
$$;
