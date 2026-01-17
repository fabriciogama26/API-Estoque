-- Limpa policies permissivas/legadas em tabelas tenant e reforca select owner.

-- Remove policies legadas/publicas
drop policy if exists "acidente_historico insert owner" on public.acidente_historico;
drop policy if exists "acidente_historico select owner" on public.acidente_historico;
drop policy if exists "acidente_historico update owner" on public.acidente_historico;
drop policy if exists "acidente_historico delete owner" on public.acidente_historico;
drop policy if exists acidente_historico_insert_authenticated on public.acidente_historico;
drop policy if exists acidente_historico_select_authenticated on public.acidente_historico;
drop policy if exists acidente_historico_write_service_role on public.acidente_historico;

drop policy if exists "centros_custo insert owner" on public.centros_custo;
drop policy if exists "centros_custo select owner" on public.centros_custo;
drop policy if exists "centros_custo update owner" on public.centros_custo;
drop policy if exists "centros_custo delete owner" on public.centros_custo;
drop policy if exists centros_custo_select_anon on public.centros_custo;
drop policy if exists centros_custo_select_authenticated on public.centros_custo;
drop policy if exists centros_custo_write_service_role on public.centros_custo;

drop policy if exists "Enable read access for all users" on public.centros_estoque;
drop policy if exists "centros_estoque insert owner" on public.centros_estoque;
drop policy if exists "centros_estoque select owner" on public.centros_estoque;
drop policy if exists "centros_estoque update owner" on public.centros_estoque;
drop policy if exists "centros_estoque delete owner" on public.centros_estoque;

drop policy if exists "Enable insert for authenticated users only" on public.entrada_historico;
drop policy if exists "Enable read access for all users" on public.entrada_historico;
drop policy if exists "entrada_historico insert owner" on public.entrada_historico;
drop policy if exists "entrada_historico select owner" on public.entrada_historico;
drop policy if exists "entrada_historico update owner" on public.entrada_historico;
drop policy if exists "entrada_historico delete owner" on public.entrada_historico;

drop policy if exists "Enable read access for all users" on public.fabricantes;
drop policy if exists "fabricantes insert owner" on public.fabricantes;
drop policy if exists "fabricantes select owner" on public.fabricantes;
drop policy if exists "fabricantes update owner" on public.fabricantes;
drop policy if exists "fabricantes delete owner" on public.fabricantes;

drop policy if exists hht_mensal_select_authenticated on public.hht_mensal;

drop policy if exists "precos modify" on public.material_price_history;
drop policy if exists "precos modifys insert" on public.material_price_history;
drop policy if exists "precos select" on public.material_price_history;

-- Reforca select owner em tabelas de configuracao tenant (somente authenticated)
drop policy if exists cargos_select_owner on public.cargos;
create policy cargos_select_owner
  on public.cargos
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

drop policy if exists centros_custo_select_owner on public.centros_custo;
create policy centros_custo_select_owner
  on public.centros_custo
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

drop policy if exists centros_estoque_select_owner on public.centros_estoque;
create policy centros_estoque_select_owner
  on public.centros_estoque
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

drop policy if exists centros_servico_select_owner on public.centros_servico;
create policy centros_servico_select_owner
  on public.centros_servico
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

drop policy if exists fabricantes_select_owner on public.fabricantes;
create policy fabricantes_select_owner
  on public.fabricantes
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

drop policy if exists setores_select_owner on public.setores;
create policy setores_select_owner
  on public.setores
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

-- Simplifica policies de insercao/atualizacao (remove dependencias de permissions inexistentes)
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
