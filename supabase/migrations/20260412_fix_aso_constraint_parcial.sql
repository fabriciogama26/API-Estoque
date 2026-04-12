-- Substitui a constraint aso_controle_owner_pessoa_tipo_unique por uma
-- versao parcial que aplica unicidade SOMENTE em registros ativos.
--
-- Isso permite o fluxo de baixa funcionar:
--   1. Registro atual -> status_registro = 'baixado' (sai do escopo da constraint)
--   2. Novo registro  -> status_registro = 'ativo'  (unico ativo por owner+pessoa+tipo)
--
-- A protecao continua existindo: nao eh possivel ter 2 registros ATIVOS
-- do mesmo tipo para a mesma pessoa. Registros baixados ficam como historico.

-- Substitui a constraint pela versao parcial (somente ativos)
alter table public.aso_controle
  drop constraint if exists aso_controle_owner_pessoa_tipo_unique;

drop index if exists public.aso_controle_owner_pessoa_tipo_unique;

create unique index if not exists aso_controle_owner_pessoa_tipo_unique
  on public.aso_controle (account_owner_id, pessoa_id, tipo_exame_id)
  where status_registro = 'ativo';

-- Tambem corrige o index de duplicidade por data para filtrar somente ativos
drop index if exists public.aso_controle_owner_pessoa_tipo_data_unique_idx;

create unique index if not exists aso_controle_owner_pessoa_tipo_data_unique_idx
  on public.aso_controle (account_owner_id, pessoa_id, tipo_exame_id, data_exame)
  where status_registro = 'ativo';

-- Alinha as validacoes de duplicidade nas RPCs para considerar somente registros ativos

create or replace function public.rpc_aso_create_full(
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
as $$
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

  -- Verifica duplicidade de mesma data apenas em registros ativos
  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = p_pessoa_id
      and aso.tipo_exame_id = p_tipo_exame_id
      and aso.data_exame = p_data_exame
      and aso.status_registro = 'ativo'
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  -- Verifica unicidade de admissional/demissional apenas em registros ativos
  if v_tipo_codigo in ('admissional', 'demissional')
     and exists (
       select 1
       from public.aso_controle aso
       where aso.account_owner_id = v_row_owner
         and aso.pessoa_id = p_pessoa_id
         and aso.tipo_exame_id = p_tipo_exame_id
         and aso.status_registro = 'ativo'
     ) then
    raise exception 'aso_unique_tipo'
      using errcode = '23505',
            message = format('Ja existe um exame %s ativo para este funcionario.', lower(v_tipo_nome));
  end if;

  if v_tipo_codigo = 'demissional'
     and coalesce(v_pessoa_ativo, true) = true
     and v_pessoa_data_demissao is null then
    raise exception 'aso_demissional_requires_inactive'
      using errcode = '23514',
            message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
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
$$;

create or replace function public.rpc_aso_update_full(
  p_id uuid,
  p_tipo_exame_id uuid,
  p_data_exame date,
  p_observacao text default null,
  p_usuario_id uuid default null,
  p_acao text default 'edicao'
) returns setof public.aso_controle_view
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
  v_pessoa_id uuid;
  v_pessoa_ativo boolean;
  v_pessoa_data_demissao timestamptz;
  v_tipo_codigo text;
  v_tipo_nome text;
  v_before jsonb;
  v_after jsonb;
  v_acao text := case when p_acao = 'baixa_exame' then 'baixa_exame' else 'edicao' end;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select
    aso.account_owner_id,
    aso.pessoa_id,
    p.ativo,
    p."dataDemissao"
  into
    v_row_owner,
    v_pessoa_id,
    v_pessoa_ativo,
    v_pessoa_data_demissao
  from public.aso_controle aso
  join public.pessoas p on p.id = aso.pessoa_id
  where aso.id = p_id;

  if v_row_owner is null then
    raise exception 'aso_not_found' using errcode = 'P0001';
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

  -- Verifica duplicidade de mesma data apenas em registros ativos
  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = v_pessoa_id
      and aso.tipo_exame_id = p_tipo_exame_id
      and aso.data_exame = p_data_exame
      and aso.id <> p_id
      and aso.status_registro = 'ativo'
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  -- Verifica unicidade de admissional/demissional apenas em registros ativos
  if v_tipo_codigo in ('admissional', 'demissional')
     and exists (
       select 1
       from public.aso_controle aso
       where aso.account_owner_id = v_row_owner
         and aso.pessoa_id = v_pessoa_id
         and aso.tipo_exame_id = p_tipo_exame_id
         and aso.id <> p_id
         and aso.status_registro = 'ativo'
     ) then
    raise exception 'aso_unique_tipo'
      using errcode = '23505',
            message = format('Ja existe um exame %s ativo para este funcionario.', lower(v_tipo_nome));
  end if;

  if v_tipo_codigo = 'demissional'
     and coalesce(v_pessoa_ativo, true) = true
     and v_pessoa_data_demissao is null then
    raise exception 'aso_demissional_requires_inactive'
      using errcode = '23514',
            message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
  end if;

  select to_jsonb(vw)
    into v_before
  from public.aso_controle_view vw
  where vw.id = p_id;

  update public.aso_controle
     set tipo_exame_id = p_tipo_exame_id,
         data_exame = p_data_exame,
         observacao = p_observacao,
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
      v_acao,
      v_before,
      coalesce(v_after, '{}'::jsonb),
      p_observacao,
      v_user,
      v_row_owner
    );
  end if;

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = p_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$$;

