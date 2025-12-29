-- Garante integridade das colunas account_owner_id (FK para app_users.id)
-- e reforça que tabelas de catálogo globais fiquem sem account_owner_id e sem RLS de owner.

set check_function_bodies = off;

-- 1) Adiciona FK account_owner_id -> app_users.id em todas as tabelas que possuem a coluna (schema public).
do $$
declare
  r record;
  c_name text;
begin
  perform set_config('row_security', 'off', true);

  for r in
    select table_schema, table_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name = 'account_owner_id'
  loop
    c_name := r.table_name || '_account_owner_id_fkey';
    if not exists (
      select 1
        from information_schema.table_constraints tc
       where tc.table_schema = r.table_schema
         and tc.table_name   = r.table_name
         and tc.constraint_name = c_name
    ) then
      execute format(
        'alter table %I.%I add constraint %I foreign key (account_owner_id) references public.app_users(id)',
        r.table_schema, r.table_name, c_name
      );
    end if;
  end loop;
end$$;

-- 2) Tabelas de catálogo globais: remover account_owner_id (se existir) e aplicar RLS permitindo SELECT a authenticated e bloqueando INSERT/UPDATE/DELETE.
do $$
declare
  rec record;
  s text;
  t text;
begin
  for rec in (
    select unnest(array[
      'public.caracteristica_epi',
      'public.acidente_tipos',
      'public.acidente_partes_sub_grupo',
      'public.acidente_partes_grupo',
      'public.acidente_partes',
      'public.cor',
      'public.epi_classe',
      'public.grupos_material',
      'public.grupos_material_itens',
      'public.acidente_locais',
      'public.acidente_lesoes',
      'public.acidente_agentes',
      'public.material_grupo_caracteristica_epi',
      'public.material_grupo_cor',
      'public.medidas_calcado',
      'public.medidas_vestimentas',
      'public.roles',
      'public.status_entrada',
      'public.status_hht',
      'public.status_saida'
    ]::text[]) as tbl
  ) loop
    s := split_part(rec.tbl, '.', 1);
    t := split_part(rec.tbl, '.', 2);

    if exists (
      select 1 from pg_tables
       where schemaname = s
         and tablename = t
    ) then
      execute format('alter table %I.%I enable row level security', s, t);
      execute format('alter table %I.%I force row level security', s, t);
      -- Remove coluna account_owner_id se ainda existir.
      execute format('alter table %I.%I drop column if exists account_owner_id', s, t);
      -- Policies: SELECT liberado a authenticated; INSERT/UPDATE/DELETE bloqueados.
      execute format('drop policy if exists %I on %I.%I', t || '_owner_select', s, t);
      execute format('drop policy if exists %I on %I.%I', t || '_owner_ins', s, t);
      execute format('drop policy if exists %I on %I.%I', t || '_owner_upd', s, t);
      execute format('drop policy if exists %I on %I.%I', t || '_owner_del', s, t);
      execute format('create policy %I on %I.%I for select to authenticated using (true)', t || '_public_select', s, t);
      execute format('create policy %I on %I.%I for insert with check (false)', t || '_no_insert', s, t);
      execute format('create policy %I on %I.%I for update using (false) with check (false)', t || '_no_update', s, t);
      execute format('create policy %I on %I.%I for delete using (false)', t || '_no_delete', s, t);
    end if;
  end loop;
end$$;
