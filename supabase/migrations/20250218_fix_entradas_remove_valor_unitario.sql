-- Remove valorUnitario from entradas RPCs (coluna nao existe na tabela).

drop function if exists public.rpc_entradas_create_full(
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  numeric,
  uuid
);

create or replace function public.rpc_entradas_create_full(
  p_material_id uuid,
  p_quantidade numeric,
  p_centro_estoque uuid,
  p_data_entrada timestamptz,
  p_status uuid default null,
  p_usuario_id uuid default null
) returns setof public.entradas
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('entradas.write'::text);
  v_id uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  if p_status is null then
    insert into public.entradas (
      "materialId",
      quantidade,
      centro_estoque,
      "dataEntrada",
      "usuarioResponsavel",
      account_owner_id
    ) values (
      p_material_id,
      p_quantidade,
      p_centro_estoque,
      p_data_entrada,
      v_user,
      v_owner
    ) returning id into v_id;
  else
    insert into public.entradas (
      "materialId",
      quantidade,
      centro_estoque,
      "dataEntrada",
      status,
      "usuarioResponsavel",
      account_owner_id
    ) values (
      p_material_id,
      p_quantidade,
      p_centro_estoque,
      p_data_entrada,
      p_status,
      v_user,
      v_owner
    ) returning id into v_id;
  end if;

  return query
    select *
      from public.entradas e
     where e.id = v_id
       and (v_is_master or e.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_entradas_create_full(
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  uuid
) from public;

grant execute on function public.rpc_entradas_create_full(
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  uuid
) to authenticated;

drop function if exists public.rpc_entradas_update_full(
  uuid,
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  numeric,
  uuid
);

create or replace function public.rpc_entradas_update_full(
  p_id uuid,
  p_material_id uuid,
  p_quantidade numeric,
  p_centro_estoque uuid,
  p_data_entrada timestamptz,
  p_status uuid,
  p_usuario_id uuid default null
) returns setof public.entradas
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('entradas.write'::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.entradas
   where id = p_id;

  if v_row_owner is null then
    raise exception 'entrada_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.entradas
     set "materialId" = p_material_id,
         quantidade = p_quantidade,
         centro_estoque = p_centro_estoque,
         "dataEntrada" = p_data_entrada,
         status = p_status,
         "usuarioEdicao" = v_user,
         "atualizadoEm" = now()
   where id = p_id;

  return query
    select *
      from public.entradas e
     where e.id = p_id
       and (v_is_master or e.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_entradas_update_full(
  uuid,
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  uuid
) from public;

grant execute on function public.rpc_entradas_update_full(
  uuid,
  uuid,
  numeric,
  uuid,
  timestamptz,
  uuid,
  uuid
) to authenticated;
