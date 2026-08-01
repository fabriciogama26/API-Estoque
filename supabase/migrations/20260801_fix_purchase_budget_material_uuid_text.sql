-- Corrige campos UUID de cadastro do material no orcamento anual.
-- O erro 22P02 ainda podia ocorrer na CTE materiais_base por coalesce(uuid, ''),
-- principalmente em fabricante/nome/grupo quando o cadastro usa chaves tecnicas.
create or replace function public.safe_uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  if btrim(p_value) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return btrim(p_value)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function public.safe_uuid_or_null(text) from public;
grant execute on function public.safe_uuid_or_null(text) to authenticated, service_role;
create or replace function public.stock_status_is_cancelado(
  p_tipo text,
  p_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status_text text := lower(btrim(coalesce(p_status, '')));
  v_status_id uuid := public.safe_uuid_or_null(p_status);
  v_label text;
begin
  if v_status_text = '' then
    return false;
  end if;

  if v_status_text = 'cancelado' then
    return true;
  end if;

  if v_status_id is null then
    return false;
  end if;

  if lower(coalesce(p_tipo, '')) = 'entrada' then
    select lower(se.status)
      into v_label
    from public.status_entrada se
    where se.id = v_status_id
    limit 1;
  elsif lower(coalesce(p_tipo, '')) = 'saida' then
    select lower(ss.status)
      into v_label
    from public.status_saida ss
    where ss.id = v_status_id
    limit 1;
  else
    return false;
  end if;

  return coalesce(v_label, '') = 'cancelado';
end;
$$;

revoke all on function public.stock_status_is_cancelado(text, text) from public;
grant execute on function public.stock_status_is_cancelado(text, text) to authenticated, service_role;

create or replace function public.rpc_refresh_consumo_material_mensal(
  p_owner_id uuid,
  p_inicio date default null,
  p_fim date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := public.my_owner_id();
  v_inicio date := coalesce(date_trunc('month', p_inicio)::date, (date_trunc('month', current_date)::date - interval '24 months')::date);
  v_fim date := coalesce(date_trunc('month', p_fim)::date, date_trunc('month', current_date)::date);
  v_rows int := 0;
begin
  if p_owner_id is null then
    raise exception 'p_owner_id obrigatorio.' using errcode = '22023';
  end if;

  if not public.is_master() and v_owner is not null and p_owner_id <> v_owner then
    raise exception 'Acesso negado ao owner informado.' using errcode = '42501';
  end if;

  delete from public.agg_consumo_material_mensal
   where account_owner_id = p_owner_id
     and ano_mes between v_inicio and v_fim;

  insert into public.agg_consumo_material_mensal (
    account_owner_id,
    material_id,
    ano_mes,
    quantidade_saida,
    valor_saida,
    quantidade_entrada,
    valor_entrada,
    preco_medio,
    updated_at
  )
  with movimentos as (
    select
      s.account_owner_id,
      public.safe_uuid_or_null(s."materialId"::text) as material_id,
      date_trunc('month', s."dataEntrega")::date as ano_mes,
      sum(coalesce(s.quantidade, 0))::numeric as quantidade_saida,
      sum(coalesce(s.quantidade, 0) * coalesce(m."valorUnitario", 0))::numeric as valor_saida,
      0::numeric as quantidade_entrada,
      0::numeric as valor_entrada
    from public.saidas s
    join public.materiais m
      on m.id = public.safe_uuid_or_null(s."materialId"::text)
     and m.account_owner_id = s.account_owner_id
    where s.account_owner_id = p_owner_id
      and public.safe_uuid_or_null(s."materialId"::text) is not null
      and date_trunc('month', s."dataEntrega")::date between v_inicio and v_fim
      and not public.stock_status_is_cancelado('saida', s.status::text)
    group by s.account_owner_id, public.safe_uuid_or_null(s."materialId"::text), date_trunc('month', s."dataEntrega")::date

    union all

    select
      e.account_owner_id,
      public.safe_uuid_or_null(e."materialId"::text) as material_id,
      date_trunc('month', e."dataEntrada")::date as ano_mes,
      0::numeric as quantidade_saida,
      0::numeric as valor_saida,
      sum(coalesce(e.quantidade, 0))::numeric as quantidade_entrada,
      sum(coalesce(e.quantidade, 0) * coalesce(m."valorUnitario", 0))::numeric as valor_entrada
    from public.entradas e
    join public.materiais m
      on m.id = public.safe_uuid_or_null(e."materialId"::text)
     and m.account_owner_id = e.account_owner_id
    where e.account_owner_id = p_owner_id
      and public.safe_uuid_or_null(e."materialId"::text) is not null
      and date_trunc('month', e."dataEntrada")::date between v_inicio and v_fim
      and not public.stock_status_is_cancelado('entrada', e.status::text)
    group by e.account_owner_id, public.safe_uuid_or_null(e."materialId"::text), date_trunc('month', e."dataEntrada")::date
  ),
  agrupado as (
    select
      account_owner_id,
      material_id,
      ano_mes,
      sum(quantidade_saida)::numeric as quantidade_saida,
      sum(valor_saida)::numeric as valor_saida,
      sum(quantidade_entrada)::numeric as quantidade_entrada,
      sum(valor_entrada)::numeric as valor_entrada
    from movimentos
    where material_id is not null
    group by account_owner_id, material_id, ano_mes
  )
  select
    account_owner_id,
    material_id,
    ano_mes,
    round(quantidade_saida, 2),
    round(valor_saida, 2),
    round(quantidade_entrada, 2),
    round(valor_entrada, 2),
    round(
      case
        when quantidade_saida > 0 then valor_saida / quantidade_saida
        when quantidade_entrada > 0 then valor_entrada / quantidade_entrada
        else 0
      end,
      2
    ),
    now()
  from agrupado;

  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'owner_id', p_owner_id,
    'periodo_inicio', v_inicio,
    'periodo_fim', v_fim,
    'linhas_atualizadas', v_rows
  );
end;
$$;


drop function if exists public.rpc_orcamento_compra_12m_calcular(uuid, uuid, jsonb);
create or replace function public.rpc_orcamento_compra_12m_calcular(
  p_owner_id text,
  p_forecast_id text default null,
  p_parametros jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := public.my_owner_id();
  v_owner_param uuid := public.safe_uuid_or_null(p_owner_id);
  v_forecast_param uuid := public.safe_uuid_or_null(p_forecast_id);
  v_forecast_id uuid;
  v_periodo_base_inicio date;
  v_periodo_base_fim date;
  v_created_at timestamptz;
  v_horizonte int := greatest(1, least(24, coalesce((p_parametros->>'horizonte_meses')::int, 12)));
  v_cobertura_final numeric := greatest(0, coalesce((p_parametros->>'cobertura_final_meses')::numeric, 2));
  v_reajuste numeric := greatest(0, coalesce((p_parametros->>'reajuste_padrao')::numeric, 0.06));
  v_contingencia numeric := greatest(0, coalesce((p_parametros->>'contingencia')::numeric, 0.08));
  v_crescimento numeric := coalesce((p_parametros->>'crescimento_operacional')::numeric, 0);
  v_horizonte_inicio date;
  v_horizonte_fim date;
begin
  if v_owner_param is null then
    raise exception 'p_owner_id invalido.' using errcode = '22023';
  end if;

  if not public.is_master() and v_owner is not null and v_owner_param <> v_owner then
    raise exception 'Acesso negado ao owner informado.' using errcode = '42501';
  end if;

  select id, periodo_base_inicio, periodo_base_fim, created_at
    into v_forecast_id, v_periodo_base_inicio, v_periodo_base_fim, v_created_at
  from public.inventory_forecast
  where account_owner_id = v_owner_param
    and (v_forecast_param is null or id = v_forecast_param)
  order by
    case when id = v_forecast_param then 0 else 1 end,
    created_at desc
  limit 1;

  if v_forecast_id is null then
    return jsonb_build_object(
      'status', 'missing',
      'forecast_id', null,
      'message', 'Previsao ainda nao calculada para gerar orcamento anual.'
    );
  end if;

  v_horizonte_inicio := (date_trunc('month', v_periodo_base_fim)::date + interval '1 month')::date;
  v_horizonte_fim := (date_trunc('month', v_horizonte_inicio)::date + ((v_horizonte - 1) || ' months')::interval)::date;

  perform public.rpc_refresh_consumo_material_mensal(v_owner_param, v_periodo_base_inicio, v_periodo_base_fim);

  return (
    with entradas_saldo as (
      select
        public.safe_uuid_or_null(e."materialId"::text)::text as material_id,
        sum(e.quantidade)::numeric as quantidade
      from public.entradas e
      where e.account_owner_id = v_owner_param
        and public.safe_uuid_or_null(e."materialId"::text) is not null
        and not public.stock_status_is_cancelado('entrada', e.status::text)
      group by public.safe_uuid_or_null(e."materialId"::text)
    ),
    saidas_saldo as (
      select
        public.safe_uuid_or_null(s."materialId"::text)::text as material_id,
        sum(s.quantidade)::numeric as quantidade
      from public.saidas s
      where s.account_owner_id = v_owner_param
        and public.safe_uuid_or_null(s."materialId"::text) is not null
        and not public.stock_status_is_cancelado('saida', s.status::text)
      group by public.safe_uuid_or_null(s."materialId"::text)
    ),
    consumo_base as (
      select
        a.material_id::text as material_id,
        sum(a.quantidade_saida)::numeric as quantidade_saida,
        sum(a.valor_saida)::numeric as valor_saida,
        count(distinct a.ano_mes)::numeric as meses_com_movimento
      from public.agg_consumo_material_mensal a
      where a.account_owner_id = v_owner_param
        and a.ano_mes between v_periodo_base_inicio and v_periodo_base_fim
      group by a.material_id
    ),
    materiais_base as (
      select
        m.id::text as material_id,
        m.nome::text as nome,
        coalesce(m.fabricante::text, '') as fabricante,
        coalesce(m."grupoMaterial"::text, '') as grupo_material,
        round(coalesce(m."valorUnitario", 0)::numeric, 2) as preco_atual,
        coalesce(m."estoqueMinimo", 0)::numeric as estoque_minimo,
        greatest(coalesce(es.quantidade, 0) - coalesce(ss.quantidade, 0), 0)::numeric as estoque_atual,
        coalesce(cb.quantidade_saida, 0)::numeric as quantidade_saida_base,
        coalesce(cb.valor_saida, 0)::numeric as valor_saida_base,
        greatest(1, coalesce(cb.meses_com_movimento, 0))::numeric as meses_com_movimento
      from public.materiais m
      left join entradas_saldo es on es.material_id = m.id::text
      left join saidas_saldo ss on ss.material_id = m.id::text
      left join consumo_base cb on cb.material_id = m.id::text
      where m.account_owner_id = v_owner_param
        and coalesce(m.ativo, true) = true
    ),
    calculado as (
      select
        b.*,
        round((b.quantidade_saida_base / b.meses_com_movimento)::numeric, 2) as consumo_medio_mensal,
        greatest(b.estoque_atual - coalesce((p_parametros->'estoque_bloqueado'->>b.material_id)::numeric, 0), 0)::numeric as estoque_utilizavel_qtd,
        coalesce((p_parametros->'pedidos_em_aberto'->>b.material_id)::numeric, 0)::numeric as pedidos_abertos_qtd,
        coalesce((p_parametros->'demandas_extraordinarias'->>b.material_id)::numeric, 0)::numeric as demanda_extraordinaria_qtd,
        coalesce((p_parametros->'reajustes_material'->>b.material_id)::numeric, v_reajuste)::numeric as reajuste_material
      from materiais_base b
    ),
    enriquecido as (
      select
        c.*,
        round((c.consumo_medio_mensal * v_horizonte * (1 + v_crescimento))::numeric, 2) as consumo_previsto_qtd,
        round((c.consumo_medio_mensal * v_cobertura_final)::numeric, 2) as estoque_seguranca_qtd,
        case
          when c.consumo_medio_mensal > 0 then round((c.estoque_atual / c.consumo_medio_mensal * 30)::numeric, 0)
          else null
        end as cobertura_dias,
        greatest(
          (c.consumo_medio_mensal * v_horizonte * (1 + v_crescimento))
          + (c.consumo_medio_mensal * v_cobertura_final)
          + c.demanda_extraordinaria_qtd
          - c.estoque_utilizavel_qtd
          - c.pedidos_abertos_qtd,
          0
        )::numeric as quantidade_necessaria_qtd,
        greatest(
          c.estoque_utilizavel_qtd + c.pedidos_abertos_qtd
          - ((c.consumo_medio_mensal * v_horizonte * (1 + v_crescimento)) + (c.consumo_medio_mensal * v_cobertura_final)),
          0
        )::numeric as potencial_reducao_qtd
      from calculado c
    ),
    financeiro as (
      select
        e.*,
        round((e.consumo_previsto_qtd * e.preco_atual)::numeric, 2) as consumo_previsto_valor,
        round((e.estoque_utilizavel_qtd * e.preco_atual)::numeric, 2) as estoque_utilizavel_valor,
        round((e.pedidos_abertos_qtd * e.preco_atual)::numeric, 2) as pedidos_abertos_valor,
        round((e.estoque_seguranca_qtd * e.preco_atual)::numeric, 2) as estoque_seguranca_valor,
        round((e.demanda_extraordinaria_qtd * e.preco_atual)::numeric, 2) as demanda_extraordinaria_valor,
        round((e.quantidade_necessaria_qtd * e.preco_atual)::numeric, 2) as necessidade_liquida_valor,
        round((e.quantidade_necessaria_qtd * e.preco_atual * e.reajuste_material)::numeric, 2) as reajuste_valor,
        round((e.quantidade_necessaria_qtd * e.preco_atual * (1 + e.reajuste_material))::numeric, 2) as valor_com_reajuste,
        round((e.potencial_reducao_qtd * e.preco_atual)::numeric, 2) as potencial_reducao_valor
      from enriquecido e
    ),
    resumo_base as (
      select
        count(*) as materiais_monitorados,
        count(*) filter (where quantidade_necessaria_qtd > 0) as materiais_orcados,
        count(*) filter (where cobertura_dias is not null and cobertura_dias < 30) as materiais_risco,
        round(coalesce(sum(consumo_previsto_valor), 0)::numeric, 2) as consumo_previsto_valor,
        round(coalesce(sum(estoque_utilizavel_valor), 0)::numeric, 2) as estoque_utilizavel_valor,
        round(coalesce(sum(pedidos_abertos_valor), 0)::numeric, 2) as pedidos_abertos_valor,
        round(coalesce(sum(estoque_seguranca_valor), 0)::numeric, 2) as estoque_seguranca_valor,
        round(coalesce(sum(demanda_extraordinaria_valor), 0)::numeric, 2) as demanda_extraordinaria_valor,
        round(coalesce(sum(necessidade_liquida_valor), 0)::numeric, 2) as necessidade_liquida_valor,
        round(coalesce(sum(reajuste_valor), 0)::numeric, 2) as reajuste_valor,
        round(coalesce(sum(valor_com_reajuste), 0)::numeric, 2) as valor_com_reajuste,
        round((coalesce(sum(valor_com_reajuste), 0) * v_contingencia)::numeric, 2) as contingencia_valor,
        round((coalesce(sum(valor_com_reajuste), 0) * (1 + v_contingencia))::numeric, 2) as verba_recomendada
      from financeiro
    ),
    cenarios_params as (
      select 'economico'::text as id, 'Economico'::text as label, greatest(0, v_reajuste * 0.5)::numeric as reajuste, greatest(0, v_contingencia * 0.5)::numeric as contingencia, greatest(0, v_cobertura_final - 1)::numeric as cobertura_final
      union all
      select 'base', 'Base', v_reajuste, v_contingencia, v_cobertura_final
      union all
      select 'conservador', 'Conservador', v_reajuste * 1.5, v_contingencia * 1.5, v_cobertura_final + 1
    ),
    cenarios as (
      select
        cp.id,
        cp.label,
        round((
          coalesce(sum(greatest(
            (f.consumo_medio_mensal * v_horizonte * (1 + v_crescimento))
            + (f.consumo_medio_mensal * cp.cobertura_final)
            + f.demanda_extraordinaria_qtd
            - f.estoque_utilizavel_qtd
            - f.pedidos_abertos_qtd,
            0
          ) * f.preco_atual * (1 + cp.reajuste)), 0) * (1 + cp.contingencia)
        )::numeric, 2) as verba
      from cenarios_params cp
      cross join financeiro f
      group by cp.id, cp.label, cp.reajuste, cp.contingencia, cp.cobertura_final
    ),
    meses as (
      select
        gs.i,
        (v_horizonte_inicio + (gs.i || ' months')::interval)::date as ano_mes
      from generate_series(0, v_horizonte - 1) as gs(i)
    ),
    pesos as (
      select
        m.i,
        m.ano_mes,
        coalesce(fp.valor_previsto, 0)::numeric as valor_previsto
      from meses m
      left join public.f_previsao_gasto_mensal fp
        on fp.account_owner_id = v_owner_param
       and fp.inventory_forecast_id = v_forecast_id
       and fp.ano_mes = m.ano_mes
       and fp.cenario = 'base'
    ),
    pesos_total as (
      select coalesce(sum(valor_previsto), 0)::numeric as total_previsto from pesos
    ),
    cronograma_base as (
      select
        p.i,
        p.ano_mes,
        round((
          rb.verba_recomendada
          * case
              when pt.total_previsto > 0 then p.valor_previsto / pt.total_previsto
              else 1.0 / v_horizonte
            end
        )::numeric, 2) as compra_prevista
      from pesos p
      cross join pesos_total pt
      cross join resumo_base rb
    ),
    cronograma as (
      select
        ano_mes,
        compra_prevista,
        round(sum(compra_prevista) over (order by i rows between unbounded preceding and current row)::numeric, 2) as acumulado
      from cronograma_base
    )
    select jsonb_build_object(
      'status', 'ok',
      'forecast_id', v_forecast_id,
      'snapshot', jsonb_build_object(
        'base_inicio', v_periodo_base_inicio,
        'base_fim', v_periodo_base_fim,
        'horizonte_inicio', v_horizonte_inicio,
        'horizonte_fim', v_horizonte_fim,
        'forecast_created_at', v_created_at,
        'gerado_em', now()
      ),
      'parametros', jsonb_build_object(
        'horizonte_meses', v_horizonte,
        'cobertura_final_meses', v_cobertura_final,
        'reajuste_padrao', v_reajuste,
        'contingencia', v_contingencia,
        'crescimento_operacional', v_crescimento
      ),
      'resumo', jsonb_build_object(
        'materiais_monitorados', rb.materiais_monitorados,
        'materiais_orcados', rb.materiais_orcados,
        'materiais_risco', rb.materiais_risco,
        'verba_recomendada', rb.verba_recomendada,
        'necessidade_liquida_valor', rb.necessidade_liquida_valor,
        'valor_com_reajuste', rb.valor_com_reajuste,
        'contingencia_valor', rb.contingencia_valor
      ),
      'composicao', jsonb_build_object(
        'consumo_previsto', rb.consumo_previsto_valor,
        'estoque_final_desejado', rb.estoque_seguranca_valor,
        'demanda_extraordinaria', rb.demanda_extraordinaria_valor,
        'estoque_utilizavel', rb.estoque_utilizavel_valor,
        'pedidos_em_aberto', rb.pedidos_abertos_valor,
        'reajuste_precos', rb.reajuste_valor,
        'contingencia', rb.contingencia_valor,
        'verba_recomendada', rb.verba_recomendada
      ),
      'cenarios', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'verba', c.verba) order by c.id) from cenarios c), '[]'::jsonb),
      'cronograma', coalesce((select jsonb_agg(jsonb_build_object('ano_mes', c.ano_mes, 'label', to_char(c.ano_mes, 'MM/YYYY'), 'compra_prevista', c.compra_prevista, 'acumulado', c.acumulado) order by c.ano_mes) from cronograma c), '[]'::jsonb),
      'materiais_impacto', jsonb_build_object(
        'top_valor', coalesce((
          select jsonb_agg(to_jsonb(q) order by q.verba_recomendada desc)
          from (
            select
              material_id,
              nome,
              fabricante,
              grupo_material,
              valor_saida_base as gasto_historico_12m,
              consumo_previsto_qtd,
              estoque_utilizavel_qtd,
              pedidos_abertos_qtd,
              quantidade_necessaria_qtd,
              preco_atual,
              reajuste_material,
              round((preco_atual * (1 + reajuste_material))::numeric, 2) as preco_futuro,
              reajuste_valor,
              round((valor_com_reajuste * (1 + v_contingencia))::numeric, 2) as verba_recomendada
            from financeiro
            where quantidade_necessaria_qtd > 0
            order by valor_com_reajuste desc
            limit 10
          ) q
        ), '[]'::jsonb),
        'top_risco', coalesce((
          select jsonb_agg(to_jsonb(q) order by q.cobertura_dias asc nulls first, q.verba_recomendada desc)
          from (
            select
              material_id,
              nome,
              fabricante,
              grupo_material,
              cobertura_dias,
              valor_saida_base as gasto_historico_12m,
              consumo_previsto_qtd,
              estoque_utilizavel_qtd,
              quantidade_necessaria_qtd,
              preco_atual,
              reajuste_material,
              round((preco_atual * (1 + reajuste_material))::numeric, 2) as preco_futuro,
              round((valor_com_reajuste * (1 + v_contingencia))::numeric, 2) as verba_recomendada
            from financeiro
            where quantidade_necessaria_qtd > 0
            order by cobertura_dias asc nulls first, valor_com_reajuste desc
            limit 10
          ) q
        ), '[]'::jsonb),
        'top_reajuste', coalesce((
          select jsonb_agg(to_jsonb(q) order by q.reajuste_valor desc)
          from (
            select
              material_id,
              nome,
              fabricante,
              grupo_material,
              valor_saida_base as gasto_historico_12m,
              consumo_previsto_qtd,
              estoque_utilizavel_qtd,
              reajuste_material,
              reajuste_valor,
              quantidade_necessaria_qtd,
              preco_atual,
              round((preco_atual * (1 + reajuste_material))::numeric, 2) as preco_futuro,
              round((valor_com_reajuste * (1 + v_contingencia))::numeric, 2) as verba_recomendada
            from financeiro
            where reajuste_valor > 0
            order by reajuste_valor desc
            limit 10
          ) q
        ), '[]'::jsonb),
        'reducao_orcamento', coalesce((
          select jsonb_agg(to_jsonb(q) order by q.potencial_reducao_valor desc)
          from (
            select
              material_id,
              nome,
              fabricante,
              grupo_material,
              valor_saida_base as gasto_historico_12m,
              estoque_utilizavel_qtd,
              consumo_previsto_qtd,
              potencial_reducao_qtd,
              potencial_reducao_valor,
              preco_atual,
              reajuste_material,
              round((preco_atual * (1 + reajuste_material))::numeric, 2) as preco_futuro
            from financeiro
            where potencial_reducao_valor > 0
            order by potencial_reducao_valor desc
            limit 10
          ) q
        ), '[]'::jsonb)
      )
    )
    from resumo_base rb
  );
end;
$$;


revoke all on function public.rpc_orcamento_compra_12m_calcular(text, text, jsonb) from public;
grant execute on function public.rpc_orcamento_compra_12m_calcular(text, text, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
