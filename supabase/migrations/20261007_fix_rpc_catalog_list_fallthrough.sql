-- Encerra o ramo owner-scoped de rpc_catalog_list para impedir que a consulta
-- global seja executada depois do RETURN QUERY. Em PL/pgSQL, RETURN QUERY
-- acrescenta linhas ao resultado, mas nao encerra a funcao.

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

    return;
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
