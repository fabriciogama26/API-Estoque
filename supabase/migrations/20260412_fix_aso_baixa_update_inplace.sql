-- Corrige rpc_aso_register_exam para fazer UPDATE in-place no registro
-- existente em vez de criar um novo registro.
--
-- A constraint aso_controle_owner_pessoa_tipo_unique garante que so existe
-- um registro por (owner, pessoa, tipo_exame). O fluxo antigo criava um
-- segundo registro (com status 'ativo') apos baixar o primeiro, violando
-- essa constraint.
--
-- Novo fluxo:
--   1. Grava snapshot "antes" (historico)
--   2. Atualiza data_exame = data_realizada (o trigger recalcula vencimento)
--   3. Grava snapshot "depois" (historico com acao = 'baixa_exame')
--   4. Retorna o mesmo registro atualizado
--
-- Nao cria novo registro, nao muda status_registro, nao marca como baixado.
-- O registro permanece 'ativo' com a nova data e novo vencimento.

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

  if v_tipo_codigo = 'demissional' then
    raise exception 'aso_no_renewal'
      using errcode = '23514',
            message = 'Exame demissional nao possui renovacao.';
  end if;

  -- Snapshot antes da alteracao
  select to_jsonb(vw)
    into v_before
  from public.aso_controle_view vw
  where vw.id = p_id;

  -- Atualiza o mesmo registro: troca data_exame pela data realizada
  -- O trigger trg_aso_proximo_vencimento recalcula automaticamente o proximo_vencimento
  update public.aso_controle
     set data_exame = p_data_realizada,
         observacao = coalesce(p_observacao, observacao),
         usuario_edicao = v_user,
         atualizado_em = now()
   where id = p_id;

  -- Snapshot depois da alteracao
  select to_jsonb(vw)
    into v_after
  from public.aso_controle_view vw
  where vw.id = p_id;

  -- Registra historico somente se houve alteracao real
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

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = p_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$$;

comment on function public.rpc_aso_register_exam(uuid, date, text, uuid) is
  'Da baixa no exame atualizando a data do registro existente e recalculando o proximo vencimento.';

select pg_notify('pgrst', 'reload schema');
