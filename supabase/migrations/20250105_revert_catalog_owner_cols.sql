-- Reverte a adicao indevida de account_owner_id em catalogos globais
-- e desabilita RLS neles. Mantem logs apenas com RLS de master (sem coluna owner).

set check_function_bodies = off;

-- Tabelas de catalogo (visiveis por todos): remover account_owner_id e RLS.
do $$
declare
  rec record;
begin
  -- Lista de tabelas de catalogo/lookup que nao devem ter isolamento por owner.
  for rec in (
    select unnest(array[
    'public.acidente_agentes',
    'public.acidente_lesoes',
    'public.acidente_locais',
    'public.acidente_partes',
    'public.acidente_partes_grupo',
    'public.acidente_partes_sub_grupo',
    'public.acidente_tipos',
    'public.epi_classe',
    'public.medidas_calcado',
    'public.medidas_vestimentas'
  ]::text[]) as tbl
  ) loop
    -- pula se a tabela nao existir no schema
    if exists (
      select 1 from pg_tables
      where schemaname = split_part(rec.tbl, '.', 1)
        and tablename = split_part(rec.tbl, '.', 2)
    ) then
      execute format('alter table %I disable row level security', rec.tbl);
      execute format('alter table %I no force row level security', rec.tbl);
      -- Drop possiveis policies geradas pelo helper anterior.
      execute format('drop policy if exists %I on %I', rec.tbl || '_owner_select', rec.tbl);
      execute format('drop policy if exists %I on %I', rec.tbl || '_owner_ins', rec.tbl);
      execute format('drop policy if exists %I on %I', rec.tbl || '_owner_upd', rec.tbl);
      execute format('drop policy if exists %I on %I', rec.tbl || '_owner_del', rec.tbl);
      -- Remove coluna account_owner_id se foi criada.
      execute format('alter table %I drop column if exists account_owner_id', rec.tbl);
    end if;
  end loop;
end$$;

-- Logs: manter RLS master-only (migration 20250104_logs_catalogs_rls já cria políticas).
-- Remover account_owner_id se adicionada, sem mexer nas policies de master.
alter table if exists public.api_errors drop column if exists account_owner_id;
alter table if exists public.app_errors drop column if exists account_owner_id;
