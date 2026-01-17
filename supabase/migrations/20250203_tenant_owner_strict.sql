-- Enforce tenant isolation for all tables with account_owner_id.
-- - Remove permissive NULL-owner checks in RLS
-- - Require account_owner_id (NOT NULL + default my_owner_id())
-- - Stop migration if legacy NULL owners exist

-- 1) Hard stop if any table has NULL owners (must be fixed manually)
DO $$
DECLARE
  v_tables text[] := ARRAY[
    'acidente_historico',
    'acidentes',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'centros_servico',
    'entrada_historico',
    'entradas',
    'fabricantes',
    'hht_mensal',
    'hht_mensal_hist',
    'materiais',
    'material_price_history',
    'pessoas',
    'pessoas_historico',
    'saidas',
    'saidas_historico',
    'setores'
  ];
  v_table text;
  v_count bigint;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('select count(*) from public.%I where account_owner_id is null', v_table)
      INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Tabela % possui % registros sem account_owner_id. Corrija antes de aplicar NOT NULL.', v_table, v_count;
    END IF;
  END LOOP;
END $$;

-- 2) Defaults + NOT NULL
ALTER TABLE public.acidente_historico ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.acidente_historico ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.acidentes ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.acidentes ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.cargos ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.cargos ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.centros_custo ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.centros_custo ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.centros_estoque ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.centros_estoque ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.centros_servico ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.centros_servico ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.entrada_historico ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.entrada_historico ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.entradas ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.entradas ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.fabricantes ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.fabricantes ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.hht_mensal ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.hht_mensal ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.hht_mensal_hist ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.hht_mensal_hist ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.materiais ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.materiais ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.material_price_history ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.material_price_history ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.pessoas ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.pessoas ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.pessoas_historico ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.pessoas_historico ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.saidas ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.saidas ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.saidas_historico ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.saidas_historico ALTER COLUMN account_owner_id SET NOT NULL;

ALTER TABLE public.setores ALTER COLUMN account_owner_id SET DEFAULT public.my_owner_id();
ALTER TABLE public.setores ALTER COLUMN account_owner_id SET NOT NULL;

-- 3) RLS (strict owner, no NULL owner exceptions)

-- Pessoas
drop policy if exists pessoas_select_owner on public.pessoas;
create policy pessoas_select_owner
  on public.pessoas
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists pessoas_insert_owner on public.pessoas;
create policy pessoas_insert_owner
  on public.pessoas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('pessoas.write'::text)
  );

drop policy if exists pessoas_update_owner on public.pessoas;
create policy pessoas_update_owner
  on public.pessoas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('pessoas.write'::text)
  );

-- Historico pessoas
drop policy if exists pessoas_historico_select_owner on public.pessoas_historico;
create policy pessoas_historico_select_owner
  on public.pessoas_historico
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists pessoas_historico_insert_owner on public.pessoas_historico;
create policy pessoas_historico_insert_owner
  on public.pessoas_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Acidentes
drop policy if exists acidentes_select_owner on public.acidentes;
create policy acidentes_select_owner
  on public.acidentes
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists acidentes_insert_owner on public.acidentes;
create policy acidentes_insert_owner
  on public.acidentes
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('acidentes.write'::text)
  );

drop policy if exists acidentes_update_owner on public.acidentes;
create policy acidentes_update_owner
  on public.acidentes
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('acidentes.write'::text)
  );

-- Historico acidentes
drop policy if exists acidente_hist_select_owner on public.acidente_historico;
create policy acidente_hist_select_owner
  on public.acidente_historico
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists acidente_hist_insert_owner on public.acidente_historico;
create policy acidente_hist_insert_owner
  on public.acidente_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- HHT mensal
drop policy if exists hht_mensal_select_owner on public.hht_mensal;
create policy hht_mensal_select_owner
  on public.hht_mensal
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists hht_mensal_insert_owner on public.hht_mensal;
create policy hht_mensal_insert_owner
  on public.hht_mensal
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('hht.write'::text)
  );

drop policy if exists hht_mensal_update_owner on public.hht_mensal;
create policy hht_mensal_update_owner
  on public.hht_mensal
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('hht.write'::text)
  );

-- Historico HHT
drop policy if exists hht_hist_select_owner on public.hht_mensal_hist;
create policy hht_hist_select_owner
  on public.hht_mensal_hist
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists hht_hist_insert_owner on public.hht_mensal_hist;
create policy hht_hist_insert_owner
  on public.hht_mensal_hist
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Entradas
drop policy if exists entradas_select_owner on public.entradas;
create policy entradas_select_owner
  on public.entradas
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists entradas_insert_owner on public.entradas;
create policy entradas_insert_owner
  on public.entradas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

