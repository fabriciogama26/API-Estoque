-- Controle de Validades (parte 2/3): RPCs de leitura e escrita usadas pelas telas.
--
-- Todas as RPCs:
--   - recebem `p_owner_id` e validam o owner da sessao (`forecast_assert_owner_access`);
--   - validam a permissao da operacao (`validades_assert_access`);
--   - executam como SECURITY DEFINER com filtro explicito por `account_owner_id`.
-- Escrita direta nas tabelas continua revogada para `authenticated`.

-- ---------------------------------------------------------------------------
-- Helpers de serializacao (internos)
-- ---------------------------------------------------------------------------

create or replace function public._requisitos_config_json(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_row public.requisitos_config%rowtype;
  v_found boolean;
begin
  select * into v_row from public.requisitos_config where account_owner_id = p_owner_id;
  v_found := found;

  return jsonb_build_object(
    'configurada', v_found,
    'janela_critica_dias', coalesce(v_row.janela_critica_dias, 7),
    'timezone', coalesce(v_row.timezone, 'America/Sao_Paulo'),
    'alertas_ativos', coalesce(v_row.alertas_ativos, true),
    'alerta_janela_ativo', coalesce(v_row.alerta_janela_ativo, true),
    'alerta_vencimento_ativo', coalesce(v_row.alerta_vencimento_ativo, true),
    'alerta_vencimento_tolerancia_dias', coalesce(v_row.alerta_vencimento_tolerancia_dias, 7),
    'versao', coalesce(v_row.versao, 0),
    'atualizado_em', v_row.atualizado_em,
    'atualizado_por_nome', public._validades_usuario_nome(v_row.atualizado_por)
  );
end;
$$;

create or replace function public._requisito_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select jsonb_build_object(
    'id', r.id,
    'nome', r.nome,
    'codigo', r.codigo,
    'categoria', r.categoria,
    'tipo', r.tipo,
    'descricao', r.descricao,
    'possui_validade', r.possui_validade,
    'validade_quantidade', r.validade_quantidade,
    'validade_unidade', r.validade_unidade,
    'ativo', r.ativo,
    'observacao', r.observacao,
    'criado_em', r.criado_em,
    'atualizado_em', r.atualizado_em,
    'criado_por_nome', public._validades_usuario_nome(r.criado_por),
    'atualizado_por_nome', public._validades_usuario_nome(r.atualizado_por)
  )
  from public.requisitos_controle r
  where r.id = p_id;
$$;

create or replace function public._validades_realizacao_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select jsonb_build_object(
    'id', x.id,
    'pessoa_id', x.pessoa_id,
    'pessoa_nome', p.nome,
    'matricula', p.matricula,
    'requisito_id', x.requisito_id,
    'requisito_nome', r.nome,
    'requisito_codigo', r.codigo,
    'categoria', r.categoria,
    'data_realizacao', x.data_realizacao,
    'data_vencimento', x.data_vencimento,
    'possui_validade', x.possui_validade_snapshot,
    'validade_quantidade', x.validade_quantidade_snapshot,
    'validade_unidade', x.validade_unidade_snapshot,
    'numero_documento', x.numero_documento,
    'entidade_emissora', x.entidade_emissora,
    'observacao', x.observacao,
    'status_registro', x.status_registro,
    'origem_registro', x.origem_registro,
    'renovacao_de_id', x.renovacao_de_id,
    'substituido_em', x.substituido_em,
    'cancelado_em', x.cancelado_em,
    'motivo_cancelamento', x.motivo_cancelamento,
    'usuario_cadastro_nome', public._validades_usuario_nome(x.usuario_cadastro),
    'usuario_edicao_nome', public._validades_usuario_nome(x.usuario_edicao),
    'cancelado_por_nome', public._validades_usuario_nome(x.cancelado_por),
    'criado_em', x.criado_em,
    'atualizado_em', x.atualizado_em
  )
  from public.requisitos_realizacoes x
  join public.pessoas p on p.id = x.pessoa_id
  join public.requisitos_controle r on r.id = x.requisito_id
  where x.id = p_id;
$$;

create or replace function public._validades_regra_json(p_owner_id uuid, p_regra_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select jsonb_build_object(
    'id', a.id,
    'requisito_id', a.requisito_id,
    'cargo_id', a.cargo_id,
    'cargo', cg.nome,
    'setor_id', a.setor_id,
    'setor', st.nome,
    'centro_servico_id', a.centro_servico_id,
    'centro_servico', cs.nome,
    'centro_custo_id', a.centro_custo_id,
    'centro_custo', cc.nome,
    'pessoa_id', a.pessoa_id,
    'pessoa_nome', p.nome,
    'pessoa_matricula', p.matricula,
    'descricao', concat_ws(' + ',
      case when a.pessoa_id is not null then 'Individual: ' || coalesce(p.nome, '?') end,
      case when a.cargo_id is not null then 'Cargo: ' || coalesce(cg.nome, '?') end,
      case when a.setor_id is not null then 'Setor: ' || coalesce(st.nome, '?') end,
      case when a.centro_servico_id is not null then 'Centro de servico: ' || coalesce(cs.nome, '?') end,
      case when a.centro_custo_id is not null then 'Centro de custo: ' || coalesce(cc.nome, '?') end
    ),
    'afetados', (
      select count(*)
      from public._validades_pessoas_ativas(p_owner_id) pa
      where public._validades_regra_aplica(
        a.cargo_id, a.setor_id, a.centro_servico_id, a.centro_custo_id, a.pessoa_id,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id
      )
    ),
    'ativo', a.ativo,
    'criado_em', a.criado_em,
    'criado_por_nome', public._validades_usuario_nome(a.criado_por)
  )
  from public.requisitos_aplicabilidade a
  left join public.cargos cg on cg.id = a.cargo_id
  left join public.setores st on st.id = a.setor_id
  left join public.centros_servico cs on cs.id = a.centro_servico_id
  left join public.centros_custo cc on cc.id = a.centro_custo_id
  left join public.pessoas p on p.id = a.pessoa_id
  where a.id = p_regra_id
    and a.account_owner_id = p_owner_id;
$$;

create or replace function public._validades_exigir_motivo(p_motivo text, p_mensagem text)
returns text
language plpgsql
immutable
as $$
begin
  if nullif(btrim(coalesce(p_motivo, '')), '') is null or length(btrim(p_motivo)) < 3 then
    raise exception '%', p_mensagem using errcode = '22023';
  end if;
  return btrim(p_motivo);
end;
$$;

-- ---------------------------------------------------------------------------
-- Contexto e configuracao
-- ---------------------------------------------------------------------------

create or replace function public.rpc_validades_contexto(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  return jsonb_build_object(
    'hoje', public.validades_hoje(p_owner_id),
    'config', public._requisitos_config_json(p_owner_id),
    'pode_registrar', public.validades_pode('validades.registrar'),
    'pode_renovar', public.validades_pode('validades.renovar'),
    'pode_gerenciar_requisitos', public.validades_pode('validades.requisitos.manage'),
    'pode_gerenciar_regras', public.validades_pode('validades.regras.manage')
  );
end;
$$;

create or replace function public.rpc_requisitos_config_update(
  p_owner_id uuid,
  p_payload jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_atual jsonb;
  v_motivo text;
  v_janela integer;
  v_timezone text;
  v_alertas boolean;
  v_alerta_janela boolean;
  v_alerta_vencimento boolean;
  v_tolerancia integer;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.regras.manage');
  v_motivo := public._validades_exigir_motivo(p_motivo, 'Informe o motivo da alteracao da configuracao.');

  v_atual := public._requisitos_config_json(p_owner_id);
  p_payload := coalesce(p_payload, '{}'::jsonb);

  v_janela := coalesce(nullif(p_payload->>'janela_critica_dias', '')::integer, (v_atual->>'janela_critica_dias')::integer);
  v_timezone := coalesce(nullif(btrim(p_payload->>'timezone'), ''), v_atual->>'timezone');
  v_alertas := coalesce((p_payload->>'alertas_ativos')::boolean, (v_atual->>'alertas_ativos')::boolean);
  v_alerta_janela := coalesce((p_payload->>'alerta_janela_ativo')::boolean, (v_atual->>'alerta_janela_ativo')::boolean);
  v_alerta_vencimento := coalesce((p_payload->>'alerta_vencimento_ativo')::boolean, (v_atual->>'alerta_vencimento_ativo')::boolean);
  v_tolerancia := coalesce(
    nullif(p_payload->>'alerta_vencimento_tolerancia_dias', '')::integer,
    (v_atual->>'alerta_vencimento_tolerancia_dias')::integer
  );

  if v_janela is null or v_janela < 1 or v_janela > 90 then
    raise exception 'A janela critica deve ficar entre 1 e 90 dias.' using errcode = '22023';
  end if;

  if v_tolerancia is null or v_tolerancia < 0 or v_tolerancia > 30 then
    raise exception 'A tolerancia do alerta de vencimento deve ficar entre 0 e 30 dias.' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Timezone invalido: %.', v_timezone using errcode = '22023';
  end if;

  perform set_config('requisitos.motivo', v_motivo, true);

  insert into public.requisitos_config as c (
    account_owner_id, janela_critica_dias, timezone, alertas_ativos, alerta_janela_ativo,
    alerta_vencimento_ativo, alerta_vencimento_tolerancia_dias, versao, motivo_alteracao, atualizado_em, atualizado_por
  ) values (
    p_owner_id, v_janela, v_timezone, v_alertas, v_alerta_janela,
    v_alerta_vencimento, v_tolerancia, 1, v_motivo, now(), auth.uid()
  )
  on conflict (account_owner_id) do update
  set janela_critica_dias = excluded.janela_critica_dias,
      timezone = excluded.timezone,
      alertas_ativos = excluded.alertas_ativos,
      alerta_janela_ativo = excluded.alerta_janela_ativo,
      alerta_vencimento_ativo = excluded.alerta_vencimento_ativo,
      alerta_vencimento_tolerancia_dias = excluded.alerta_vencimento_tolerancia_dias,
      versao = c.versao + 1,
      motivo_alteracao = excluded.motivo_alteracao,
      atualizado_em = excluded.atualizado_em,
      atualizado_por = excluded.atualizado_por;

  return public._requisitos_config_json(p_owner_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Requisitos de Controle
-- ---------------------------------------------------------------------------

create or replace function public.rpc_requisitos_listar(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  return coalesce((
    with base as (
      select b.requisito_id, b.exigencia, b.status
      from public._validades_base(p_owner_id) b
    ),
    agg as (
      select
        requisito_id,
        count(*) filter (where exigencia = 'exigido') as exigidos,
        count(*) filter (where exigencia = 'exigido' and status = 'pendente') as pendentes,
        count(*) filter (where exigencia = 'exigido' and status in ('vencido', 'vence_hoje')) as vencidos,
        count(*) filter (where exigencia = 'exigido' and status = 'proximo_vencimento') as proximos,
        count(*) filter (where exigencia = 'dispensado') as dispensados
      from base
      group by requisito_id
    ),
    regras as (
      select requisito_id, count(*) as total
      from public.requisitos_aplicabilidade
      where account_owner_id = p_owner_id
        and ativo
      group by requisito_id
    )
    select jsonb_agg(
      public._requisito_json(r.id) || jsonb_build_object(
        'regras_ativas', coalesce(rg.total, 0),
        'colaboradores_exigidos', coalesce(a.exigidos, 0),
        'pendentes', coalesce(a.pendentes, 0),
        'vencidos', coalesce(a.vencidos, 0),
        'proximos', coalesce(a.proximos, 0),
        'dispensados', coalesce(a.dispensados, 0)
      )
      order by r.ativo desc, lower(r.nome)
    )
    from public.requisitos_controle r
    left join agg a on a.requisito_id = r.id
    left join regras rg on rg.requisito_id = r.id
    where r.account_owner_id = p_owner_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.rpc_requisito_salvar(
  p_owner_id uuid,
  p_id uuid,
  p_payload jsonb,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_atual public.requisitos_controle%rowtype;
  v_nome text;
  v_codigo text;
  v_categoria text;
  v_tipo text;
  v_descricao text;
  v_observacao text;
  v_possui boolean;
  v_quantidade integer;
  v_unidade text;
  v_id uuid;
  v_validade_mudou boolean := false;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');
  perform set_config('requisitos.motivo', coalesce(btrim(p_motivo), ''), true);

  p_payload := coalesce(p_payload, '{}'::jsonb);
  v_nome := btrim(coalesce(p_payload->>'nome', ''));
  v_codigo := nullif(btrim(coalesce(p_payload->>'codigo', '')), '');
  v_categoria := coalesce(nullif(btrim(p_payload->>'categoria'), ''), 'treinamento');
  v_tipo := coalesce(nullif(btrim(p_payload->>'tipo'), ''), 'interno');
  v_descricao := nullif(btrim(coalesce(p_payload->>'descricao', '')), '');
  v_observacao := nullif(btrim(coalesce(p_payload->>'observacao', '')), '');
  v_possui := coalesce((p_payload->>'possui_validade')::boolean, true);
  v_quantidade := case when v_possui then nullif(p_payload->>'validade_quantidade', '')::integer else null end;
  v_unidade := case when v_possui then nullif(btrim(coalesce(p_payload->>'validade_unidade', '')), '') else null end;

  if length(v_nome) < 2 then
    raise exception 'Informe o nome do requisito.' using errcode = '22023';
  end if;

  if v_categoria not in ('treinamento', 'certificado', 'documento', 'capacitacao', 'exame', 'outro') then
    raise exception 'Categoria invalida.' using errcode = '22023';
  end if;

  if v_tipo not in ('legal', 'interno', 'cliente', 'outro') then
    raise exception 'Tipo invalido.' using errcode = '22023';
  end if;

  if v_possui then
    if v_unidade not in ('dias', 'meses') or v_unidade is null then
      raise exception 'Informe a unidade da validade (dias ou meses).' using errcode = '22023';
    end if;
    if v_quantidade is null or v_quantidade < 1
      or (v_unidade = 'dias' and v_quantidade > 36500)
      or (v_unidade = 'meses' and v_quantidade > 1200) then
      raise exception 'Informe um periodo de validade valido.' using errcode = '22023';
    end if;
  end if;

  if p_id is null then
    begin
      insert into public.requisitos_controle (
        account_owner_id, nome, codigo, categoria, tipo, descricao, possui_validade,
        validade_quantidade, validade_unidade, observacao, criado_por
      ) values (
        p_owner_id, v_nome, v_codigo, v_categoria, v_tipo, v_descricao, v_possui,
        v_quantidade, v_unidade, v_observacao, auth.uid()
      )
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Ja existe um requisito com este nome ou codigo.' using errcode = '23505';
    end;

    return public._requisito_json(v_id);
  end if;

  select * into v_atual
  from public.requisitos_controle
  where id = p_id
    and account_owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'Requisito nao encontrado.' using errcode = 'P0002';
  end if;

  v_validade_mudou := v_atual.possui_validade is distinct from v_possui
    or v_atual.validade_quantidade is distinct from v_quantidade
    or v_atual.validade_unidade is distinct from v_unidade;

  if v_validade_mudou then
    if not public.validades_pode('validades.regras.manage') then
      raise exception 'Sem permissao para alterar a validade do requisito.' using errcode = '42501';
    end if;
    perform set_config(
      'requisitos.motivo',
      public._validades_exigir_motivo(p_motivo, 'Informe o motivo da alteracao da validade.'),
      true
    );
  end if;

  begin
    update public.requisitos_controle
    set nome = v_nome,
        codigo = v_codigo,
        categoria = v_categoria,
        tipo = v_tipo,
        descricao = v_descricao,
        possui_validade = v_possui,
        validade_quantidade = v_quantidade,
        validade_unidade = v_unidade,
        observacao = v_observacao,
        atualizado_por = auth.uid(),
        atualizado_em = now()
    where id = p_id
      and account_owner_id = p_owner_id;
  exception when unique_violation then
    raise exception 'Ja existe um requisito com este nome ou codigo.' using errcode = '23505';
  end;

  return public._requisito_json(p_id);
end;
$$;

create or replace function public.rpc_requisito_definir_ativo(
  p_owner_id uuid,
  p_id uuid,
  p_ativo boolean,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');

  if p_ativo is null then
    raise exception 'Informe se o requisito fica ativo ou inativo.' using errcode = '22023';
  end if;

  if not p_ativo then
    perform set_config(
      'requisitos.motivo',
      public._validades_exigir_motivo(p_motivo, 'Informe o motivo da inativacao.'),
      true
    );
  else
    perform set_config('requisitos.motivo', coalesce(btrim(p_motivo), ''), true);
  end if;

  update public.requisitos_controle
  set ativo = p_ativo,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  where id = p_id
    and account_owner_id = p_owner_id;

  if not found then
    raise exception 'Requisito nao encontrado.' using errcode = 'P0002';
  end if;

  return public._requisito_json(p_id);
end;
$$;

create or replace function public.rpc_requisito_regras(p_owner_id uuid, p_requisito_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  return coalesce((
    select jsonb_agg(public._validades_regra_json(p_owner_id, a.id) order by a.criado_em)
    from public.requisitos_aplicabilidade a
    where a.account_owner_id = p_owner_id
      and a.requisito_id = p_requisito_id
      and a.ativo
  ), '[]'::jsonb);
end;
$$;

create or replace function public.rpc_requisito_previa(p_owner_id uuid, p_regra jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_cargo uuid := nullif(p_regra->>'cargo_id', '')::uuid;
  v_setor uuid := nullif(p_regra->>'setor_id', '')::uuid;
  v_centro_servico uuid := nullif(p_regra->>'centro_servico_id', '')::uuid;
  v_centro_custo uuid := nullif(p_regra->>'centro_custo_id', '')::uuid;
  v_pessoa uuid := nullif(p_regra->>'pessoa_id', '')::uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  if num_nonnulls(v_cargo, v_setor, v_centro_servico, v_centro_custo, v_pessoa) = 0 then
    return jsonb_build_object('pessoas', 0);
  end if;

  return jsonb_build_object(
    'pessoas',
    (
      select count(*)
      from public._validades_pessoas_ativas(p_owner_id) pa
      where public._validades_regra_aplica(
        v_cargo, v_setor, v_centro_servico, v_centro_custo, v_pessoa,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id
      )
    )
  );
end;
$$;

create or replace function public.rpc_requisito_regra_adicionar(
  p_owner_id uuid,
  p_requisito_id uuid,
  p_regra jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_cargo uuid := nullif(p_regra->>'cargo_id', '')::uuid;
  v_setor uuid := nullif(p_regra->>'setor_id', '')::uuid;
  v_centro_servico uuid := nullif(p_regra->>'centro_servico_id', '')::uuid;
  v_centro_custo uuid := nullif(p_regra->>'centro_custo_id', '')::uuid;
  v_pessoa uuid := nullif(p_regra->>'pessoa_id', '')::uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');
  perform set_config('requisitos.motivo', '', true);

  if num_nonnulls(v_cargo, v_setor, v_centro_servico, v_centro_custo, v_pessoa) = 0 then
    raise exception 'Informe ao menos um criterio: cargo, setor, centro de servico, centro de custo ou colaborador.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.requisitos_controle r
    where r.id = p_requisito_id
      and r.account_owner_id = p_owner_id
  ) then
    raise exception 'Requisito nao encontrado.' using errcode = 'P0002';
  end if;

  begin
    insert into public.requisitos_aplicabilidade (
      account_owner_id, requisito_id, cargo_id, setor_id, centro_servico_id, centro_custo_id, pessoa_id, criado_por
    ) values (
      p_owner_id, p_requisito_id, v_cargo, v_setor, v_centro_servico, v_centro_custo, v_pessoa, auth.uid()
    );
  exception when unique_violation then
    raise exception 'Esta regra ja existe para o requisito.' using errcode = '23505';
  end;

  return public.rpc_requisito_regras(p_owner_id, p_requisito_id);
end;
$$;

create or replace function public.rpc_requisito_regra_remover(
  p_owner_id uuid,
  p_regra_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_motivo text;
  v_requisito_id uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');
  v_motivo := public._validades_exigir_motivo(p_motivo, 'Informe o motivo da remocao da regra.');
  perform set_config('requisitos.motivo', v_motivo, true);

  update public.requisitos_aplicabilidade
  set ativo = false,
      desativado_em = now(),
      desativado_por = auth.uid(),
      motivo_desativacao = v_motivo
  where id = p_regra_id
    and account_owner_id = p_owner_id
    and ativo
  returning requisito_id into v_requisito_id;

  if v_requisito_id is null then
    raise exception 'Regra nao encontrada ou ja removida.' using errcode = 'P0002';
  end if;

  return public.rpc_requisito_regras(p_owner_id, v_requisito_id);
end;
$$;

create or replace function public.rpc_requisitos_historico(
  p_owner_id uuid,
  p_requisito_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'entidade', h.entidade,
        'registro_id', h.registro_id,
        'acao', h.acao,
        'antes', h.antes,
        'depois', h.depois,
        'motivo', h.motivo,
        'ator_nome', public._validades_usuario_nome(h.ator_user_id),
        'criado_em', h.criado_em
      )
      order by h.criado_em desc, h.id desc
    )
    from (
      select *
      from public.requisitos_historico
      where account_owner_id = p_owner_id
        and requisito_id = p_requisito_id
        and entidade in ('requisito', 'aplicabilidade')
      order by criado_em desc, id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) h
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Controle de Validades: lista e painel
-- ---------------------------------------------------------------------------

-- Lista paginada no servidor (p_offset/p_limite). A exportacao percorre as paginas.
create or replace function public.rpc_validades_lista(
  p_owner_id uuid,
  p_filtros jsonb default '{}'::jsonb,
  p_limite integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 5000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_itens jsonb;
  v_total bigint;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  select
    coalesce(
      jsonb_agg(
        to_jsonb(x) - 'total_geral' - 'posicao' - 'hoje' - 'janela'
        order by x.posicao
      ),
      '[]'::jsonb
    ),
    coalesce(max(x.total_geral), 0)
  into v_itens, v_total
  from (
    select
      l.*,
      count(*) over () as total_geral,
      row_number() over (
        order by
          case l.status
            when 'vencido' then 1
            when 'vence_hoje' then 2
            when 'proximo_vencimento' then 3
            when 'pendente' then 4
            when 'valido' then 5
            when 'sem_validade' then 6
            else 7
          end,
          l.dias_restantes nulls last,
          lower(l.pessoa_nome),
          lower(l.requisito_nome)
      ) as posicao
    from public._validades_filtrada(p_owner_id, p_filtros) l
  ) x
  where x.posicao > v_offset
    and x.posicao <= v_offset + v_limite;

  -- Pagina alem do fim: ainda informa o total real.
  if v_total = 0 and v_offset > 0 then
    select count(*) into v_total from public._validades_filtrada(p_owner_id, p_filtros);
  end if;

  return jsonb_build_object(
    'itens', v_itens,
    'total', v_total,
    'limite', v_limite,
    'offset', v_offset,
    'hoje', public.validades_hoje(p_owner_id),
    'janela', (public._requisitos_config_json(p_owner_id)->>'janela_critica_dias')::integer
  );
end;
$$;

-- Os cards consideram apenas requisitos exigidos (dispensados e nao exigidos ficam em `extras`).
create or replace function public.rpc_validades_resumo(
  p_owner_id uuid,
  p_filtros jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_resultado jsonb;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  with linhas as materialized (
    select *
    from public._validades_filtrada(
      p_owner_id,
      coalesce(p_filtros, '{}'::jsonb) || jsonb_build_object('exigencia', 'todos')
    )
  ),
  exigidos as (
    select * from linhas where exigencia = 'exigido'
  ),
  cards as (
    select jsonb_build_object(
      'monitorados', count(*),
      'validos', count(*) filter (where status in ('valido', 'sem_validade')),
      'proximos', count(*) filter (where status = 'proximo_vencimento'),
      'vence_hoje', count(*) filter (where status = 'vence_hoje'),
      'vencidos', count(*) filter (where status = 'vencido'),
      'pendentes', count(*) filter (where status = 'pendente'),
      'sem_validade', count(*) filter (where status = 'sem_validade')
    ) as valor
    from exigidos
  ),
  extras as (
    select jsonb_build_object(
      'dispensados', count(*) filter (where exigencia = 'dispensado'),
      'nao_exigidos', count(*) filter (where exigencia = 'nao_exigido')
    ) as valor
    from linhas
  ),
  status_ordem(status, label, ordem) as (
    values
      ('vencido', 'Vencido', 1),
      ('vence_hoje', 'Vence hoje', 2),
      ('proximo_vencimento', 'Proximo do vencimento', 3),
      ('pendente', 'Pendente', 4),
      ('valido', 'Valido', 5),
      ('sem_validade', 'Sem validade', 6)
  ),
  por_status as (
    select coalesce(jsonb_agg(
      jsonb_build_object('status', so.status, 'label', so.label, 'total', coalesce(c.total, 0))
      order by so.ordem
    ), '[]'::jsonb) as valor
    from status_ordem so
    left join (select status, count(*) as total from exigidos group by status) c on c.status = so.status
  ),
  por_requisito as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.atencao desc, lower(r.requisito)), '[]'::jsonb) as valor
    from (
      select
        requisito_id,
        requisito_nome as requisito,
        requisito_codigo as codigo,
        count(*) filter (where status = 'vencido') as vencidos,
        count(*) filter (where status = 'vence_hoje') as vence_hoje,
        count(*) filter (where status = 'proximo_vencimento') as proximos,
        count(*) filter (where status = 'pendente') as pendentes,
        count(*) filter (where status in ('valido', 'sem_validade')) as validos,
        count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) as atencao
      from exigidos
      group by requisito_id, requisito_nome, requisito_codigo
      order by atencao desc, lower(requisito_nome)
      limit 15
    ) r
  ),
  faixas(faixa, label, inicio, fim, ordem) as (
    values
      ('0_7', 'Ate 7 dias', 0, 7, 1),
      ('8_30', '8 a 30 dias', 8, 30, 2),
      ('31_60', '31 a 60 dias', 31, 60, 3),
      ('61_90', '61 a 90 dias', 61, 90, 4)
  ),
  por_faixa as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'faixa', f.faixa,
        'label', f.label,
        'total', (select count(*) from exigidos e where e.dias_restantes between f.inicio and f.fim)
      )
      order by f.ordem
    ), '[]'::jsonb) as valor
    from faixas f
  ),
  por_centro_servico as (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.atencao desc, lower(g.nome)), '[]'::jsonb) as valor
    from (
      select
        centro_servico_id as id,
        coalesce(centro_servico, 'Sem centro de servico') as nome,
        count(*) filter (where status = 'vencido') as vencidos,
        count(*) filter (where status = 'vence_hoje') as vence_hoje,
        count(*) filter (where status = 'proximo_vencimento') as proximos,
        count(*) filter (where status = 'pendente') as pendentes,
        count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) as atencao
      from exigidos
      group by centro_servico_id, centro_servico
      having count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) > 0
      order by atencao desc, lower(coalesce(centro_servico, ''))
      limit 15
    ) g
  ),
  por_setor as (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.atencao desc, lower(g.nome)), '[]'::jsonb) as valor
    from (
      select
        setor_id as id,
        coalesce(setor, 'Sem setor') as nome,
        count(*) filter (where status = 'vencido') as vencidos,
        count(*) filter (where status = 'vence_hoje') as vence_hoje,
        count(*) filter (where status = 'proximo_vencimento') as proximos,
        count(*) filter (where status = 'pendente') as pendentes,
        count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) as atencao
      from exigidos
      group by setor_id, setor
      having count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) > 0
      order by atencao desc, lower(coalesce(setor, ''))
      limit 15
    ) g
  ),
  por_centro_custo as (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.atencao desc, lower(g.nome)), '[]'::jsonb) as valor
    from (
      select
        centro_custo_id as id,
        coalesce(centro_custo, 'Sem centro de custo') as nome,
        count(*) filter (where status = 'vencido') as vencidos,
        count(*) filter (where status = 'vence_hoje') as vence_hoje,
        count(*) filter (where status = 'proximo_vencimento') as proximos,
        count(*) filter (where status = 'pendente') as pendentes,
        count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) as atencao
      from exigidos
      group by centro_custo_id, centro_custo
      having count(*) filter (where status in ('vencido', 'vence_hoje', 'proximo_vencimento', 'pendente')) > 0
      order by atencao desc, lower(coalesce(centro_custo, ''))
      limit 15
    ) g
  )
  select jsonb_build_object(
    'hoje', public.validades_hoje(p_owner_id),
    'janela', (public._requisitos_config_json(p_owner_id)->>'janela_critica_dias')::integer,
    'cards', (select valor from cards),
    'extras', (select valor from extras),
    'por_status', (select valor from por_status),
    'por_requisito', (select valor from por_requisito),
    'por_faixa', (select valor from por_faixa),
    'por_centro_servico', (select valor from por_centro_servico),
    'por_setor', (select valor from por_setor),
    'por_centro_custo', (select valor from por_centro_custo)
  )
  into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.rpc_validades_simular_vencimento(
  p_owner_id uuid,
  p_requisito_id uuid,
  p_data date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_req public.requisitos_controle%rowtype;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  select * into v_req
  from public.requisitos_controle
  where id = p_requisito_id
    and account_owner_id = p_owner_id;

  if not found then
    raise exception 'Requisito nao encontrado.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'possui_validade', v_req.possui_validade,
    'validade_quantidade', v_req.validade_quantidade,
    'validade_unidade', v_req.validade_unidade,
    'data_vencimento', public.validade_calcular_vencimento(
      p_data, v_req.possui_validade, v_req.validade_quantidade, v_req.validade_unidade
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Controle de Validades: registro, renovacao, edicao, cancelamento
-- ---------------------------------------------------------------------------

create or replace function public._validades_lock_par(p_owner_id uuid, p_pessoa_id uuid, p_requisito_id uuid)
returns void
language sql
volatile
as $$
  select pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':' || p_pessoa_id::text || ':' || p_requisito_id::text, 0));
