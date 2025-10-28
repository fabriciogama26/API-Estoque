-- Ajustes complementares para vincular pessoas às tabelas de referência
-- (executar após 0019 e 0020 quando o banco remoto já estava com schema antigo).

-- Garante existencia das tabelas de dominio.
create table if not exists public.tipo_execucao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint tipo_execucao_nome_not_blank check (length(btrim(nome)) > 0),
  constraint tipo_execucao_nome_unique unique (nome)
);

insert into public.tipo_execucao (nome, ordem)
values
  ('PROPRIO', 1),
  ('TERCEIROS', 2)
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- Adiciona colunas ID em pessoas caso ainda não existam.
alter table if exists public.pessoas
  add column if not exists centro_servico_id uuid,
  add column if not exists setor_id uuid,
  add column if not exists cargo_id uuid,
  add column if not exists centro_custo_id uuid,
  add column if not exists tipo_execucao_id uuid;

-- Popular IDs com base nas colunas legadas.
update public.pessoas p
set centro_servico_id = cs.id
from public.centros_servico cs
where p.centro_servico_id is null
  and cs.nome is not null
  and lower(cs.nome) = lower(trim(p.centro_servico));

update public.pessoas p
set setor_id = st.id
from public.setores st
where p.setor_id is null
  and st.nome is not null
  and lower(st.nome) = lower(trim(p.setor));

update public.pessoas p
set cargo_id = cg.id
from public.cargos cg
where p.cargo_id is null
  and cg.nome is not null
  and lower(cg.nome) = lower(trim(p.cargo));

update public.pessoas p
set centro_custo_id = cc.id
from public.centros_custo cc
where p.centro_custo_id is null
  and cc.nome is not null
  and lower(cc.nome) = lower(trim(p.centro_servico));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pessoas'
      and column_name = 'tipoexecucao'
  ) then
    update public.pessoas p
    set tipo_execucao_id = te.id
    from public.tipo_execucao te
    where p.tipo_execucao_id is null
      and te.nome is not null
      and lower(te.nome) = lower(trim(p.tipoExecucao));
  end if;
end
$$;

-- Linhas sem tipo_execucao recebem padrao PROPRIO.
update public.pessoas
set tipo_execucao_id = (
  select id from public.tipo_execucao where nome = 'PROPRIO' limit 1
)
where tipo_execucao_id is null;

-- Campo setor vazio herda centro de serviço.
update public.pessoas
set setor = centro_servico
where coalesce(trim(setor), '') = ''
  and coalesce(trim(centro_servico), '') <> '';

update public.pessoas p
set setor_id = st.id
from public.setores st
where p.setor_id is null
  and st.nome is not null
  and lower(st.nome) = lower(trim(p.setor));

-- Impõe not null.
alter table if exists public.pessoas
  alter column centro_servico_id set not null,
  alter column setor_id set not null,
  alter column cargo_id set not null,
  alter column centro_custo_id set not null,
  alter column tipo_execucao_id set not null;

-- Adiciona FKs somente se ainda não existirem.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'pessoas' and constraint_name = 'pessoas_centro_servico_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_centro_servico_fk foreign key (centro_servico_id) references public.centros_servico(id);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'pessoas' and constraint_name = 'pessoas_setor_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_setor_fk foreign key (setor_id) references public.setores(id);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'pessoas' and constraint_name = 'pessoas_cargo_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_cargo_fk foreign key (cargo_id) references public.cargos(id);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'pessoas' and constraint_name = 'pessoas_centro_custo_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_centro_custo_fk foreign key (centro_custo_id) references public.centros_custo(id);
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'pessoas' and constraint_name = 'pessoas_tipo_execucao_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_tipo_execucao_fk foreign key (tipo_execucao_id) references public.tipo_execucao(id);
  end if;
end;
$$;

create index if not exists pessoas_centro_servico_id_idx on public.pessoas (centro_servico_id);
create index if not exists pessoas_setor_id_idx on public.pessoas (setor_id);
create index if not exists pessoas_cargo_id_idx on public.pessoas (cargo_id);
create index if not exists pessoas_centro_custo_id_idx on public.pessoas (centro_custo_id);
create index if not exists pessoas_tipo_execucao_id_idx on public.pessoas (tipo_execucao_id);

-- Atualiza função/trigger de sincronização.
create or replace function public._ensure_item(nome_input text, tabela text)
returns uuid
language plpgsql
as $$
declare
  nome_limpo text := trim(coalesce(nome_input, ''));
  registro_id uuid;
  ordem_proxima smallint;
