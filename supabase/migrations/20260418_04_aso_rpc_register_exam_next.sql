-- Etapa 4/4 do ajuste de ASO.
-- Executar isoladamente no SQL Editor.

drop function if exists public.rpc_aso_register_exam_next(uuid, uuid, date, text, uuid);
create function public.rpc_aso_register_exam_next(
  p_id uuid,
  p_proximo_tipo_exame_id uuid,
  p_data_realizada date,
  p_observacao text default null,
  p_usuario_id uuid default null
) returns setof public.aso_controle_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $rpc_aso_register_exam_next$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
  v_pessoa_id uuid;
  v_pessoa_ativo boolean;
  v_pessoa_data_demissao timestamptz;
  v_tipo_exame_id uuid;
  v_tipo_codigo_atual text;
  v_tipo_codigo_proximo text;
  v_status_registro text;
  v_observacao_atual text;
  v_before jsonb;
  v_after jsonb;
  v_new_id uuid;
  v_existing_tipo_nome text;
  v_existing_data date;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if p_proximo_tipo_exame_id is null then
    raise exception 'next_exam_type_required'
      using errcode = '23514',
            message = 'Selecione o tipo do proximo exame.';
  end if;

  select
    aso.account_owner_id,
    aso.pessoa_id,
    aso.tipo_exame_id,
    aso.status_registro,
    aso.observacao,
    tipo.codigo,
    p.ativo,
    p."dataDemissao"
  into
    v_row_owner,
    v_pessoa_id,
    v_tipo_exame_id,
    v_status_registro,
    v_observacao_atual,
    v_tipo_codigo_atual,
    v_pessoa_ativo,
    v_pessoa_data_demissao
  from public.aso_controle aso
  join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
  join public.pessoas p on p.id = aso.pessoa_id
  where aso.id = p_id;

  if v_row_owner is null then
    raise exception 'aso_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(v_status_registro, 'ativo') = 'baixado' then
    raise exception 'aso_already_closed'
      using errcode = '23514',
            message = 'Este registro de ASO ja recebeu baixa.';
  end if;

  if v_tipo_codigo_atual = 'demissional' then
    raise exception 'aso_no_renewal'
      using errcode = '23514',
            message = 'Exame demissional nao possui renovacao.';
  end if;

  select codigo
    into v_tipo_codigo_proximo
  from public.aso_tipos_exame
  where id = p_proximo_tipo_exame_id
    and ativo = true;

  if v_tipo_codigo_proximo is null then
    raise exception 'tipo_exame_aso_not_found' using errcode = '23503';
  end if;

  if v_tipo_codigo_proximo not in ('periodico', 'mudanca_funcao_setor', 'demissional') then
    raise exception 'aso_invalid_next_type'
      using errcode = '23514',
            message = 'O proximo exame deve ser periodico, mudanca de funcao/Setor ou demissional.';
  end if;

  if v_tipo_codigo_proximo = 'demissional'
     and coalesce(v_pessoa_ativo, true) = true
     and v_pessoa_data_demissao is null then
    raise exception 'aso_demissional_requires_inactive'
      using errcode = '23514',
            message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
  end if;

  select tipo.nome, aso.data_exame
    into v_existing_tipo_nome, v_existing_data
  from public.aso_controle aso
  join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
  where aso.account_owner_id = v_row_owner
    and aso.pessoa_id = v_pessoa_id
    and aso.id <> p_id
    and aso.status_registro = 'ativo'
    and (
      (v_tipo_codigo_proximo in ('periodico', 'mudanca_funcao_setor') and tipo.codigo in ('admissional', 'periodico', 'mudanca_funcao_setor'))
      or (v_tipo_codigo_proximo = 'demissional' and tipo.codigo in ('admissional', 'periodico', 'mudanca_funcao_setor', 'demissional'))
    )
  limit 1;

  if v_existing_tipo_nome is not null then
    raise exception 'aso_active_group_exists'
      using errcode = '23505',
            message = format(
              'Ja existe um exame %s ativo para este funcionario em %s. Encerrar o atual e gerar outro nao e possivel enquanto houver mais de um ativo.',
              lower(v_existing_tipo_nome),
              to_char(v_existing_data, 'DD/MM/YYYY')
            );
  end if;

  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = v_pessoa_id
      and aso.tipo_exame_id = p_proximo_tipo_exame_id
      and aso.data_exame = p_data_realizada
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  select to_jsonb(vw)
    into v_before
  from public.aso_controle_view vw
  where vw.id = p_id;

  update public.aso_controle
     set status_registro = 'baixado',
         baixado_em = now(),
         baixado_por = v_user,
         usuario_edicao = v_user,
         atualizado_em = now()
   where id = p_id;

  select to_jsonb(vw)
    into v_after
  from public.aso_controle_view vw
  where vw.id = p_id;

  if coalesce(v_before, '{}'::jsonb) is distinct from coalesce(v_after, '{}'::jsonb) then
    insert into public.aso_historico (
      aso_id,
      pessoa_id,
      acao,
      dados_antes,
      dados_depois,
      observacao,
      usuario_responsavel,
      account_owner_id
    ) values (
      p_id,
      v_pessoa_id,
      'baixa_exame',
      v_before,
      coalesce(v_after, '{}'::jsonb),
      p_observacao,
      v_user,
      v_row_owner
    );
  end if;

  insert into public.aso_controle (
    pessoa_id,
    tipo_exame_id,
    data_exame,
    observacao,
    usuario_cadastro,
    account_owner_id,
    status_registro,
    registro_origem_id
  ) values (
    v_pessoa_id,
    p_proximo_tipo_exame_id,
    p_data_realizada,
    coalesce(p_observacao, v_observacao_atual),
    v_user,
    v_row_owner,
    'ativo',
    p_id
  )
  returning id into v_new_id;

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = v_new_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$rpc_aso_register_exam_next$;

revoke all on function public.rpc_aso_register_exam_next(uuid, uuid, date, text, uuid) from public;
grant execute on function public.rpc_aso_register_exam_next(uuid, uuid, date, text, uuid) to authenticated;

comment on function public.rpc_aso_register_exam_next(uuid, uuid, date, text, uuid) is
  'Da baixa no registro atual do ASO e cria um novo ciclo com o tipo do proximo exame.';

select pg_notify('pgrst', 'reload schema');
