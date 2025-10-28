-- Cria tabela de histórico para acidentes e migra dados existentes do campo JSON.

create table if not exists public.acidente_historico (
  id uuid primary key default gen_random_uuid(),
  acidente_id uuid not null references public.acidentes(id) on delete cascade,
  data_edicao timestamptz not null default now(),
  usuario_responsavel text not null default 'sistema',
  campos_alterados jsonb not null default '[]'::jsonb
);

create index if not exists acidente_historico_acidente_idx
  on public.acidente_historico (acidente_id, data_edicao desc);

-- Migra o conteúdo existente do array historicoEdicao (camelCase ou snake_case) para a nova tabela.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'acidentes'
      and column_name = 'historicoEdicao'
  ) then
    insert into public.acidente_historico (acidente_id, data_edicao, usuario_responsavel, campos_alterados)
    select
      a.id as acidente_id,
      coalesce(nullif(item->>'dataEdicao', '')::timestamptz, now()) as data_edicao,
      coalesce(nullif(item->>'usuarioResponsavel', ''), 'sistema') as usuario_responsavel,
      coalesce(item->'camposAlterados', '[]'::jsonb) as campos_alterados
    from public.acidentes a
    cross join lateral jsonb_array_elements(coalesce(a."historicoEdicao", '[]'::jsonb)) as item
    on conflict do nothing;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'acidentes'
      and column_name = 'historico_edicao'
  ) then
    insert into public.acidente_historico (acidente_id, data_edicao, usuario_responsavel, campos_alterados)
    select
      a.id as acidente_id,
      coalesce(nullif(item->>'dataEdicao', '')::timestamptz, now()) as data_edicao,
      coalesce(nullif(item->>'usuarioResponsavel', ''), 'sistema') as usuario_responsavel,
      coalesce(item->'camposAlterados', '[]'::jsonb) as campos_alterados
    from public.acidentes a
    cross join lateral jsonb_array_elements(coalesce(a.historico_edicao, '[]'::jsonb)) as item
    on conflict do nothing;
  end if;
end
$$;

-- Remove coluna antiga de histórico (tanto camelCase quanto snake_case, se existente).
alter table if exists public.acidentes
  drop column if exists "historicoEdicao",
  drop column if exists historico_edicao;

-- Habilita RLS na nova tabela e cria políticas alinhadas às demais tabelas de referência.
alter table if exists public.acidente_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'acidente_historico'
      and policyname = 'acidente_historico_select_authenticated'
  ) then
    create policy acidente_historico_select_authenticated on public.acidente_historico
      for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'acidente_historico'
      and policyname = 'acidente_historico_insert_authenticated'
  ) then
    create policy acidente_historico_insert_authenticated on public.acidente_historico
      for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'acidente_historico'
      and policyname = 'acidente_historico_write_service_role'
  ) then
    create policy acidente_historico_write_service_role on public.acidente_historico
      for all to service_role using (true) with check (true);
  end if;
end
$$;
