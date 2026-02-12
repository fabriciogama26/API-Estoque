-- Permite CID duplicado e cria update com recalculo de import_hash.
drop index if exists public.accidents_unique_cid_per_owner;

create or replace function public.rpc_acidentes_create_full(
  p_pessoa_id uuid,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_cid text,
  p_centro_servico_id uuid,
  p_local_id uuid,
  p_cat text,
  p_observacao text,
  p_agentes_ids uuid[] default null,
  p_tipos_ids uuid[] default null,
  p_lesoes_ids uuid[] default null,
  p_partes_ids uuid[] default null,
  p_data_esocial timestamptz default null,
  p_esocial boolean default false,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_registrado_por text default null,
  p_import_hash text default null
) returns setof public.accidents
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_id uuid;
  v_registrado_uuid uuid;
  v_agente_count int;
  v_tipo_count int;
  v_lesao_count int;
  v_invalid boolean;
  v_cat text;
  v_cid text;
  v_import_hash text;
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

  begin
    v_registrado_uuid := nullif(trim(p_registrado_por), '')::uuid;
  exception
    when invalid_text_representation then
      v_registrado_uuid := null;
  end;
  if v_registrado_uuid is null then
    v_registrado_uuid := auth.uid();
  end if;

  v_cat := nullif(btrim(p_cat), '');
  v_cid := nullif(btrim(p_cid), '');
  v_import_hash := nullif(btrim(p_import_hash), '');

  if v_cat is not null then
    select exists(
      select 1
        from public.accidents a
       where a.account_owner_id = v_owner
         and lower(btrim(a.cat_number)) = lower(v_cat)
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_cat_duplicate' using errcode = 'P0001';
    end if;
  end if;

  if v_import_hash is not null then
    select exists(
      select 1
        from public.accidents a
       where a.account_owner_id = v_owner
         and a.import_hash = v_import_hash
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_import_duplicate' using errcode = 'P0001';
    end if;
  end if;

  v_agente_count := coalesce(array_length(p_agentes_ids, 1), 0);
  v_tipo_count := coalesce(array_length(p_tipos_ids, 1), 0);
  v_lesao_count := coalesce(array_length(p_lesoes_ids, 1), 0);

  if v_agente_count = 0 then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;
  if v_tipo_count = 0 and v_lesao_count = 0 then
    raise exception 'acidente_tipos_lesoes_required' using errcode = 'P0001';
  end if;
  if v_tipo_count > v_agente_count or v_lesao_count > v_agente_count then
    raise exception 'acidente_agentes_mismatch' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
     where a.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
      left join public.acidente_agentes aa on aa.id = a.id
     where a.id is not null and aa.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agentes_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
      left join public.acidente_tipos at on at.id = t.id and at.agente_id = a.id
     where t.id is not null and at.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_tipos_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
      left join public.acidente_lesoes al on al.id = l.id and al.agente_id = a.id
     where l.id is not null and al.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_lesoes_invalidas' using errcode = 'P0001';
  end if;

  if p_partes_ids is not null then
    select exists(
      select 1
        from unnest(p_partes_ids) as p(id)
        left join public.acidente_partes ap on ap.id = p.id
       where p.id is not null and ap.id is null
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_partes_invalidas' using errcode = 'P0001';
    end if;
  end if;

  insert into public.accidents (
    people_id,
    accident_date,
    lost_days,
    debited_days,
    cid_code,
    service_center,
    location_name,
    cat_number,
    notes,
    esocial_date,
    esocial_involved,
    sesmt_involved,
    sesmt_date,
    created_by_username,
    account_owner_id,
    is_active,
    import_hash,
    cancel_reason
  ) values (
    p_pessoa_id,
    p_data,
    coalesce(p_dias_perdidos, 0)::smallint,
    coalesce(p_dias_debitados, 0)::smallint,
    v_cid,
    p_centro_servico_id,
    p_local_id,
    v_cat,
    nullif(trim(p_observacao), ''),
    p_data_esocial,
    coalesce(p_esocial, false),
    coalesce(p_sesmt, false),
    p_data_sesmt,
    v_registrado_uuid,
    v_owner,
    true,
    v_import_hash,
    null
  ) returning id into v_id;

  insert into public.accident_group_agents (
    accident_id,
    accident_agents_id,
    accident_type_id,
    accident_injuries_id,
    account_owner_id
  )
  select
    v_id,
    a.id,
    t.id,
    l.id,
    v_owner
  from unnest(p_agentes_ids) with ordinality as a(id, ord)
  left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
  left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
  where a.id is not null;

  if p_partes_ids is not null and array_length(p_partes_ids, 1) > 0 then
    insert into public.accident_group_parts (
      accident_id,
      accident_parts_id,
      account_owner_id
    )
    select v_id, p.id, v_owner
      from unnest(p_partes_ids) with ordinality as p(id, ord)
     where p.id is not null;
  end if;

  return query
    select *
      from public.accidents a
     where a.id = v_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

grant execute on function public.rpc_acidentes_create_full(
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text,
  text
) to authenticated;

create or replace function public.rpc_acidentes_update_full(
  p_id uuid,
  p_pessoa_id uuid,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_cid text,
  p_centro_servico_id uuid,
  p_local_id uuid,
  p_cat text,
  p_observacao text,
  p_agentes_ids uuid[] default null,
  p_tipos_ids uuid[] default null,
  p_lesoes_ids uuid[] default null,
  p_partes_ids uuid[] default null,
  p_data_esocial timestamptz default null,
  p_esocial boolean default false,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_atualizado_por text default null,
  p_campos_alterados jsonb default '[]'::jsonb,
  p_import_hash text default null
) returns setof public.accidents
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_atualizado_uuid uuid;
  v_row_owner uuid;
  v_row_pessoa uuid;
  v_agente_count int;
  v_tipo_count int;
  v_lesao_count int;
  v_invalid boolean;
  v_cat text;
  v_cid text;
  v_import_hash text;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id, people_id into v_row_owner, v_row_pessoa
    from public.accidents
   where id = p_id;

  if v_row_owner is null then
    raise exception 'acidente_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_pessoa_id is null or v_row_pessoa is null or p_pessoa_id <> v_row_pessoa then
    raise exception 'acidente_pessoa_locked' using errcode = 'P0001';
  end if;

  begin
    v_atualizado_uuid := nullif(trim(p_atualizado_por), '')::uuid;
  exception
    when invalid_text_representation then
      v_atualizado_uuid := null;
  end;
  if v_atualizado_uuid is null then
    v_atualizado_uuid := auth.uid();
  end if;

  v_cat := nullif(btrim(p_cat), '');
  v_cid := nullif(btrim(p_cid), '');
  v_import_hash := nullif(btrim(p_import_hash), '');

  if v_cat is not null then
    select exists(
      select 1
        from public.accidents a
       where a.account_owner_id = v_row_owner
         and a.id <> p_id
         and lower(btrim(a.cat_number)) = lower(v_cat)
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_cat_duplicate' using errcode = 'P0001';
    end if;
  end if;

  if v_import_hash is not null then
    select exists(
      select 1
        from public.accidents a
       where a.account_owner_id = v_row_owner
         and a.id <> p_id
         and a.import_hash = v_import_hash
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_import_duplicate' using errcode = 'P0001';
    end if;
  end if;

  v_agente_count := coalesce(array_length(p_agentes_ids, 1), 0);
  v_tipo_count := coalesce(array_length(p_tipos_ids, 1), 0);
  v_lesao_count := coalesce(array_length(p_lesoes_ids, 1), 0);

  if v_agente_count = 0 then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;
  if v_tipo_count = 0 and v_lesao_count = 0 then
    raise exception 'acidente_tipos_lesoes_required' using errcode = 'P0001';
  end if;
  if v_tipo_count > v_agente_count or v_lesao_count > v_agente_count then
    raise exception 'acidente_agentes_mismatch' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
     where a.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
      left join public.acidente_agentes aa on aa.id = a.id
     where a.id is not null and aa.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agentes_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
      left join public.acidente_tipos at on at.id = t.id and at.agente_id = a.id
     where t.id is not null and at.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_tipos_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
      left join public.acidente_lesoes al on al.id = l.id and al.agente_id = a.id
     where l.id is not null and al.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_lesoes_invalidas' using errcode = 'P0001';
  end if;

  if p_partes_ids is not null then
    select exists(
      select 1
        from unnest(p_partes_ids) as p(id)
        left join public.acidente_partes ap on ap.id = p.id
       where p.id is not null and ap.id is null
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_partes_invalidas' using errcode = 'P0001';
    end if;
  end if;

  update public.accidents
     set people_id = p_pessoa_id,
         accident_date = p_data,
         lost_days = coalesce(p_dias_perdidos, 0)::smallint,
         debited_days = coalesce(p_dias_debitados, 0)::smallint,
         cid_code = v_cid,
         service_center = p_centro_servico_id,
         location_name = p_local_id,
         cat_number = v_cat,
         notes = nullif(trim(p_observacao), ''),
         import_hash = coalesce(v_import_hash, import_hash),
         esocial_date = p_data_esocial,
         esocial_involved = coalesce(p_esocial, false),
         sesmt_involved = coalesce(p_sesmt, false),
         sesmt_date = p_data_sesmt,
         updated_by_username = v_atualizado_uuid,
         updated_at = now()
   where id = p_id;

  delete from public.accident_group_agents where accident_id = p_id;
  insert into public.accident_group_agents (
    accident_id,
    accident_agents_id,
    accident_type_id,
    accident_injuries_id,
    account_owner_id
  )
  select
    p_id,
    a.id,
    t.id,
    l.id,
    v_row_owner
  from unnest(p_agentes_ids) with ordinality as a(id, ord)
  left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
  left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
  where a.id is not null;

  delete from public.accident_group_parts where accident_id = p_id;
  if p_partes_ids is not null and array_length(p_partes_ids, 1) > 0 then
    insert into public.accident_group_parts (
      accident_id,
      accident_parts_id,
      account_owner_id
    )
    select p_id, p.id, v_row_owner
      from unnest(p_partes_ids) with ordinality as p(id, ord)
     where p.id is not null;
  end if;

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
      coalesce(nullif(trim(p_atualizado_por), ''), auth.uid()::text),
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select *
      from public.accidents a
     where a.id = p_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

grant execute on function public.rpc_acidentes_update_full(
  uuid,
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text,
  jsonb,
  text
) to authenticated;

create or replace function public.rpc_acidentes_update_full_rehash(
  p_id uuid,
  p_pessoa_id uuid,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_cid text,
  p_centro_servico_id uuid,
  p_local_id uuid,
  p_cat text,
  p_observacao text,
  p_agentes_ids uuid[] default null,
  p_tipos_ids uuid[] default null,
  p_lesoes_ids uuid[] default null,
  p_partes_ids uuid[] default null,
  p_data_esocial timestamptz default null,
  p_esocial boolean default false,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_atualizado_por text default null,
  p_campos_alterados jsonb default '[]'::jsonb
) returns setof public.accidents
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_atualizado_uuid uuid;
  v_row_owner uuid;
  v_row_pessoa uuid;
  v_agente_count int;
  v_tipo_count int;
  v_lesao_count int;
  v_invalid boolean;
  v_cat text;
  v_cid text;
  v_hash_source text;
  v_import_hash text;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id, people_id into v_row_owner, v_row_pessoa
    from public.accidents
   where id = p_id;

  if v_row_owner is null then
    raise exception 'acidente_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_pessoa_id is null or v_row_pessoa is null or p_pessoa_id <> v_row_pessoa then
    raise exception 'acidente_pessoa_locked' using errcode = 'P0001';
  end if;

  begin
    v_atualizado_uuid := nullif(trim(p_atualizado_por), '')::uuid;
  exception
    when invalid_text_representation then
      v_atualizado_uuid := null;
  end;
  if v_atualizado_uuid is null then
    v_atualizado_uuid := auth.uid();
  end if;

  v_cat := nullif(btrim(p_cat), '');
  v_cid := nullif(btrim(p_cid), '');

  if v_cat is not null then
    select exists(
      select 1
        from public.accidents a
       where a.account_owner_id = v_row_owner
         and a.id <> p_id
         and lower(btrim(a.cat_number)) = lower(v_cat)
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_cat_duplicate' using errcode = 'P0001';
    end if;
  end if;

  v_agente_count := coalesce(array_length(p_agentes_ids, 1), 0);
  v_tipo_count := coalesce(array_length(p_tipos_ids, 1), 0);
  v_lesao_count := coalesce(array_length(p_lesoes_ids, 1), 0);

  if v_agente_count = 0 then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;
  if v_tipo_count = 0 and v_lesao_count = 0 then
    raise exception 'acidente_tipos_lesoes_required' using errcode = 'P0001';
  end if;
  if v_tipo_count > v_agente_count or v_lesao_count > v_agente_count then
    raise exception 'acidente_agentes_mismatch' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
     where a.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) as a(id)
      left join public.acidente_agentes aa on aa.id = a.id
     where a.id is not null and aa.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_agentes_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
      left join public.acidente_tipos at on at.id = t.id and at.agente_id = a.id
     where t.id is not null and at.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_tipos_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_agentes_ids) with ordinality as a(id, ord)
      left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
      left join public.acidente_lesoes al on al.id = l.id and al.agente_id = a.id
     where l.id is not null and al.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_lesoes_invalidas' using errcode = 'P0001';
  end if;

  if p_partes_ids is not null then
    select exists(
      select 1
        from unnest(p_partes_ids) as p(id)
        left join public.acidente_partes ap on ap.id = p.id
       where p.id is not null and ap.id is null
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_partes_invalidas' using errcode = 'P0001';
    end if;
  end if;

  v_hash_source := concat_ws(
    '|',
    coalesce(p_pessoa_id::text, ''),
    coalesce(to_char(p_data at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), ''),
    coalesce(p_dias_perdidos, 0)::text,
    coalesce(p_dias_debitados, 0)::text,
    coalesce(p_centro_servico_id::text, ''),
    coalesce(p_local_id::text, ''),
    coalesce(array_to_string(p_agentes_ids, ',', ''), ''),
    coalesce(array_to_string(p_tipos_ids, ',', ''), ''),
    coalesce(array_to_string(p_lesoes_ids, ',', ''), ''),
    coalesce(array_to_string(p_partes_ids, ',', ''), ''),
    coalesce(v_cat, ''),
    coalesce(v_cid, ''),
    coalesce(btrim(p_observacao), '')
  );

  v_import_hash := encode(digest(v_hash_source, 'sha256'), 'hex');

  update public.accidents
     set people_id = p_pessoa_id,
         accident_date = p_data,
         lost_days = coalesce(p_dias_perdidos, 0)::smallint,
         debited_days = coalesce(p_dias_debitados, 0)::smallint,
         cid_code = v_cid,
         service_center = p_centro_servico_id,
         location_name = p_local_id,
         cat_number = v_cat,
         notes = nullif(trim(p_observacao), ''),
         import_hash = v_import_hash,
         esocial_date = p_data_esocial,
         esocial_involved = coalesce(p_esocial, false),
         sesmt_involved = coalesce(p_sesmt, false),
         sesmt_date = p_data_sesmt,
         updated_by_username = v_atualizado_uuid,
         updated_at = now()
   where id = p_id;

  delete from public.accident_group_agents where accident_id = p_id;
  insert into public.accident_group_agents (
    accident_id,
    accident_agents_id,
    accident_type_id,
    accident_injuries_id,
    account_owner_id
  )
  select
    p_id,
    a.id,
    t.id,
    l.id,
    v_row_owner
  from unnest(p_agentes_ids) with ordinality as a(id, ord)
  left join unnest(p_tipos_ids) with ordinality as t(id, ord) using (ord)
  left join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
  where a.id is not null;

  delete from public.accident_group_parts where accident_id = p_id;
  if p_partes_ids is not null and array_length(p_partes_ids, 1) > 0 then
    insert into public.accident_group_parts (
      accident_id,
      accident_parts_id,
      account_owner_id
    )
    select p_id, p.id, v_row_owner
      from unnest(p_partes_ids) with ordinality as p(id, ord)
     where p.id is not null;
  end if;

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
      coalesce(nullif(trim(p_atualizado_por), ''), auth.uid()::text),
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select *
      from public.accidents a
     where a.id = p_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

grant execute on function public.rpc_acidentes_update_full_rehash(
  uuid,
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text,
  jsonb
) to authenticated;
