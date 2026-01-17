-- Corrige nomes de colunas com caixa (registradoPor/atualizadoPor/atualizadoEm).

create or replace function public.rpc_acidentes_create_full(
  p_matricula text,
  p_nome text,
  p_cargo text,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_tipo text,
  p_agente text,
  p_cid text,
  p_centro_servico text,
  p_local text,
  p_cat text,
  p_observacao text,
  p_partes_lesionadas text[],
  p_lesoes text[],
  p_data_esocial timestamptz default null,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_hht numeric default null,
  p_registrado_por text default null
) returns setof public.acidentes
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_registrado text := coalesce(nullif(trim(p_registrado_por), ''), auth.uid()::text);
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

  insert into public.acidentes (
    matricula,
    nome,
    cargo,
    data,
    "diasPerdidos",
    "diasDebitados",
    tipo,
    agente,
    cid,
    centro_servico,
    local,
    cat,
    observacao,
    partes_lesionadas,
    lesoes,
    data_esocial,
    sesmt,
    data_sesmt,
    hht,
    "registradoPor",
    account_owner_id
  ) values (
    p_matricula,
    p_nome,
    p_cargo,
    p_data,
    coalesce(p_dias_perdidos, 0),
    coalesce(p_dias_debitados, 0),
    p_tipo,
    p_agente,
    p_cid,
    p_centro_servico,
    p_local,
    p_cat,
    p_observacao,
    coalesce(p_partes_lesionadas, '{}'::text[]),
    coalesce(p_lesoes, '{}'::text[]),
    p_data_esocial,
    coalesce(p_sesmt, false),
    p_data_sesmt,
    p_hht,
    v_registrado,
    v_owner
  ) returning id into v_id;

  return query
    select *
      from public.acidentes a
     where a.id = v_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_acidentes_create_full(
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text
) from public;

grant execute on function public.rpc_acidentes_create_full(
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text
) to authenticated;

create or replace function public.rpc_acidentes_update_full(
  p_id uuid,
  p_matricula text,
  p_nome text,
  p_cargo text,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_tipo text,
  p_agente text,
  p_cid text,
  p_centro_servico text,
  p_local text,
  p_cat text,
  p_observacao text,
  p_partes_lesionadas text[],
  p_lesoes text[],
  p_data_esocial timestamptz default null,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_hht numeric default null,
  p_atualizado_por text default null,
  p_campos_alterados jsonb default '[]'::jsonb
) returns setof public.acidentes
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_atualizado text := coalesce(nullif(trim(p_atualizado_por), ''), auth.uid()::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.acidentes
   where id = p_id;

  if v_row_owner is null then
    raise exception 'acidente_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.acidentes
     set matricula = p_matricula,
         nome = p_nome,
         cargo = p_cargo,
         data = p_data,
         "diasPerdidos" = coalesce(p_dias_perdidos, 0),
         "diasDebitados" = coalesce(p_dias_debitados, 0),
         tipo = p_tipo,
         agente = p_agente,
         cid = p_cid,
         centro_servico = p_centro_servico,
         local = p_local,
         cat = p_cat,
         observacao = p_observacao,
         partes_lesionadas = coalesce(p_partes_lesionadas, '{}'::text[]),
         lesoes = coalesce(p_lesoes, '{}'::text[]),
         data_esocial = p_data_esocial,
         sesmt = coalesce(p_sesmt, false),
         data_sesmt = p_data_sesmt,
         hht = p_hht,
         "atualizadoPor" = v_atualizado,
         "atualizadoEm" = now()
   where id = p_id;

  if p_campos_alterados is not null
     and jsonb_typeof(p_campos_alterados) = 'array'
     and jsonb_array_length(p_campos_alterados) > 0 then
    insert into public.acidente_historico (
      acidente_id,
      data_edicao,
      usuario_responsavel,
      campos_alterados,
      account_owner_id
    ) values (
      p_id,
      now(),
      v_atualizado,
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select *
      from public.acidentes a
     where a.id = p_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_acidentes_update_full(
  uuid,
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text,
  jsonb
) from public;

grant execute on function public.rpc_acidentes_update_full(
  uuid,
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text,
  jsonb
) to authenticated;
