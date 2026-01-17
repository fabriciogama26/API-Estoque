-- RPCs full para HHT mensal (create/update) evitando RLS em joins.

create or replace function public.rpc_hht_mensal_create_full(
  p_mes_ref date,
  p_centro_servico_id uuid,
  p_status_hht_id uuid default null,
  p_qtd_pessoas integer default 0,
  p_horas_mes_base numeric default 0,
  p_escala_factor numeric default 1,
  p_horas_afastamento numeric default 0,
  p_horas_ferias numeric default 0,
  p_horas_treinamento numeric default 0,
  p_horas_outros_descontos numeric default 0,
  p_horas_extras numeric default 0,
  p_modo text default 'simples',
  p_hht_informado numeric default null
) returns setof public.hht_mensal
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('hht.write'::text);
  v_status uuid;
  v_id uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := auth.uid();
  end if;

  if p_mes_ref is null then
    raise exception 'mes_ref_required' using errcode = 'P0001';
  end if;

  if p_centro_servico_id is null then
    raise exception 'centro_servico_required' using errcode = 'P0001';
  end if;

  if p_status_hht_id is null then
    select id into v_status
      from public.status_hht
     where lower(status) = 'ativo'
     limit 1;
  else
    v_status := p_status_hht_id;
  end if;

  if v_status is null then
    raise exception 'status_hht_required' using errcode = 'P0001';
  end if;

  insert into public.hht_mensal (
    mes_ref,
    centro_servico_id,
    status_hht_id,
    qtd_pessoas,
    horas_mes_base,
    escala_factor,
    horas_afastamento,
    horas_ferias,
    horas_treinamento,
    horas_outros_descontos,
    horas_extras,
    modo,
    hht_informado,
    created_by,
    updated_by,
    account_owner_id
  ) values (
    p_mes_ref,
    p_centro_servico_id,
    v_status,
    coalesce(p_qtd_pessoas, 0),
    coalesce(p_horas_mes_base, 0),
    coalesce(p_escala_factor, 1),
    coalesce(p_horas_afastamento, 0),
    coalesce(p_horas_ferias, 0),
    coalesce(p_horas_treinamento, 0),
    coalesce(p_horas_outros_descontos, 0),
    coalesce(p_horas_extras, 0),
    coalesce(p_modo, 'simples'),
    p_hht_informado,
    auth.uid(),
    auth.uid(),
    v_owner
  )
  returning id into v_id;

  return query
    select *
      from public.hht_mensal h
     where h.id = v_id
       and (v_is_master or h.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_hht_mensal_create_full(
  date,
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) from public;

grant execute on function public.rpc_hht_mensal_create_full(
  date,
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) to authenticated;

create or replace function public.rpc_hht_mensal_update_full(
  p_id uuid,
  p_mes_ref date default null,
  p_centro_servico_id uuid default null,
  p_status_hht_id uuid default null,
  p_qtd_pessoas integer default null,
  p_horas_mes_base numeric default null,
  p_escala_factor numeric default null,
  p_horas_afastamento numeric default null,
  p_horas_ferias numeric default null,
  p_horas_treinamento numeric default null,
  p_horas_outros_descontos numeric default null,
  p_horas_extras numeric default null,
  p_modo text default null,
  p_hht_informado numeric default null
) returns setof public.hht_mensal
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('hht.write'::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.hht_mensal
   where id = p_id;

  if v_row_owner is null then
    raise exception 'hht_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.hht_mensal
     set mes_ref = coalesce(p_mes_ref, mes_ref),
         centro_servico_id = coalesce(p_centro_servico_id, centro_servico_id),
         status_hht_id = coalesce(p_status_hht_id, status_hht_id),
         qtd_pessoas = coalesce(p_qtd_pessoas, qtd_pessoas),
         horas_mes_base = coalesce(p_horas_mes_base, horas_mes_base),
         escala_factor = coalesce(p_escala_factor, escala_factor),
         horas_afastamento = coalesce(p_horas_afastamento, horas_afastamento),
         horas_ferias = coalesce(p_horas_ferias, horas_ferias),
         horas_treinamento = coalesce(p_horas_treinamento, horas_treinamento),
         horas_outros_descontos = coalesce(p_horas_outros_descontos, horas_outros_descontos),
         horas_extras = coalesce(p_horas_extras, horas_extras),
         modo = coalesce(p_modo, modo),
         hht_informado = coalesce(p_hht_informado, hht_informado),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_id;

  return query
    select *
      from public.hht_mensal h
     where h.id = p_id
       and (v_is_master or h.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_hht_mensal_update_full(
  uuid,
  date,
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) from public;

grant execute on function public.rpc_hht_mensal_update_full(
  uuid,
  date,
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) to authenticated;
