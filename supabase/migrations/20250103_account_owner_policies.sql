-- RLS por account_owner_id para tabelas de negocio.
-- Requer funcoes: current_account_owner_id() e is_master() ja criadas em migrations anteriores.

set check_function_bodies = off;

-- Helper: verifica se a tabela tem coluna account_owner_id.
create or replace function public._table_has_owner_col(p_table regclass)
returns boolean
language sql
as $$
  select exists (
    select 1
      from information_schema.columns c
     where c.table_schema = split_part(p_table::text, '.', 1)
       and c.table_name   = split_part(p_table::text, '.', 2)
       and c.column_name  = 'account_owner_id'
  );
$$;

-- Helper para criar policies padrao de owner (select/ins/upd/del) apenas se a coluna existir.
create or replace function public._apply_owner_policies(p_table regclass)
returns void
language plpgsql
as $$
begin
  if not public._table_has_owner_col(p_table) then
    return;
  end if;

  execute format('alter table %s enable row level security', p_table);
  execute format('alter table %s force row level security', p_table);

  execute format('drop policy if exists %I_owner_select on %s', p_table::text || '_owner', p_table);
  execute format('create policy %I_owner_select on %s for select using (account_owner_id = public.current_account_owner_id() or public.is_master())', p_table::text || '_owner', p_table);

  execute format('drop policy if exists %I_owner_insert on %s', p_table::text || '_owner_ins', p_table);
  execute format('create policy %I_owner_insert on %s for insert with check (account_owner_id = public.current_account_owner_id())', p_table::text || '_owner_ins', p_table);

  execute format('drop policy if exists %I_owner_update on %s', p_table::text || '_owner_upd', p_table);
  execute format('create policy %I_owner_update on %s for update using (account_owner_id = public.current_account_owner_id() or public.is_master()) with check (account_owner_id = public.current_account_owner_id() or public.is_master())', p_table::text || '_owner_upd', p_table);

  execute format('drop policy if exists %I_owner_delete on %s', p_table::text || '_owner_del', p_table);
  execute format('create policy %I_owner_delete on %s for delete using (account_owner_id = public.current_account_owner_id() or public.is_master())', p_table::text || '_owner_del', p_table);
end;
$$;

revoke all on function public._apply_owner_policies(regclass) from public;
grant execute on function public._apply_owner_policies(regclass) to authenticated;
revoke all on function public._table_has_owner_col(regclass) from public;
grant execute on function public._table_has_owner_col(regclass) to authenticated;

-- Aplica o padrao nas tabelas com account_owner_id (conforme dump fornecido).
do $$
begin
  perform public._apply_owner_policies('public.acidente_historico');
  perform public._apply_owner_policies('public.acidentes');
  perform public._apply_owner_policies('public.caracteristica_epi');
  perform public._apply_owner_policies('public.cargos');
  perform public._apply_owner_policies('public.centros_custo');
  perform public._apply_owner_policies('public.centros_estoque');
  perform public._apply_owner_policies('public.centros_servico');
  perform public._apply_owner_policies('public.cor');
  perform public._apply_owner_policies('public.entrada_historico');
  perform public._apply_owner_policies('public.entradas');
  perform public._apply_owner_policies('public.fabricantes');
  perform public._apply_owner_policies('public.grupos_material');
  perform public._apply_owner_policies('public.grupos_material_itens');
  perform public._apply_owner_policies('public.hht_mensal');
  perform public._apply_owner_policies('public.hht_mensal_hist');
  perform public._apply_owner_policies('public.materiais');
  perform public._apply_owner_policies('public.material_grupo_caracteristica_epi');
  perform public._apply_owner_policies('public.material_grupo_cor');
  perform public._apply_owner_policies('public.material_price_history');
  perform public._apply_owner_policies('public.pessoas');
  perform public._apply_owner_policies('public.pessoas_historico');
  perform public._apply_owner_policies('public.saidas');
  perform public._apply_owner_policies('public.saidas_historico');
  perform public._apply_owner_policies('public.setores');
  perform public._apply_owner_policies('public.status_entrada');
  perform public._apply_owner_policies('public.status_hht');
  perform public._apply_owner_policies('public.status_saida');
  perform public._apply_owner_policies('public.tipo_execucao');
end$$;

-- Remova helpers se nao quiser manter no schema.
drop function if exists public._apply_owner_policies(regclass);
drop function if exists public._table_has_owner_col(regclass);
