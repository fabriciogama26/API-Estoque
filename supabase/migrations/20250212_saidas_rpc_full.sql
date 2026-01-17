-- RPCs full para Saidas (create/update) evitando RLS no insert.

create or replace function public.rpc_saidas_create_full(
  p_pessoa_id uuid,
  p_material_id uuid,
  p_quantidade numeric,
  p_centro_estoque uuid,
  p_centro_custo uuid,
  p_centro_servico uuid,
  p_data_entrega timestamptz,
  p_status uuid,
  p_usuario_id uuid default null,
  p_is_troca boolean default false,
  p_troca_de_saida uuid default null,
  p_troca_sequencia integer default null
) returns setof public.saidas
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_id uuid;
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('estoque.saidas'::text);
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

  insert into public.saidas (
    "pessoaId",
    "materialId",
    quantidade,
    centro_estoque,
    centro_custo,
    centro_servico,
    "dataEntrega",
    status,
    "usuarioResponsavel",
    "isTroca",
    "trocaDeSaida",
    "trocaSequencia",
    account_owner_id
  ) values (
    p_pessoa_id,
    p_material_id,
    p_quantidade,
    p_centro_estoque,
    p_centro_custo,
    p_centro_servico,
    p_data_entrega,
    p_status,
    v_user,
    coalesce(p_is_troca, false),
    p_troca_de_saida,
    p_troca_sequencia,
    v_owner
  ) returning id into v_id;

  return query
    select *
      from public.saidas s
     where s.id = v_id
       and (v_is_master or s.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_saidas_create_full(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) from public;

grant execute on function public.rpc_saidas_create_full(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) to authenticated;

create or replace function public.rpc_saidas_update_full(
  p_id uuid,
  p_pessoa_id uuid,
  p_material_id uuid,
  p_quantidade numeric,
  p_centro_estoque uuid,
  p_centro_custo uuid,
  p_centro_servico uuid,
  p_data_entrega timestamptz,
  p_status uuid,
  p_usuario_id uuid default null,
  p_is_troca boolean default null,
  p_troca_de_saida uuid default null,
  p_troca_sequencia integer default null
) returns setof public.saidas
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_row_owner uuid;
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('estoque.saidas'::text);
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.saidas
   where id = p_id;

  if v_row_owner is null then
    raise exception 'saida_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.saidas
     set "pessoaId" = p_pessoa_id,
         "materialId" = p_material_id,
         quantidade = p_quantidade,
         centro_estoque = p_centro_estoque,
         centro_custo = p_centro_custo,
         centro_servico = p_centro_servico,
         "dataEntrega" = p_data_entrega,
         status = p_status,
         "usuarioEdicao" = v_user,
         "atualizadoEm" = now(),
         "isTroca" = coalesce(p_is_troca, "isTroca"),
         "trocaDeSaida" = coalesce(p_troca_de_saida, "trocaDeSaida"),
         "trocaSequencia" = coalesce(p_troca_sequencia, "trocaSequencia")
   where id = p_id;

  return query
    select *
      from public.saidas s
     where s.id = p_id
       and (v_is_master or s.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_saidas_update_full(
  uuid,
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) from public;

grant execute on function public.rpc_saidas_update_full(
  uuid,
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) to authenticated;
