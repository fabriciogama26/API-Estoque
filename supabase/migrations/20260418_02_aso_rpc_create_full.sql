-- Etapa 2/4 do ajuste de ASO.
-- Executar isoladamente no SQL Editor.

drop function if exists public.rpc_aso_create_full(uuid, uuid, date, text, uuid);
create function public.rpc_aso_create_full(
  p_pessoa_id uuid,
  p_tipo_exame_id uuid,
  p_data_exame date,
  p_observacao text default null,
  p_usuario_id uuid default null
) returns setof public.aso_controle_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $rpc_aso_create_full$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
  v_pessoa_ativo boolean;
  v_pessoa_data_demissao timestamptz;
  v_tipo_codigo text;
  v_tipo_nome text;
  v_id uuid;
  v_existing_tipo_nome text;
  v_existing_data date;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select
    p.account_owner_id,
    p.ativo,
    p."dataDemissao"
  into
    v_row_owner,
    v_pessoa_ativo,
    v_pessoa_data_demissao
  from public.pessoas p
  where p.id = p_pessoa_id;

  if v_row_owner is null then
    raise exception 'pessoa_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    codigo,
    nome
  into
    v_tipo_codigo,
    v_tipo_nome
  from public.aso_tipos_exame
  where id = p_tipo_exame_id
    and ativo = true;

  if v_tipo_codigo is null then
    raise exception 'tipo_exame_aso_not_found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = p_pessoa_id
      and aso.tipo_exame_id = p_tipo_exame_id
      and aso.data_exame = p_data_exame
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  if v_tipo_codigo in ('admissional', 'periodico', 'mudanca_funcao_setor') then
    select tipo.nome, aso.data_exame
      into v_existing_tipo_nome, v_existing_data
    from public.aso_controle aso
    join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = p_pessoa_id
      and aso.status_registro = 'ativo'
      and tipo.codigo in ('admissional', 'periodico', 'mudanca_funcao_setor')
    limit 1;

    if v_existing_tipo_nome is not null then
      raise exception 'aso_active_group_exists'
        using errcode = '23505',
              message = format(
                'Ja existe um exame %s ativo para este funcionario em %s. Use a baixa / novo exame para encerrar o atual antes de cadastrar outro.',
                lower(v_existing_tipo_nome),
                to_char(v_existing_data, 'DD/MM/YYYY')
              );
    end if;
  end if;

  if v_tipo_codigo = 'demissional' then
    if coalesce(v_pessoa_ativo, true) = true and v_pessoa_data_demissao is null then
      raise exception 'aso_demissional_requires_inactive'
        using errcode = '23514',
              message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
    end if;

    select tipo.nome, aso.data_exame
      into v_existing_tipo_nome, v_existing_data
    from public.aso_controle aso
    join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = p_pessoa_id
      and aso.status_registro = 'ativo'
      and (
        tipo.codigo in ('admissional', 'periodico', 'mudanca_funcao_setor')
        or tipo.codigo = 'demissional'
      )
    limit 1;

    if v_existing_tipo_nome is not null then
      raise exception 'aso_active_group_exists'
        using errcode = '23505',
              message = format(
                'Ja existe um exame %s ativo para este funcionario em %s. Use a baixa / novo exame para encerrar o atual antes de cadastrar outro.',
                lower(v_existing_tipo_nome),
                to_char(v_existing_data, 'DD/MM/YYYY')
              );
    end if;
  end if;

  insert into public.aso_controle (
    pessoa_id,
    tipo_exame_id,
    data_exame,
    observacao,
    usuario_cadastro,
    account_owner_id,
    status_registro
  ) values (
    p_pessoa_id,
    p_tipo_exame_id,
    p_data_exame,
    p_observacao,
    v_user,
    v_row_owner,
    'ativo'
  )
  returning id into v_id;

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = v_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$rpc_aso_create_full$;

revoke all on function public.rpc_aso_create_full(uuid, uuid, date, text, uuid) from public;
grant execute on function public.rpc_aso_create_full(uuid, uuid, date, text, uuid) to authenticated;

comment on function public.rpc_aso_create_full(uuid, uuid, date, text, uuid) is
  'Cria um registro de ASO com validacao de duplicidade exata e grupo renovavel ativo.';
