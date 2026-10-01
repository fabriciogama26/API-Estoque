-- Impede que o perfil master misture catalogos operacionais de tenants.
-- Telas de operacao sempre seguem current_account_owner_id().

create or replace function public.rpc_catalog_list(p_table text)
returns table (id uuid, nome text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_table text := lower(trim(p_table));
  v_caller_id uuid := auth.uid();
  v_owner uuid := public.current_account_owner_id();
  v_col text := 'nome';
  v_owner_table boolean := v_table = any (array[
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'acidente_locais'
  ]);
begin
  if v_table not in (
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'acidente_locais',
    'tipo_execucao'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_caller_id is null then
    raise exception 'Nao autenticado.';
  end if;

  if v_table = 'centros_estoque' then
    v_col := 'almox';
  end if;
  if v_table = 'fabricantes' then
    v_col := 'fabricante';
  end if;

  if v_owner_table then
    if v_owner is null then
      raise exception 'Owner nao identificado para usuario %.', v_caller_id;
    end if;

    return query execute format(
      'select id, %I as nome from public.%I where account_owner_id = $1 and coalesce(ativo, true) = true order by %I',
      v_col,
      v_table,
      v_col
    ) using v_owner;
  end if;

  return query execute format(
    'select id, %I as nome from public.%I where coalesce(ativo, true) = true order by %I',
    v_col,
    v_table,
    v_col
  );
end;
$$;

revoke all on function public.rpc_catalog_list(text) from public;
grant execute on function public.rpc_catalog_list(text) to authenticated;

create or replace function public.rpc_stock_correction_material_options()
returns table (id uuid, descricao text, material_item_nome text)
language sql stable security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select v.id, v.descricao, v."materialItemNome"
    from public.materiais_view v
    join public.materiais m on m.id = v.id
   where m.account_owner_id = public.current_account_owner_id()
     and coalesce(m.ativo, true) = true
   order by v."materialItemNome", v.descricao;
$$;

revoke all on function public.rpc_stock_correction_material_options() from public, anon;
grant execute on function public.rpc_stock_correction_material_options() to authenticated;

drop policy if exists stock_correction_requests_select on public.stock_correction_requests;
create policy stock_correction_requests_select on public.stock_correction_requests for select to authenticated
using (account_owner_id = public.current_account_owner_id() and
 (public.has_permission('estoque.correcao.read') or public.has_permission('estoque.correcao.solicitar') or public.has_permission('estoque.correcao.aprovar') or public.is_master()));

drop policy if exists stock_adjustments_select on public.stock_adjustments;
create policy stock_adjustments_select on public.stock_adjustments for select to authenticated
using (account_owner_id = public.current_account_owner_id() and
 (public.has_permission('estoque.correcao.read') or public.has_permission('estoque.read') or public.is_master()));