begin
  if nome_limpo = '' then
    raise exception 'Valor nao pode ser vazio.';
  end if;

  execute format('select id from %I where lower(nome) = lower($1) limit 1', tabela)
    into registro_id
    using nome_limpo;

  if registro_id is not null then
    return registro_id;
  end if;

  execute format('select coalesce(max(ordem), 0) + 1 from %I', tabela)
    into ordem_proxima;

  execute format('insert into %I (nome, ordem, ativo) values ($1, $2, true) returning id', tabela)
    into registro_id
    using nome_limpo, ordem_proxima;

  return registro_id;
end;
$$;

create or replace function public.sync_pessoas_referencias()
returns trigger
language plpgsql
as $$
declare
  centro_nome text;
  setor_nome text;
  cargo_nome text;
  tipo_execucao_nome text;
begin
  centro_nome := trim(coalesce(new.centro_servico, ''));
  if centro_nome = '' then
    raise exception 'Centro de servico obrigatorio.';
  end if;
  new.centro_servico := centro_nome;
  new.centro_servico_id := public._ensure_item(centro_nome, 'centros_servico');

  setor_nome := trim(coalesce(new.setor, ''));
  if setor_nome = '' then
    setor_nome := centro_nome;
    new.setor := setor_nome;
  end if;
  new.setor_id := public._ensure_item(setor_nome, 'setores');

  cargo_nome := trim(coalesce(new.cargo, ''));
  if cargo_nome = '' then
    raise exception 'Cargo obrigatorio.';
  end if;
  new.cargo := cargo_nome;
  new.cargo_id := public._ensure_item(cargo_nome, 'cargos');

  new.centro_custo_id := public._ensure_item(centro_nome, 'centros_custo');

  tipo_execucao_nome := upper(trim(coalesce(new.tipoExecucao, '')));
  if tipo_execucao_nome = '' then
    raise exception 'Tipo de execucao obrigatorio.';
  end if;
  new.tipoExecucao := tipo_execucao_nome;
  new.tipo_execucao_id := public._ensure_item(tipo_execucao_nome, 'tipo_execucao');

  return new;
end;
$$;

drop trigger if exists trg_pessoas_sync_referencias on public.pessoas;
create trigger trg_pessoas_sync_referencias
before insert or update on public.pessoas
for each row
execute function public.sync_pessoas_referencias();

-- RLS e políticas (cria se não existir).
alter table if exists public.centros_servico enable row level security;
alter table if exists public.setores enable row level security;
alter table if exists public.cargos enable row level security;
alter table if exists public.centros_custo enable row level security;
alter table if exists public.tipo_execucao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_servico' and policyname = 'centros_servico_select_authenticated'
  ) then
    create policy centros_servico_select_authenticated on public.centros_servico
      for select to authenticated using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_servico' and policyname = 'centros_servico_select_anon'
  ) then
    create policy centros_servico_select_anon on public.centros_servico
      for select to anon using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_servico' and policyname = 'centros_servico_write_service_role'
  ) then
    create policy centros_servico_write_service_role on public.centros_servico
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'setores' and policyname = 'setores_select_authenticated'
  ) then
    create policy setores_select_authenticated on public.setores
      for select to authenticated using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'setores' and policyname = 'setores_select_anon'
  ) then
    create policy setores_select_anon on public.setores
      for select to anon using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'setores' and policyname = 'setores_write_service_role'
  ) then
    create policy setores_write_service_role on public.setores
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cargos' and policyname = 'cargos_select_authenticated'
  ) then
    create policy cargos_select_authenticated on public.cargos
      for select to authenticated using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cargos' and policyname = 'cargos_select_anon'
  ) then
    create policy cargos_select_anon on public.cargos
      for select to anon using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cargos' and policyname = 'cargos_write_service_role'
  ) then
    create policy cargos_write_service_role on public.cargos
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_custo' and policyname = 'centros_custo_select_authenticated'
  ) then
    create policy centros_custo_select_authenticated on public.centros_custo
      for select to authenticated using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_custo' and policyname = 'centros_custo_select_anon'
  ) then
    create policy centros_custo_select_anon on public.centros_custo
      for select to anon using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'centros_custo' and policyname = 'centros_custo_write_service_role'
  ) then
    create policy centros_custo_write_service_role on public.centros_custo
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tipo_execucao' and policyname = 'tipo_execucao_select_authenticated'
  ) then
    create policy tipo_execucao_select_authenticated on public.tipo_execucao
      for select to authenticated using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tipo_execucao' and policyname = 'tipo_execucao_select_anon'
  ) then
    create policy tipo_execucao_select_anon on public.tipo_execucao
      for select to anon using (ativo is true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tipo_execucao' and policyname = 'tipo_execucao_write_service_role'
  ) then
    create policy tipo_execucao_write_service_role on public.tipo_execucao
      for all to service_role using (true) with check (true);
  end if;
end;
$$;

-- Remove colunas legadas (se ainda existirem).
alter table if exists public.pessoas
  drop column if exists centro_servico,
  drop column if exists setor,
  drop column if exists cargo,
  drop column if exists tipoExecucao;
