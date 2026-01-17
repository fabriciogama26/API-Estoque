-- Garante SELECT sem filtro de ativo para tabelas de referencia tenant.

drop policy if exists centros_servico_select_owner on public.centros_servico;
create policy centros_servico_select_owner
  on public.centros_servico
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists setores_select_owner on public.setores;
create policy setores_select_owner
  on public.setores
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists cargos_select_owner on public.cargos;
create policy cargos_select_owner
  on public.cargos
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_custo_select_owner on public.centros_custo;
create policy centros_custo_select_owner
  on public.centros_custo
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists centros_estoque_select_owner on public.centros_estoque;
create policy centros_estoque_select_owner
  on public.centros_estoque
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

drop policy if exists fabricantes_select_owner on public.fabricantes;
create policy fabricantes_select_owner
  on public.fabricantes
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());