$$;

create or replace function public.rpc_validades_registrar(p_owner_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_pessoa uuid := nullif(p_payload->>'pessoa_id', '')::uuid;
  v_requisito uuid := nullif(p_payload->>'requisito_id', '')::uuid;
  v_data date := nullif(p_payload->>'data_realizacao', '')::date;
  v_hoje date;
  v_vigente public.requisitos_realizacoes%rowtype;
  v_status text := 'vigente';
  v_origem text := 'registro';
  v_id uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.registrar');
  perform set_config('requisitos.motivo', '', true);

  if v_pessoa is null then
    raise exception 'Selecione o colaborador.' using errcode = '22023';
  end if;
  if v_requisito is null then
    raise exception 'Selecione o requisito.' using errcode = '22023';
  end if;
  if v_data is null then
    raise exception 'Informe a data de realizacao ou emissao.' using errcode = '22023';
  end if;

  v_hoje := public.validades_hoje(p_owner_id);
  if v_data > v_hoje then
    raise exception 'A data de realizacao nao pode ser futura.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.pessoas p
    where p.id = v_pessoa
      and p.account_owner_id = p_owner_id
  ) then
    raise exception 'Colaborador nao encontrado.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.requisitos_controle r
    where r.id = v_requisito
      and r.account_owner_id = p_owner_id
      and r.ativo
  ) then
    raise exception 'Requisito nao encontrado ou inativo.' using errcode = 'P0002';
  end if;

  perform public._validades_lock_par(p_owner_id, v_pessoa, v_requisito);

  if exists (
    select 1 from public.requisitos_realizacoes x
    where x.account_owner_id = p_owner_id
      and x.pessoa_id = v_pessoa
      and x.requisito_id = v_requisito
      and x.data_realizacao = v_data
      and x.status_registro <> 'cancelado'
  ) then
    raise exception 'Ja existe registro deste requisito para o colaborador nesta data.' using errcode = '23505';
  end if;

  select * into v_vigente
  from public.requisitos_realizacoes x
  where x.account_owner_id = p_owner_id
    and x.pessoa_id = v_pessoa
    and x.requisito_id = v_requisito
    and x.status_registro = 'vigente'
  for update;

  if found then
    if v_data > v_vigente.data_realizacao then
      raise exception 'Ja existe realizacao vigente em %. Use Renovar para registrar a nova realizacao.',
        to_char(v_vigente.data_realizacao, 'DD/MM/YYYY')
        using errcode = 'P0001', hint = 'use_renovar', detail = v_vigente.id::text;
    end if;
    -- Data anterior a vigente: guarda como historico (nao altera status nem gera alerta).
    v_status := 'substituido';
    v_origem := 'retroativo';
  end if;

  insert into public.requisitos_realizacoes (
    account_owner_id, pessoa_id, requisito_id, data_realizacao,
    possui_validade_snapshot, numero_documento, entidade_emissora, observacao,
    status_registro, origem_registro, substituido_em, substituido_por, usuario_cadastro
  ) values (
    p_owner_id, v_pessoa, v_requisito, v_data,
    false,
    nullif(btrim(coalesce(p_payload->>'numero_documento', '')), ''),
    nullif(btrim(coalesce(p_payload->>'entidade_emissora', '')), ''),
    nullif(btrim(coalesce(p_payload->>'observacao', '')), ''),
    v_status,
    v_origem,
    case when v_status = 'substituido' then now() end,
    case when v_status = 'substituido' then auth.uid() end,
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'realizacao', public._validades_realizacao_json(v_id),
    'retroativo', v_origem = 'retroativo'
  );
