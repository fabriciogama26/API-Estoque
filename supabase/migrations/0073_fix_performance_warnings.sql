-- Corrige avisos do linter: limpa indices duplicados gerados por _fkcov*, cria indice faltante de FK,
-- e consolida policies permissivas duplicadas em app_credentials_catalog.

-- 1) Remove indices _fkcov* redundantes (mesmo prefixo de colunas de outro indice valido).
do $$
declare
  r record;
begin
  for r in (
    select
      n.nspname as schemaname,
      ic.relname as idxname
    from pg_index fkcov
    join pg_class ic on ic.oid = fkcov.indexrelid
    join pg_namespace n on n.oid = ic.relnamespace
    join pg_index base
      on base.indrelid = fkcov.indrelid
     and base.indexrelid <> fkcov.indexrelid
     and (base.indkey::int2[])[1:base.indnatts] = (fkcov.indkey::int2[])[1:fkcov.indnatts]
     and base.indisvalid
     and base.indisready
    where ic.relname like '%_fkcov%'
  )
  loop
    execute format('drop index if exists %I.%I;', r.schemaname, r.idxname);
  end loop;
end
$$;

-- 2) Indice que faltava para FK app_users_credential_fkey.
create index if not exists app_users_credential_fkey_idx
  on public.app_users (credential);

-- 3) Consolida policies permissivas duplicadas em app_credentials_catalog.
do $$
declare
  delete_policy record;
begin
  -- Drop todas as policies existentes para garantir limpeza.
  for delete_policy in
    select format('drop policy if exists %I on public.app_credentials_catalog;', policyname) as sql
    from pg_policies
    where schemaname = 'public' and tablename = 'app_credentials_catalog'
  loop
    execute delete_policy.sql;
  end loop;

  -- Politica unica de leitura para authenticated (ajuste aqui se quiser outros roles).
  create policy "app_credentials_catalog select" on public.app_credentials_catalog
    for select
    to authenticated
    using (true);

  -- Politica para service_role (bypassa RLS).
  create policy "app_credentials_catalog service role" on public.app_credentials_catalog
    for all
    to service_role
    using (true)
    with check (true);
end
$$;
