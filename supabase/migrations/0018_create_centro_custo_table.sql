-- Cria tabelas de referência para centros de serviço, setores, cargos e centros de custo,
-- reaproveitando os valores existentes em public.pessoas.

create table if not exists public.centros_servico (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint centros_servico_nome_not_blank check (length(btrim(nome)) > 0),
  constraint centros_servico_nome_unique unique (nome)
);

create index if not exists centros_servico_ordem_idx
  on public.centros_servico (ativo desc, ordem asc, nome asc);

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint setores_nome_not_blank check (length(btrim(nome)) > 0),
  constraint setores_nome_unique unique (nome)
);

create index if not exists setores_ordem_idx
  on public.setores (ativo desc, ordem asc, nome asc);

create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint cargos_nome_not_blank check (length(btrim(nome)) > 0),
  constraint cargos_nome_unique unique (nome)
);

create index if not exists cargos_ordem_idx
  on public.cargos (ativo desc, ordem asc, nome asc);

create table if not exists public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint centros_custo_nome_not_blank check (length(btrim(nome)) > 0),
  constraint centros_custo_nome_unique unique (nome)
);

create index if not exists centros_custo_ordem_idx
  on public.centros_custo (ativo desc, ordem asc, nome asc);

with dados as (
  select distinct on (lower(nullif(trim(p.centro_servico), '')))
    nullif(trim(p.centro_servico), '') as nome
  from public.pessoas p
  where coalesce(trim(p.centro_servico), '') <> ''
),
ordenados as (
  select nome, row_number() over (order by lower(nome))::smallint as ordem
  from dados
)
insert into public.centros_servico (nome, ordem)
select nome, ordem
from ordenados
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

with dados as (
  select distinct on (lower(nullif(trim(p.setor), '')))
    nullif(trim(p.setor), '') as nome
  from public.pessoas p
  where coalesce(trim(p.setor), '') <> ''
),
ordenados as (
  select nome, row_number() over (order by lower(nome))::smallint as ordem
  from dados
)
insert into public.setores (nome, ordem)
select nome, ordem
from ordenados
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

with dados as (
  select distinct on (lower(nullif(trim(p.cargo), '')))
    nullif(trim(p.cargo), '') as nome
  from public.pessoas p
  where coalesce(trim(p.cargo), '') <> ''
),
ordenados as (
  select nome, row_number() over (order by lower(nome))::smallint as ordem
  from dados
)
insert into public.cargos (nome, ordem)
select nome, ordem
from ordenados
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

with dados as (
  select distinct nome, ordem
  from public.centros_servico
)
insert into public.centros_custo (nome, ordem)
select nome, ordem
from dados
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;
