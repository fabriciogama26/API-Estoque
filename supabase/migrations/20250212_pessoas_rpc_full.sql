-- RPCs full para Pessoas (create/update) evitando RLS em joins.

create or replace function public.rpc_pessoas_create_full(
  p_nome text,
  p_matricula text,
  p_data_admissao date,
  p_centro_servico_id uuid,
  p_setor_id uuid,
  p_cargo_id uuid,
  p_centro_custo_id uuid,
  p_tipo_execucao_id uuid,
  p_observacao text default null,
  p_data_demissao date default null,
  p_ativo boolean default true,
  p_usuario_id uuid default null
) returns setof public.pessoas_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_id uuid;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  insert into public.pessoas (
    nome,
    matricula,
    observacao,
    centro_servico_id,
    setor_id,
    cargo_id,
    centro_custo_id,
    tipo_execucao_id,
    "dataAdmissao",
    "dataDemissao",
    "usuarioCadastro",
    "criadoEm",
    "atualizadoEm",
    ativo,
    account_owner_id
  ) values (
    p_nome,
    p_matricula,
    p_observacao,
    p_centro_servico_id,
    p_setor_id,
    p_cargo_id,
    p_centro_custo_id,
    p_tipo_execucao_id,
    p_data_admissao,
    p_data_demissao,
    v_user,
    now(),
    null,
    coalesce(p_ativo, true),
    v_owner
  )
  returning id into v_id;

  return query
    select pv.*
      from public.pessoas_view pv
      join public.pessoas p on p.id = pv.id
     where p.id = v_id
       and (v_is_master or p.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_pessoas_create_full(
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  boolean,
  uuid
) from public;

grant execute on function public.rpc_pessoas_create_full(
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  boolean,
  uuid
) to authenticated;

create or replace function public.rpc_pessoas_update_full(
  p_id uuid,
  p_nome text,
  p_matricula text,
  p_data_admissao date,
  p_centro_servico_id uuid,
  p_setor_id uuid,
  p_cargo_id uuid,
  p_centro_custo_id uuid,
  p_tipo_execucao_id uuid,
  p_observacao text default null,
  p_data_demissao date default null,
  p_ativo boolean default true,
  p_usuario_id uuid default null,
  p_campos_alterados jsonb default '[]'::jsonb
) returns setof public.pessoas_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.pessoas
   where id = p_id;

  if v_row_owner is null then
    raise exception 'pessoa_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.pessoas
     set nome = p_nome,
         matricula = p_matricula,
         observacao = p_observacao,
         centro_servico_id = p_centro_servico_id,
         setor_id = p_setor_id,
         cargo_id = p_cargo_id,
         centro_custo_id = p_centro_custo_id,
         tipo_execucao_id = p_tipo_execucao_id,
         "dataAdmissao" = p_data_admissao,
         "dataDemissao" = p_data_demissao,
         "usuarioEdicao" = v_user,
         "atualizadoEm" = now(),
         ativo = coalesce(p_ativo, true)
   where id = p_id;

  if p_campos_alterados is not null
     and jsonb_typeof(p_campos_alterados) = 'array'
     and jsonb_array_length(p_campos_alterados) > 0 then
    insert into public.pessoas_historico (
      pessoa_id,
      data_edicao,
      usuario_responsavel,
      campos_alterados,
      account_owner_id
    ) values (
      p_id,
      now(),
      v_user,
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select pv.*
      from public.pessoas_view pv
      join public.pessoas p on p.id = pv.id
     where p.id = p_id
       and (v_is_master or p.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_pessoas_update_full(
  uuid,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  boolean,
  uuid,
  jsonb
) from public;

grant execute on function public.rpc_pessoas_update_full(
  uuid,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  boolean,
  uuid,
  jsonb
) to authenticated;