-- Restaura o rpc_aso_register_exam com o fluxo original: baixa + novo registro
create or replace function public.rpc_aso_register_exam(
  p_id uuid,
  p_data_realizada date,
  p_observacao text default null,
  p_usuario_id uuid default null
) returns setof public.aso_controle_view
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
  v_pessoa_id uuid;
  v_tipo_exame_id uuid;
  v_tipo_codigo text;
  v_observacao_atual text;
  v_status_registro text;
  v_before jsonb;
  v_after jsonb;
  v_new_id uuid;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select
    aso.account_owner_id,
    aso.pessoa_id,
    aso.tipo_exame_id,
    aso.observacao,
    aso.status_registro,
    tipo.codigo
  into
    v_row_owner,
    v_pessoa_id,
    v_tipo_exame_id,
    v_observacao_atual,
    v_status_registro,
    v_tipo_codigo
  from public.aso_controle aso
  join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
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

  if v_tipo_codigo = 'demissional' then
    raise exception 'aso_no_renewal'
      using errcode = '23514',
            message = 'Exame demissional nao possui renovacao.';
  end if;

  -- Snapshot antes da baixa
  select to_jsonb(vw)
    into v_before
  from public.aso_controle_view vw
  where vw.id = p_id;

  -- Marca o registro atual como baixado
  update public.aso_controle
     set status_registro = 'baixado',
         baixado_em = now(),
         baixado_por = v_user,
         usuario_edicao = v_user,
         atualizado_em = now()
   where id = p_id;

  -- Snapshot depois da baixa
  select to_jsonb(vw)
    into v_after
  from public.aso_controle_view vw
  where vw.id = p_id;

  -- Historico da baixa
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
      case
        when p_observacao is not null and p_observacao <> '' then
          'Data realizada: ' || p_data_realizada::text || '. ' || p_observacao
        else
          'Data realizada: ' || p_data_realizada::text
      end,
      v_user,
      v_row_owner
    );
  end if;

  -- Cria novo registro ativo com a data realizada
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
    v_tipo_exame_id,
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
$$;

comment on function public.rpc_aso_register_exam(uuid, date, text, uuid) is
  'Da baixa no registro atual do ASO e cria um novo ciclo com a data realizada.';

select pg_notify('pgrst', 'reload schema');
