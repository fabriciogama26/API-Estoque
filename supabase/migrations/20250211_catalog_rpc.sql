-- RPCs security definer para catalogos (lookup/list) com filtro por owner.

create or replace function public.rpc_catalog_list(p_table text)
returns table (id uuid, nome text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_table text := lower(trim(p_table));
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_col text := 'nome';
  v_owner_table boolean := v_table = any (array[
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes'
  ]);
begin
  if v_table not in (
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'tipo_execucao'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_table = 'centros_estoque' then
    v_col := 'almox';
  end if;

  if v_owner_table and not v_is_master then
    if v_owner is null then
      return;
    end if;
    return query execute format(
      'select id, %I as nome from public.%I where account_owner_id = $1 order by %I',
      v_col,
      v_table,
      v_col
    ) using v_owner;
  end if;

  return query execute format(
    'select id, %I as nome from public.%I order by %I',
    v_col,
    v_table,
    v_col
  );
end;
$$;

revoke all on function public.rpc_catalog_list(text) from public;
grant execute on function public.rpc_catalog_list(text) to authenticated;

create or replace function public.rpc_catalog_resolve(p_table text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_table text := lower(trim(p_table));
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_col text := 'nome';
  v_owner_table boolean := v_table = any (array[
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes'
  ]);
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if v_nome = '' then
    return null;
  end if;

  if v_table not in (
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'tipo_execucao'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_table = 'centros_estoque' then
    v_col := 'almox';
  end if;

  if v_owner_table and not v_is_master then
    if v_owner is null then
      return null;
    end if;

    execute format('select id from public.%I where lower(%I) = lower($1) and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using v_nome, v_owner;
    if v_id is not null then
      return v_id;
    end if;

    execute format('select id from public.%I where %I ilike $1 and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using v_nome, v_owner;
    if v_id is not null then
      return v_id;
    end if;

    execute format('select id from public.%I where %I ilike $1 and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using '%' || v_nome || '%', v_owner;
    return v_id;
  end if;

  execute format('select id from public.%I where lower(%I) = lower($1) limit 1', v_table, v_col)
    into v_id
    using v_nome;
  if v_id is not null then
    return v_id;
  end if;

  execute format('select id from public.%I where %I ilike $1 limit 1', v_table, v_col)
    into v_id
    using v_nome;
  if v_id is not null then
    return v_id;
  end if;

  execute format('select id from public.%I where %I ilike $1 limit 1', v_table, v_col)
    into v_id
    using '%' || v_nome || '%';
  return v_id;
end;
$$;

revoke all on function public.rpc_catalog_resolve(text, text) from public;
grant execute on function public.rpc_catalog_resolve(text, text) to authenticated;

create or replace function public.rpc_centro_servico_centro_custo(p_centro_servico_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_id uuid;
begin
  if p_centro_servico_id is null then
    return null;
  end if;

  if v_is_master then
    select centro_custo_id
      into v_id
      from public.centros_servico
     where id = p_centro_servico_id
     limit 1;
    return v_id;
  end if;

  if v_owner is null then
    return null;
  end if;

  select centro_custo_id
    into v_id
    from public.centros_servico
   where id = p_centro_servico_id
     and account_owner_id = v_owner
   limit 1;
  return v_id;
end;
$$;

revoke all on function public.rpc_centro_servico_centro_custo(uuid) from public;
grant execute on function public.rpc_centro_servico_centro_custo(uuid) to authenticated;
