-- Cria tabela de histórico para pessoas e migra dados existentes do campo JSON.

create table if not exists public.pessoas_historico (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  data_edicao timestamptz not null default now(),
  usuario_responsavel text not null default 'sistema',
  campos_alterados jsonb not null default '[]'::jsonb
);

create index if not exists pessoas_historico_pessoa_idx
  on public.pessoas_historico (pessoa_id, data_edicao desc);

-- Migra o conteúdo existente do array historicoEdicao (camelCase ou snake_case) para a nova tabela.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pessoas'
      and column_name = 'historicoEdicao'
  ) then
    insert into public.pessoas_historico (pessoa_id, data_edicao, usuario_responsavel, campos_alterados)
    select
      p.id as pessoa_id,
      coalesce(nullif(item->>'dataEdicao', '')::timestamptz, now()) as data_edicao,
      coalesce(nullif(item->>'usuarioResponsavel', ''), 'sistema') as usuario_responsavel,
      coalesce(item->'camposAlterados', '[]'::jsonb) as campos_alterados
    from public.pessoas p
    cross join lateral jsonb_array_elements(coalesce(p."historicoEdicao", '[]'::jsonb)) as item
    on conflict do nothing;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pessoas'
      and column_name = 'historico_edicao'
  ) then
    insert into public.pessoas_historico (pessoa_id, data_edicao, usuario_responsavel, campos_alterados)
    select
      p.id as pessoa_id,
      coalesce(nullif(item->>'dataEdicao', '')::timestamptz, now()) as data_edicao,
      coalesce(nullif(item->>'usuarioResponsavel', ''), 'sistema') as usuario_responsavel,
      coalesce(item->'camposAlterados', '[]'::jsonb) as campos_alterados
    from public.pessoas p
    cross join lateral jsonb_array_elements(coalesce(p.historico_edicao, '[]'::jsonb)) as item
    on conflict do nothing;
  end if;
end
$$;

-- Remove coluna antiga de histórico (tanto camelCase quanto snake_case, se existente).
alter table if exists public.pessoas
  drop column if exists "historicoEdicao",
  drop column if exists historico_edicao;

-- Habilita RLS na nova tabela e cria políticas alinhadas às demais tabelas de referência.
alter table if exists public.pessoas_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pessoas_historico'
      and policyname = 'pessoas_historico_select_authenticated'
  ) then
    create policy pessoas_historico_select_authenticated on public.pessoas_historico
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pessoas_historico'
      and policyname = 'pessoas_historico_insert_authenticated'
  ) then
    create policy pessoas_historico_insert_authenticated on public.pessoas_historico
      for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pessoas_historico'
      and policyname = 'pessoas_historico_write_service_role'
  ) then
    create policy pessoas_historico_write_service_role on public.pessoas_historico
      for all to service_role using (true) with check (true);
  end if;
end
$$;