drop policy if exists entradas_update_owner on public.entradas;
create policy entradas_update_owner
  on public.entradas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

-- Historico entradas
drop policy if exists entrada_hist_select_owner on public.entrada_historico;
create policy entrada_hist_select_owner
  on public.entrada_historico
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists entrada_hist_insert_owner on public.entrada_historico;
create policy entrada_hist_insert_owner
  on public.entrada_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Materiais
drop policy if exists materiais_select_owner on public.materiais;
create policy materiais_select_owner
  on public.materiais
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists materiais_insert_owner on public.materiais;
create policy materiais_insert_owner
  on public.materiais
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  );

drop policy if exists materiais_update_owner on public.materiais;
create policy materiais_update_owner
  on public.materiais
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  );

-- Historico preco material
drop policy if exists mat_price_hist_select_owner on public.material_price_history;
create policy mat_price_hist_select_owner
  on public.material_price_history
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists mat_price_hist_insert_owner on public.material_price_history;
create policy mat_price_hist_insert_owner
  on public.material_price_history
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Saidas
drop policy if exists saidas_select_owner on public.saidas;
create policy saidas_select_owner
  on public.saidas
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists saidas_insert_owner on public.saidas;
create policy saidas_insert_owner
  on public.saidas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );

drop policy if exists saidas_update_owner on public.saidas;
create policy saidas_update_owner
  on public.saidas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );

-- Historico saidas
drop policy if exists saidas_hist_select_owner on public.saidas_historico;
create policy saidas_hist_select_owner
  on public.saidas_historico
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists saidas_hist_insert_owner on public.saidas_historico;
create policy saidas_hist_insert_owner
  on public.saidas_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Tabelas de configuracao (tenant, sem permissao extra)
alter table if exists public.cargos enable row level security;
drop policy if exists cargos_select_owner on public.cargos;
create policy cargos_select_owner
  on public.cargos
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists cargos_insert_owner on public.cargos;
create policy cargos_insert_owner
  on public.cargos
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists cargos_update_owner on public.cargos;
create policy cargos_update_owner
  on public.cargos
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists cargos_delete_owner on public.cargos;
create policy cargos_delete_owner
  on public.cargos
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

alter table if exists public.centros_custo enable row level security;
drop policy if exists centros_custo_select_owner on public.centros_custo;
create policy centros_custo_select_owner
  on public.centros_custo
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_custo_insert_owner on public.centros_custo;
create policy centros_custo_insert_owner
  on public.centros_custo
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_custo_update_owner on public.centros_custo;
create policy centros_custo_update_owner
  on public.centros_custo
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_custo_delete_owner on public.centros_custo;
create policy centros_custo_delete_owner
  on public.centros_custo
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

alter table if exists public.centros_estoque enable row level security;
drop policy if exists centros_estoque_select_owner on public.centros_estoque;
create policy centros_estoque_select_owner
  on public.centros_estoque
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_estoque_insert_owner on public.centros_estoque;
create policy centros_estoque_insert_owner
  on public.centros_estoque
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_estoque_update_owner on public.centros_estoque;
create policy centros_estoque_update_owner
  on public.centros_estoque
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_estoque_delete_owner on public.centros_estoque;
create policy centros_estoque_delete_owner
  on public.centros_estoque
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

alter table if exists public.centros_servico enable row level security;
drop policy if exists centros_servico_select_owner on public.centros_servico;
create policy centros_servico_select_owner
  on public.centros_servico
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_servico_insert_owner on public.centros_servico;
create policy centros_servico_insert_owner
  on public.centros_servico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_servico_update_owner on public.centros_servico;
create policy centros_servico_update_owner
  on public.centros_servico
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_servico_delete_owner on public.centros_servico;
create policy centros_servico_delete_owner
  on public.centros_servico
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

alter table if exists public.fabricantes enable row level security;
drop policy if exists fabricantes_select_owner on public.fabricantes;
create policy fabricantes_select_owner
  on public.fabricantes
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists fabricantes_insert_owner on public.fabricantes;
create policy fabricantes_insert_owner
  on public.fabricantes
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists fabricantes_update_owner on public.fabricantes;
create policy fabricantes_update_owner
  on public.fabricantes
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists fabricantes_delete_owner on public.fabricantes;
create policy fabricantes_delete_owner
  on public.fabricantes
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

alter table if exists public.setores enable row level security;
drop policy if exists setores_select_owner on public.setores;
create policy setores_select_owner
  on public.setores
  for select
  to anon, authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists setores_insert_owner on public.setores;
create policy setores_insert_owner
  on public.setores
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists setores_update_owner on public.setores;
create policy setores_update_owner
  on public.setores
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists setores_delete_owner on public.setores;
create policy setores_delete_owner
  on public.setores
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());