end;
$$;

create or replace function public.rpc_validades_renovar(
  p_owner_id uuid,
  p_realizacao_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_anterior public.requisitos_realizacoes%rowtype;
  v_data date := nullif(p_payload->>'data_realizacao', '')::date;
  v_hoje date;
  v_id uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.renovar');
  perform set_config('requisitos.motivo', '', true);

  select * into v_anterior
  from public.requisitos_realizacoes
  where id = p_realizacao_id
    and account_owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'Registro nao encontrado.' using errcode = 'P0002';
  end if;

  if v_anterior.status_registro <> 'vigente' then
    raise exception 'Somente a realizacao vigente pode ser renovada.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.requisitos_controle r
    where r.id = v_anterior.requisito_id
      and r.account_owner_id = p_owner_id
      and r.ativo
  ) then
    raise exception 'Requisito inativo nao pode ser renovado.' using errcode = '22023';
  end if;

  if v_data is null then
    raise exception 'Informe a data da nova realizacao.' using errcode = '22023';
  end if;

  v_hoje := public.validades_hoje(p_owner_id);
  if v_data > v_hoje then
    raise exception 'A data de realizacao nao pode ser futura.' using errcode = '22023';
  end if;

  if v_data <= v_anterior.data_realizacao then
    raise exception 'A data da renovacao deve ser posterior a realizacao atual (%).',
      to_char(v_anterior.data_realizacao, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  perform public._validades_lock_par(p_owner_id, v_anterior.pessoa_id, v_anterior.requisito_id);

  update public.requisitos_realizacoes
  set status_registro = 'substituido',
      substituido_em = now(),
      substituido_por = auth.uid(),
      atualizado_em = now()
  where id = v_anterior.id;

  insert into public.requisitos_realizacoes (
    account_owner_id, pessoa_id, requisito_id, data_realizacao,
    possui_validade_snapshot, numero_documento, entidade_emissora, observacao,
    status_registro, origem_registro, renovacao_de_id, usuario_cadastro
  ) values (
    p_owner_id, v_anterior.pessoa_id, v_anterior.requisito_id, v_data,
    false,
    nullif(btrim(coalesce(p_payload->>'numero_documento', '')), ''),
    nullif(btrim(coalesce(p_payload->>'entidade_emissora', '')), ''),
    nullif(btrim(coalesce(p_payload->>'observacao', '')), ''),
    'vigente',
    'renovacao',
    v_anterior.id,
    auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'realizacao', public._validades_realizacao_json(v_id),
    'anterior', public._validades_realizacao_json(v_anterior.id)
  );
end;
$$;

create or replace function public.rpc_validades_editar(
  p_owner_id uuid,
  p_realizacao_id uuid,
  p_payload jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_registro public.requisitos_realizacoes%rowtype;
  v_data date;
  v_motivo text;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.registrar');
  v_motivo := public._validades_exigir_motivo(p_motivo, 'Informe o motivo da edicao.');
  p_payload := coalesce(p_payload, '{}'::jsonb);

  select * into v_registro
  from public.requisitos_realizacoes
  where id = p_realizacao_id
    and account_owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'Registro nao encontrado.' using errcode = 'P0002';
  end if;

  if v_registro.status_registro = 'cancelado' then
    raise exception 'Registro cancelado nao pode ser editado.' using errcode = '22023';
  end if;

  v_data := coalesce(nullif(p_payload->>'data_realizacao', '')::date, v_registro.data_realizacao);

  if v_data <> v_registro.data_realizacao then
    if v_data > public.validades_hoje(p_owner_id) then
      raise exception 'A data de realizacao nao pode ser futura.' using errcode = '22023';
    end if;

    perform public._validades_lock_par(p_owner_id, v_registro.pessoa_id, v_registro.requisito_id);

    if exists (
      select 1 from public.requisitos_realizacoes x
      where x.account_owner_id = p_owner_id
        and x.pessoa_id = v_registro.pessoa_id
        and x.requisito_id = v_registro.requisito_id
        and x.data_realizacao = v_data
        and x.status_registro <> 'cancelado'
        and x.id <> v_registro.id
    ) then
      raise exception 'Ja existe registro deste requisito para o colaborador nesta data.' using errcode = '23505';
    end if;

    -- Mantem a regra: a realizacao vigente e sempre a mais recente do historico.
    if v_registro.status_registro = 'vigente' and exists (
      select 1 from public.requisitos_realizacoes x
      where x.account_owner_id = p_owner_id
        and x.pessoa_id = v_registro.pessoa_id
        and x.requisito_id = v_registro.requisito_id
        and x.status_registro = 'substituido'
        and x.data_realizacao >= v_data
    ) then
      raise exception 'A data da realizacao vigente deve ser posterior aos registros anteriores do historico.'
        using errcode = '22023';
    end if;

    if v_registro.status_registro = 'substituido' and exists (
      select 1 from public.requisitos_realizacoes x
      where x.account_owner_id = p_owner_id
        and x.pessoa_id = v_registro.pessoa_id
        and x.requisito_id = v_registro.requisito_id
        and x.status_registro = 'vigente'
        and x.data_realizacao <= v_data
    ) then
      raise exception 'A data de um registro do historico deve ser anterior a realizacao vigente.'
        using errcode = '22023';
    end if;
  end if;

  perform set_config('requisitos.motivo', v_motivo, true);

  update public.requisitos_realizacoes
  set data_realizacao = v_data,
      numero_documento = case
        when p_payload ? 'numero_documento' then nullif(btrim(coalesce(p_payload->>'numero_documento', '')), '')
        else numero_documento
      end,
      entidade_emissora = case
        when p_payload ? 'entidade_emissora' then nullif(btrim(coalesce(p_payload->>'entidade_emissora', '')), '')
        else entidade_emissora
      end,
      observacao = case
        when p_payload ? 'observacao' then nullif(btrim(coalesce(p_payload->>'observacao', '')), '')
        else observacao
      end,
      usuario_edicao = auth.uid(),
      atualizado_em = now()
  where id = v_registro.id;

  return jsonb_build_object('realizacao', public._validades_realizacao_json(v_registro.id));
end;
$$;

create or replace function public.rpc_validades_cancelar(
  p_owner_id uuid,
  p_realizacao_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_registro public.requisitos_realizacoes%rowtype;
  v_motivo text;
  v_reativado uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.registrar');
  v_motivo := public._validades_exigir_motivo(p_motivo, 'Informe o motivo do cancelamento.');

  select * into v_registro
  from public.requisitos_realizacoes
  where id = p_realizacao_id
    and account_owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'Registro nao encontrado.' using errcode = 'P0002';
  end if;

  if v_registro.status_registro = 'cancelado' then
    raise exception 'Registro ja cancelado.' using errcode = '22023';
  end if;

  perform public._validades_lock_par(p_owner_id, v_registro.pessoa_id, v_registro.requisito_id);
  perform set_config('requisitos.motivo', v_motivo, true);

  update public.requisitos_realizacoes
  set status_registro = 'cancelado',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = v_motivo,
      atualizado_em = now()
  where id = v_registro.id;

  -- Cancelar a vigente devolve a vigencia ao registro anterior mais recente (se existir).
  if v_registro.status_registro = 'vigente' then
    select x.id into v_reativado
    from public.requisitos_realizacoes x
    where x.account_owner_id = p_owner_id
      and x.pessoa_id = v_registro.pessoa_id
      and x.requisito_id = v_registro.requisito_id
      and x.status_registro = 'substituido'
    order by x.data_realizacao desc, x.criado_em desc
    limit 1
    for update;

    if v_reativado is not null then
      perform set_config('requisitos.motivo', 'Reativado apos cancelamento do registro seguinte: ' || v_motivo, true);
      update public.requisitos_realizacoes
      set status_registro = 'vigente',
          substituido_em = null,
          substituido_por = null,
          atualizado_em = now()
      where id = v_reativado;
    end if;
  end if;

  return jsonb_build_object(
    'cancelado', public._validades_realizacao_json(v_registro.id),
    'reativado', case when v_reativado is not null then public._validades_realizacao_json(v_reativado) end
  );
end;
$$;

create or replace function public.rpc_validades_historico(
  p_owner_id uuid,
  p_pessoa_id uuid,
  p_requisito_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.validades_assert_access(p_owner_id, 'validades.read');

  return jsonb_build_object(
    'registros', coalesce((
      select jsonb_agg(public._validades_realizacao_json(x.id) order by x.data_realizacao desc, x.criado_em desc)
      from public.requisitos_realizacoes x
      where x.account_owner_id = p_owner_id
        and x.pessoa_id = p_pessoa_id
        and x.requisito_id = p_requisito_id
    ), '[]'::jsonb),
    'dispensas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'motivo', d.motivo,
          'valida_ate', d.valida_ate,
          'criado_em', d.criado_em,
          'criado_por_nome', public._validades_usuario_nome(d.criado_por),
          'revogada_em', d.revogada_em,
          'revogada_por_nome', public._validades_usuario_nome(d.revogada_por),
          'motivo_revogacao', d.motivo_revogacao
        )
        order by d.criado_em desc
      )
      from public.requisitos_dispensas d
      where d.account_owner_id = p_owner_id
        and d.pessoa_id = p_pessoa_id
        and d.requisito_id = p_requisito_id
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'entidade', h.entidade,
          'registro_id', h.registro_id,
          'acao', h.acao,
          'antes', h.antes,
          'depois', h.depois,
          'motivo', h.motivo,
          'ator_nome', public._validades_usuario_nome(h.ator_user_id),
          'criado_em', h.criado_em
        )
        order by h.criado_em desc, h.id desc
      )
      from public.requisitos_historico h
      where h.account_owner_id = p_owner_id
        and h.pessoa_id = p_pessoa_id
        and h.requisito_id = p_requisito_id
        and h.entidade in ('realizacao', 'dispensa')
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dispensas individuais
-- ---------------------------------------------------------------------------

create or replace function public.rpc_validades_dispensar(p_owner_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_pessoa uuid := nullif(p_payload->>'pessoa_id', '')::uuid;
  v_requisito uuid := nullif(p_payload->>'requisito_id', '')::uuid;
  v_valida_ate date := nullif(p_payload->>'valida_ate', '')::date;
  v_motivo text;
  v_id uuid;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');
  v_motivo := public._validades_exigir_motivo(p_payload->>'motivo', 'Informe o motivo da dispensa.');

  if v_pessoa is null or v_requisito is null then
    raise exception 'Informe o colaborador e o requisito da dispensa.' using errcode = '22023';
  end if;

  if v_valida_ate is not null and v_valida_ate < public.validades_hoje(p_owner_id) then
    raise exception 'A data limite da dispensa nao pode estar no passado.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.pessoas p where p.id = v_pessoa and p.account_owner_id = p_owner_id
  ) then
    raise exception 'Colaborador nao encontrado.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.requisitos_controle r
    where r.id = v_requisito and r.account_owner_id = p_owner_id and r.ativo
  ) then
    raise exception 'Requisito nao encontrado ou inativo.' using errcode = 'P0002';
  end if;

  perform set_config('requisitos.motivo', v_motivo, true);

  begin
    insert into public.requisitos_dispensas (
      account_owner_id, pessoa_id, requisito_id, motivo, valida_ate, criado_por
    ) values (
      p_owner_id, v_pessoa, v_requisito, v_motivo, v_valida_ate, auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ja existe dispensa ativa deste requisito para o colaborador.' using errcode = '23505';
  end;

  return jsonb_build_object('id', v_id, 'pessoa_id', v_pessoa, 'requisito_id', v_requisito, 'valida_ate', v_valida_ate);
end;
$$;

create or replace function public.rpc_validades_dispensa_revogar(
  p_owner_id uuid,
  p_dispensa_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_motivo text;
begin
  perform public.validades_assert_access(p_owner_id, 'validades.requisitos.manage');
  v_motivo := public._validades_exigir_motivo(p_motivo, 'Informe o motivo da revogacao.');
  perform set_config('requisitos.motivo', v_motivo, true);

  update public.requisitos_dispensas
  set revogada_em = now(),
      revogada_por = auth.uid(),
      motivo_revogacao = v_motivo
  where id = p_dispensa_id
    and account_owner_id = p_owner_id
    and revogada_em is null;

  if not found then
    raise exception 'Dispensa nao encontrada ou ja revogada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_dispensa_id, 'revogada', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public._requisitos_config_json(uuid) from public, anon, authenticated;
revoke all on function public._requisito_json(uuid) from public, anon, authenticated;
revoke all on function public._validades_realizacao_json(uuid) from public, anon, authenticated;
revoke all on function public._validades_regra_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public._validades_exigir_motivo(text, text) from public, anon, authenticated;
revoke all on function public._validades_lock_par(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public._requisitos_config_json(uuid) to service_role;
grant execute on function public._requisito_json(uuid) to service_role;
grant execute on function public._validades_realizacao_json(uuid) to service_role;
grant execute on function public._validades_regra_json(uuid, uuid) to service_role;
grant execute on function public._validades_exigir_motivo(text, text) to service_role;
grant execute on function public._validades_lock_par(uuid, uuid, uuid) to service_role;

revoke all on function public.rpc_validades_contexto(uuid) from public, anon;
revoke all on function public.rpc_requisitos_config_update(uuid, jsonb, text) from public, anon;
revoke all on function public.rpc_requisitos_listar(uuid) from public, anon;
revoke all on function public.rpc_requisito_salvar(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.rpc_requisito_definir_ativo(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.rpc_requisito_regras(uuid, uuid) from public, anon;
revoke all on function public.rpc_requisito_previa(uuid, jsonb) from public, anon;
revoke all on function public.rpc_requisito_regra_adicionar(uuid, uuid, jsonb) from public, anon;
revoke all on function public.rpc_requisito_regra_remover(uuid, uuid, text) from public, anon;
revoke all on function public.rpc_requisitos_historico(uuid, uuid, integer) from public, anon;
revoke all on function public.rpc_validades_lista(uuid, jsonb, integer, integer) from public, anon;
revoke all on function public.rpc_validades_resumo(uuid, jsonb) from public, anon;
revoke all on function public.rpc_validades_simular_vencimento(uuid, uuid, date) from public, anon;
revoke all on function public.rpc_validades_registrar(uuid, jsonb) from public, anon;
revoke all on function public.rpc_validades_renovar(uuid, uuid, jsonb) from public, anon;
revoke all on function public.rpc_validades_editar(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.rpc_validades_cancelar(uuid, uuid, text) from public, anon;
revoke all on function public.rpc_validades_historico(uuid, uuid, uuid) from public, anon;
revoke all on function public.rpc_validades_dispensar(uuid, jsonb) from public, anon;
revoke all on function public.rpc_validades_dispensa_revogar(uuid, uuid, text) from public, anon;

grant execute on function public.rpc_validades_contexto(uuid) to authenticated, service_role;
grant execute on function public.rpc_requisitos_config_update(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.rpc_requisitos_listar(uuid) to authenticated, service_role;
grant execute on function public.rpc_requisito_salvar(uuid, uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.rpc_requisito_definir_ativo(uuid, uuid, boolean, text) to authenticated, service_role;
grant execute on function public.rpc_requisito_regras(uuid, uuid) to authenticated, service_role;
grant execute on function public.rpc_requisito_previa(uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_requisito_regra_adicionar(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_requisito_regra_remover(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rpc_requisitos_historico(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.rpc_validades_lista(uuid, jsonb, integer, integer) to authenticated, service_role;
grant execute on function public.rpc_validades_resumo(uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_validades_simular_vencimento(uuid, uuid, date) to authenticated, service_role;
grant execute on function public.rpc_validades_registrar(uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_validades_renovar(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_validades_editar(uuid, uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.rpc_validades_cancelar(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rpc_validades_historico(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.rpc_validades_dispensar(uuid, jsonb) to authenticated, service_role;
grant execute on function public.rpc_validades_dispensa_revogar(uuid, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
