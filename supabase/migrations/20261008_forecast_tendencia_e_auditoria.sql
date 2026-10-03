-- Auditoria do forecast: fator de tendencia e acuracia sem meses realizados.
--
-- 1) Fator de tendencia (rpc_previsao_gasto_mensal_calcular e _calcular_periodo).
--    Antes: a inclinacao vinha de regr_slope(valor_saida, epoch), em R$ por SEGUNDO, e era multiplicada
--    por 30 * 6 como se fosse por dia. O termo ficava perto de zero e o fator virava sempre
--    0,6 * (ultimos 3m / anteriores 3m) + 0,4.
--    Depois: a regressao usa o indice do mes (R$ por mes) e projeta 6 meses. Como a inclinacao real pode
--    deixar o termo negativo, o fator calculado fica limitado entre 0,5 e 1,5; o fator informado em
--    p_fator_tendencia continua sem limite. Se os ultimos 3 meses nao tem saida, o termo da inclinacao
--    vale 1 (antes o fator ficava nulo e a previsao mensal tambem).
--    As duas funcoes sao copias de 20260423_fix_forecast_snapshot_versioning.sql com so essa troca e voltam
--    a ter search_path fixo (definido em 20260214_fix_search_path_and_extensions.sql e perdido quando foram
--    recriadas em 20260423). Snapshots ja gravados nao sao recalculados: a auditoria compara o que foi
--    previsto na epoca.
--
-- 2) Auditoria (_rpc_previsao_gasto_mensal_auditar_impl).
--    Antes: sem nenhum mes realizado, acuracia_wape/acuracia_mape voltavam 0 (coalesce(wape, 100)), lido
--    na tela como "0% de acuracia".
--    Depois: voltam null. Copia de 20260423_add_forecast_audit_and_purchase_rpcs.sql (renomeada para _impl
--    em 20260926_secure_forecast_purchase_rpcs.sql) com so essa troca; a RPC publica nao muda.

create or replace function public.rpc_previsao_gasto_mensal_calcular(
  p_owner_id uuid,
  p_fator_tendencia numeric default null
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_base_fim date;
  v_base_inicio date;
  v_prev_inicio date;
  v_prev_fim date;
  v_meses int := 0;
  v_media numeric := 0;
  v_media_entrada numeric := 0;
  v_fator numeric := 1;
  v_tipo_tendencia text := 'estavel';
  v_metodo text := 'sazonal';
  v_prev_year_total numeric := 0;
  v_variacao numeric := 0;
  v_forecast_id uuid;
  v_open_inicio date;
begin
  perform public.rpc_refresh_gasto_mensal(p_owner_id);

  select max(ano_mes) into v_base_fim
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and (valor_saida > 0 or valor_entrada > 0);

  if v_base_fim is null then
    v_base_fim := (date_trunc('month', now()) - interval '1 day')::date;
  end if;

  select periodo_base_inicio into v_open_inicio
  from public.inventory_forecast
  where account_owner_id = p_owner_id
    and qtd_meses_base < 12
  order by created_at desc
  limit 1;

  if v_open_inicio is null then
    v_base_inicio := (date_trunc('month', v_base_fim) - interval '11 months')::date;
  else
    v_base_inicio := v_open_inicio;
  end if;

  v_prev_inicio := (date_trunc('month', v_base_fim) + interval '1 month')::date;
  v_prev_fim := (date_trunc('month', v_prev_inicio) + interval '11 months')::date;

  select count(*) into v_meses
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim
    and (valor_saida > 0 or valor_entrada > 0);

  if v_meses < 6 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsAvailable', v_meses,
      'requiredMonths', 6,
      'requiredMonthsFull', 12,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim
    );
  end if;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_base_inicio, v_base_fim, interval '1 month') gs
  ),
  base as (
    select
      m.ano_mes,
      coalesce(a.valor_saida, 0) as valor_saida,
      coalesce(a.valor_entrada, 0) as valor_entrada
    from meses m
    left join public.agg_gasto_mensal a
      on a.account_owner_id = p_owner_id
     and a.ano_mes = m.ano_mes
  ),
  serie as (
    select
      ano_mes,
      valor_saida
    from base
  ),
  suavizado as (
    select
      ano_mes,
      valor_saida,
      valor_entrada,
      avg(valor_saida) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m,
      avg(valor_entrada) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m_entrada
    from base
  ),
  stats as (
    select
      (select valor_saida from serie order by ano_mes desc limit 1) as ultimo_mes,
      avg(media_3m)::numeric as media_suave,
      avg(media_3m_entrada)::numeric as media_suave_entrada
    from suavizado
  )
  select
    coalesce((select avg(valor_saida) from base), 0),
    coalesce((select avg(valor_entrada) from base), 0),
    1
  into v_media, v_media_entrada, v_fator
  from stats;

  with base_tendencia as (
    select
      ano_mes,
      valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_base_inicio and v_base_fim
  ),
  tendencias as (
    select
      avg(case when ano_mes between (v_base_fim - interval '2 months')::date and v_base_fim then valor_saida end) as ultimos_3m,
      avg(case when ano_mes between (v_base_fim - interval '5 months')::date and (v_base_fim - interval '3 months')::date then valor_saida end) as anteriores_3m,
      regr_slope(valor_saida, extract(year from ano_mes) * 12 + extract(month from ano_mes)) as slope_mensal
    from base_tendencia
    where ano_mes >= (v_base_fim - interval '6 months')::date
  )
  select
    case
      when p_fator_tendencia is not null then p_fator_tendencia
      when anteriores_3m > 0 then
        -- Limite 0,5..1,5: com a inclinacao em R$/mes o termo fica negativo quando os ultimos meses despencam.
        greatest(0.5, least(1.5,
          0.6 * (ultimos_3m / anteriores_3m) +
          0.4 * (1 + coalesce(slope_mensal * 6 / nullif(ultimos_3m, 0), 0))
        ))
      else 1
    end
  into v_fator
  from tendencias;

  select coalesce(sum(valor_saida), 0) into v_prev_year_total
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date;

  if v_prev_year_total <= 0 then
    v_variacao := 0;
    v_tipo_tendencia := 'sem_base';
  else
    v_variacao := round(((round(v_media * v_fator * 12, 2) - v_prev_year_total) / v_prev_year_total) * 100, 2);
    if v_variacao >= 2 then
      v_tipo_tendencia := 'subida';
    elsif v_variacao <= -2 then
      v_tipo_tendencia := 'queda';
    else
      v_tipo_tendencia := 'estavel';
    end if;
  end if;

  insert into public.inventory_forecast (
    account_owner_id,
    periodo_base_inicio,
    periodo_base_fim,
    qtd_meses_base,
    gasto_total_periodo,
    media_mensal,
    fator_tendencia,
    tipo_tendencia,
    variacao_percentual,
    previsao_anual,
    previsao_anual_entrada,
    previsao_anual_saida,
    previsao_anual_saldo,
    gasto_ano_anterior,
    metodo_previsao,
    nivel_confianca,
    created_at
  )
  select
    p_owner_id,
    v_base_inicio,
    v_base_fim,
    (select count(*) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between v_base_inicio and v_base_fim and (valor_saida > 0 or valor_entrada > 0)),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between v_base_inicio and v_base_fim),
    v_media,
    v_fator,
    v_tipo_tendencia,
    v_variacao,
    round(v_media * v_fator * 12, 2),
    round(v_media_entrada * v_fator * 12, 2),
    round(v_media * v_fator * 12, 2),
    round((v_media_entrada - v_media) * v_fator * 12, 2),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date),
    v_metodo,
    'medio',
    now()
  on conflict (account_owner_id, periodo_base_inicio) do update
    set periodo_base_fim = excluded.periodo_base_fim,
        qtd_meses_base = excluded.qtd_meses_base,
        gasto_total_periodo = excluded.gasto_total_periodo,
        media_mensal = excluded.media_mensal,
        fator_tendencia = excluded.fator_tendencia,
        tipo_tendencia = excluded.tipo_tendencia,
        variacao_percentual = excluded.variacao_percentual,
        previsao_anual = excluded.previsao_anual,
        previsao_anual_entrada = excluded.previsao_anual_entrada,
        previsao_anual_saida = excluded.previsao_anual_saida,
        previsao_anual_saldo = excluded.previsao_anual_saldo,
        gasto_ano_anterior = excluded.gasto_ano_anterior,
        metodo_previsao = excluded.metodo_previsao,
        nivel_confianca = excluded.nivel_confianca,
        created_at = excluded.created_at
  returning id into v_forecast_id;

  delete from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and inventory_forecast_id = v_forecast_id;

  insert into public.f_previsao_gasto_mensal (
    account_owner_id,
    ano_mes,
    valor_previsto,
    valor_previsto_entrada,
    metodo,
    cenario,
    inventory_forecast_id,
    contingencia_p75,
    p90,
    mediana,
    coef_var,
    media_robusta,
    alerta_volatil,
    created_at,
    updated_at
  )
  select
    p_owner_id,
    prev.ano_mes,
    round(v_media * fator.fator_sazonal * v_fator, 2) as valor_previsto,
    round(v_media_entrada * fator.fator_sazonal_entrada * v_fator, 2) as valor_previsto_entrada,
    v_metodo,
    'base',
    v_forecast_id,
    coalesce(stats.p75, 0),
    coalesce(stats.p90, 0),
    coalesce(stats.mediana, 0),
    coalesce(stats.coef_var, 0),
    coalesce(stats.media_robusta, 0),
    coalesce(stats.coef_var, 0) > 1,
    now(),
    now()
  from (
    select date_trunc('month', gs)::date as ano_mes,
           extract(month from gs)::int as mes_ref
    from generate_series(v_prev_inicio, v_prev_fim, interval '1 month') gs
  ) prev
  join (
    with meses as (
      select date_trunc('month', gs)::date as ano_mes
      from generate_series(v_base_inicio, v_base_fim, interval '1 month') gs
    ),
    base as (
      select
        m.ano_mes,
        coalesce(a.valor_saida, 0) as valor_saida,
        coalesce(a.valor_entrada, 0) as valor_entrada
      from meses m
      left join public.agg_gasto_mensal a
        on a.account_owner_id = p_owner_id
       and a.ano_mes = m.ano_mes
    ),
    suavizado as (
      select
        ano_mes,
        avg(valor_saida) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m,
        avg(valor_entrada) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m_entrada
      from base
    ),
    fatores as (
      select
        extract(month from ano_mes)::int as mes_ref,
        avg(media_3m)::numeric as media_mes,
        avg(media_3m_entrada)::numeric as media_mes_entrada
      from suavizado
      group by 1
    ),
    media_total as (
      select
        avg(media_3m)::numeric as media_geral,
        avg(media_3m_entrada)::numeric as media_geral_entrada
      from suavizado
    )
    select
      fatores.mes_ref,
      case
        when media_total.media_geral is null or media_total.media_geral = 0 then 1
        else fatores.media_mes / media_total.media_geral
      end as fator_sazonal,
      case
        when media_total.media_geral_entrada is null or media_total.media_geral_entrada = 0 then 1
        else fatores.media_mes_entrada / media_total.media_geral_entrada
      end as fator_sazonal_entrada
    from fatores, media_total
  ) fator on fator.mes_ref = prev.mes_ref
  left join (
    with todos_meses as (
      select generate_series(1, 12) as mes_ref
    ),
    hist_completo as (
      select
        extract(month from ano_mes)::int as mes_ref,
        valor_saida,
        row_number() over (partition by extract(month from ano_mes) order by ano_mes desc) as recencia
      from public.agg_gasto_mensal
      where account_owner_id = p_owner_id
        and valor_saida > 0
    ),
    dados_por_mes as (
      select
        tm.mes_ref,
        array_agg(h.valor_saida order by h.recencia) as valores,
        count(h.valor_saida) as qtd,
        avg(h.valor_saida) as media_simples
      from todos_meses tm
      left join hist_completo h on h.mes_ref = tm.mes_ref
      group by tm.mes_ref
    ),
    base_stats as (
      select
        mes_ref,
        case
          when qtd >= 3 then (select percentile_cont(0.5) within group (order by unnest) from unnest(valores))
          when qtd >= 1 then media_simples
          else 0
        end as mediana,
        case
          when qtd >= 4 then (select percentile_cont(0.75) within group (order by unnest) from unnest(valores))
          when qtd >= 2 then media_simples * 1.25
          else 0
        end as p75,
        case
          when qtd >= 5 then (select percentile_cont(0.9) within group (order by unnest) from unnest(valores))
          when qtd >= 3 then media_simples * 1.5
          else 0
        end as p90,
        media_simples as media,
        case when qtd >= 2 then (select stddev_pop(unnest) from unnest(valores)) else 0 end as desvio,
        qtd
      from dados_por_mes
    ),
    stats_com_cv as (
      select
        mes_ref,
        mediana,
        p75,
        p90,
        media,
        desvio,
        qtd,
        case when media > 0 and qtd >= 2 then desvio / media else 0 end as coef_var
      from base_stats
    )
    select
      mes_ref,
      mediana,
      p75,
      p90,
      coef_var,
      case when qtd >= 3 then (mediana * 0.7 + media * 0.3) else media end as media_robusta
    from stats_com_cv
  ) stats on stats.mes_ref = prev.mes_ref;

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;

create or replace function public.rpc_previsao_gasto_mensal_calcular_periodo(
  p_owner_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_fator_tendencia numeric default null
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_base_inicio date;
  v_base_fim date;
  v_periodo_usado_inicio date;
  v_periodo_usado_fim date;
  v_prev_inicio date;
  v_prev_fim date;
  v_meses int := 0;
  v_meses_com_movimento int := 0;
  v_used_meses int := 0;
  v_media numeric := 0;
  v_media_entrada numeric := 0;
  v_fator numeric := 1;
  v_metodo text := 'sazonal';
  v_nivel_confianca text := 'alto';
  v_seq_meses int := 0;
  v_seq_inicio date;
  v_seq_fim date;
  v_forecast_id uuid;
begin
  perform public.rpc_refresh_gasto_mensal(p_owner_id);

  v_base_inicio := date_trunc('month', p_periodo_inicio)::date;
  v_base_fim := date_trunc('month', p_periodo_fim)::date;

  if v_base_inicio is null or v_base_fim is null or v_base_inicio > v_base_fim then
    return jsonb_build_object(
      'status', 'invalid_period',
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim
    );
  end if;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_base_inicio, v_base_fim, interval '1 month') gs
  ),
  base as (
    select
      m.ano_mes,
      coalesce(a.valor_saida, 0) as valor_saida,
      coalesce(a.valor_entrada, 0) as valor_entrada,
      case
        when coalesce(a.valor_saida, 0) > 0 or coalesce(a.valor_entrada, 0) > 0 then 1
        else 0
      end as tem_movimento
    from meses m
    left join public.agg_gasto_mensal a
      on a.account_owner_id = p_owner_id
     and a.ano_mes = m.ano_mes
  ),
  grp as (
    select *,
           (ano_mes - (row_number() over(order by ano_mes) * interval '1 month')) as g
    from base
    where tem_movimento = 1
  ),
  seq as (
    select min(ano_mes) as seq_inicio,
           max(ano_mes) as seq_fim,
           count(*) as seq_meses
    from grp
    group by g
  ),
  resumo as (
    select
      count(*) as meses_span,
      count(*) filter (where tem_movimento = 1) as meses_com_movimento
    from base
  ),
  melhor as (
    select seq_meses, seq_inicio, seq_fim
    from seq
    order by seq_fim desc, seq_meses desc
    limit 1
  )
  select
    resumo.meses_span,
    resumo.meses_com_movimento,
    melhor.seq_meses,
    melhor.seq_inicio,
    melhor.seq_fim
  into
    v_meses,
    v_meses_com_movimento,
    v_seq_meses,
    v_seq_inicio,
    v_seq_fim
  from resumo
  left join melhor on true;

  if v_seq_meses is null then
    v_seq_meses := 0;
  end if;

  v_used_meses := least(12, v_seq_meses);

  if v_used_meses < 6 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsSpan', v_meses,
      'monthsWithMovement', v_meses_com_movimento,
      'requiredMonths', 6,
      'requiredMonthsFull', 12,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim,
      'usedMonths', v_used_meses
    );
  end if;

  v_periodo_usado_fim := v_seq_fim;
  v_periodo_usado_inicio := (v_seq_fim - interval '1 month' * (v_used_meses - 1))::date;

  if v_used_meses <= 7 then
    v_nivel_confianca := 'baixo';
  elsif v_used_meses <= 10 then
    v_nivel_confianca := 'medio';
  else
    v_nivel_confianca := 'alto';
  end if;

  v_prev_inicio := (date_trunc('month', v_periodo_usado_fim) + interval '1 month')::date;
  v_prev_fim := (date_trunc('month', v_prev_inicio) + interval '11 months')::date;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_periodo_usado_inicio, v_periodo_usado_fim, interval '1 month') gs
  ),
  base as (
    select
      m.ano_mes,
      coalesce(a.valor_saida, 0) as valor_saida,
      coalesce(a.valor_entrada, 0) as valor_entrada
    from meses m
    left join public.agg_gasto_mensal a
      on a.account_owner_id = p_owner_id
     and a.ano_mes = m.ano_mes
  )
  select
    coalesce(avg(valor_saida), 0),
    coalesce(avg(valor_entrada), 0)
  into v_media, v_media_entrada
  from base;

  with base_tendencia as (
    select
      ano_mes,
      valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_periodo_usado_inicio and v_periodo_usado_fim
  ),
  tendencias as (
    select
      avg(case when ano_mes between (v_periodo_usado_fim - interval '2 months')::date and v_periodo_usado_fim then valor_saida end) as ultimos_3m,
      avg(case when ano_mes between (v_periodo_usado_fim - interval '5 months')::date and (v_periodo_usado_fim - interval '3 months')::date then valor_saida end) as anteriores_3m,
      regr_slope(valor_saida, extract(year from ano_mes) * 12 + extract(month from ano_mes)) as slope_mensal
    from base_tendencia
    where ano_mes >= (v_periodo_usado_fim - interval '6 months')::date
  )
  select
    case
      when p_fator_tendencia is not null then p_fator_tendencia
      when anteriores_3m > 0 then
        -- Limite 0,5..1,5: com a inclinacao em R$/mes o termo fica negativo quando os ultimos meses despencam.
        greatest(0.5, least(1.5,
          0.6 * (ultimos_3m / anteriores_3m) +
          0.4 * (1 + coalesce(slope_mensal * 6 / nullif(ultimos_3m, 0), 0))
        ))
      else 1
    end
  into v_fator
  from tendencias;

  insert into public.inventory_forecast (
    account_owner_id,
    periodo_base_inicio,
    periodo_base_fim,
    qtd_meses_base,
    gasto_total_periodo,
    media_mensal,
    fator_tendencia,
    tipo_tendencia,
    variacao_percentual,
    previsao_anual,
    previsao_anual_entrada,
    previsao_anual_saida,
    previsao_anual_saldo,
    gasto_ano_anterior,
    metodo_previsao,
    nivel_confianca,
    created_at
  )
  select
    p_owner_id,
    v_periodo_usado_inicio,
    v_periodo_usado_fim,
    v_used_meses,
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between v_periodo_usado_inicio and v_periodo_usado_fim),
    v_media,
    v_fator,
    case
      when (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date) <= 0
        then 'sem_base'
      when round(
        (
          (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
          /
          nullif((select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date), 0)
        ) * 100, 2) >= 2
        then 'subida'
      when round(
        (
          (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
          /
          nullif((select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date), 0)
        ) * 100, 2) <= -2
        then 'queda'
      else 'estavel'
    end,
    case
      when (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date) <= 0
        then 0
      else round(
        (
          (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
          /
          nullif((select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date), 0)
        ) * 100, 2)
    end,
    round(v_media * v_fator * 12, 2),
    round(v_media_entrada * v_fator * 12, 2),
    round(v_media * v_fator * 12, 2),
    round((v_media_entrada - v_media) * v_fator * 12, 2),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date),
    v_metodo,
    v_nivel_confianca,
    now()
  on conflict (account_owner_id, periodo_base_inicio, periodo_base_fim) do update
    set qtd_meses_base = excluded.qtd_meses_base,
        gasto_total_periodo = excluded.gasto_total_periodo,
        media_mensal = excluded.media_mensal,
        fator_tendencia = excluded.fator_tendencia,
        tipo_tendencia = excluded.tipo_tendencia,
        variacao_percentual = excluded.variacao_percentual,
        previsao_anual = excluded.previsao_anual,
        previsao_anual_entrada = excluded.previsao_anual_entrada,
        previsao_anual_saida = excluded.previsao_anual_saida,
        previsao_anual_saldo = excluded.previsao_anual_saldo,
        gasto_ano_anterior = excluded.gasto_ano_anterior,
        metodo_previsao = excluded.metodo_previsao,
        nivel_confianca = excluded.nivel_confianca,
        created_at = excluded.created_at
  returning id into v_forecast_id;

  delete from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and inventory_forecast_id = v_forecast_id;

  insert into public.f_previsao_gasto_mensal (
    account_owner_id,
    ano_mes,
    valor_previsto,
    valor_previsto_entrada,
    metodo,
    cenario,
    inventory_forecast_id,
    contingencia_p75,
    p90,
    mediana,
    coef_var,
    media_robusta,
    alerta_volatil,
    created_at,
    updated_at
  )
  select
    p_owner_id,
    prev.ano_mes,
    round(v_media * fator.fator_sazonal * v_fator, 2) as valor_previsto,
    round(v_media_entrada * fator.fator_sazonal_entrada * v_fator, 2) as valor_previsto_entrada,
    v_metodo,
    'base',
    v_forecast_id,
    coalesce(stats.p75, 0),
    coalesce(stats.p90, 0),
    coalesce(stats.mediana, 0),
    coalesce(stats.coef_var, 0),
    coalesce(stats.media_robusta, 0),
    coalesce(stats.coef_var, 0) > 1,
    now(),
    now()
  from (
    select date_trunc('month', gs)::date as ano_mes,
           extract(month from gs)::int as mes_ref
    from generate_series(v_prev_inicio, v_prev_fim, interval '1 month') gs
  ) prev
  join (
    with meses as (
      select date_trunc('month', gs)::date as ano_mes
      from generate_series(v_periodo_usado_inicio, v_periodo_usado_fim, interval '1 month') gs
    ),
    base as (
      select
        m.ano_mes,
        coalesce(a.valor_saida, 0) as valor_saida,
        coalesce(a.valor_entrada, 0) as valor_entrada
      from meses m
      left join public.agg_gasto_mensal a
        on a.account_owner_id = p_owner_id
       and a.ano_mes = m.ano_mes
    ),
    suavizado as (
      select
        ano_mes,
        avg(valor_saida) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m,
        avg(valor_entrada) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m_entrada
      from base
    ),
    fatores as (
      select
        extract(month from ano_mes)::int as mes_ref,
        avg(media_3m)::numeric as media_mes,
        avg(media_3m_entrada)::numeric as media_mes_entrada
      from suavizado
      group by 1
    ),
    media_total as (
      select
        avg(media_3m)::numeric as media_geral,
        avg(media_3m_entrada)::numeric as media_geral_entrada
      from suavizado
    )
    select
      fatores.mes_ref,
      case
        when media_total.media_geral is null or media_total.media_geral = 0 then 1
        else fatores.media_mes / media_total.media_geral
      end as fator_sazonal,
      case
        when media_total.media_geral_entrada is null or media_total.media_geral_entrada = 0 then 1
        else fatores.media_mes_entrada / media_total.media_geral_entrada
      end as fator_sazonal_entrada
    from fatores, media_total
  ) fator on fator.mes_ref = prev.mes_ref
  left join (
    with todos_meses as (
      select generate_series(1, 12) as mes_ref
    ),
    hist_completo as (
      select
        extract(month from ano_mes)::int as mes_ref,
        valor_saida,
        row_number() over (partition by extract(month from ano_mes) order by ano_mes desc) as recencia
      from public.agg_gasto_mensal
      where account_owner_id = p_owner_id
        and valor_saida > 0
    ),
    dados_por_mes as (
      select
        tm.mes_ref,
        array_agg(h.valor_saida order by h.recencia) as valores,
        count(h.valor_saida) as qtd,
        avg(h.valor_saida) as media_simples
      from todos_meses tm
      left join hist_completo h on h.mes_ref = tm.mes_ref
      group by tm.mes_ref
    ),
    base_stats as (
      select
        mes_ref,
        case
          when qtd >= 3 then (select percentile_cont(0.5) within group (order by unnest) from unnest(valores))
          when qtd >= 1 then media_simples
          else 0
        end as mediana,
        case
          when qtd >= 4 then (select percentile_cont(0.75) within group (order by unnest) from unnest(valores))
          when qtd >= 2 then media_simples * 1.25
          else 0
        end as p75,
        case
          when qtd >= 5 then (select percentile_cont(0.9) within group (order by unnest) from unnest(valores))
          when qtd >= 3 then media_simples * 1.5
          else 0
        end as p90,
        media_simples as media,
        case when qtd >= 2 then (select stddev_pop(unnest) from unnest(valores)) else 0 end as desvio,
        qtd
      from dados_por_mes
    ),
    stats_com_cv as (
      select
        mes_ref,
        mediana,
        p75,
        p90,
        media,
        desvio,
        qtd,
        case when media > 0 and qtd >= 2 then desvio / media else 0 end as coef_var
      from base_stats
    )
    select
      mes_ref,
      mediana,
      p75,
      p90,
      coef_var,
      case when qtd >= 3 then (mediana * 0.7 + media * 0.3) else media end as media_robusta
    from stats_com_cv
  ) stats on stats.mes_ref = prev.mes_ref;

  return jsonb_build_object(
    'status', 'ok',
    'forecast_id', v_forecast_id,
    'usedMonths', v_used_meses,
    'periodo_usado_inicio', v_periodo_usado_inicio,
    'periodo_usado_fim', v_periodo_usado_fim,
    'nivel_confianca', v_nivel_confianca,
    'resultado', public.rpc_previsao_gasto_mensal_consultar(p_owner_id)
  );
end;
$$;

-- Mesmo search_path perdido em 20260423; a funcao nao muda.
alter function public.rpc_previsao_gasto_mensal_consultar(uuid) set search_path = pg_catalog, public;

create or replace function public._rpc_previsao_gasto_mensal_auditar_impl(
  p_owner_id uuid,
  p_forecast_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forecast_id uuid;
  v_base_inicio date;
  v_base_fim date;
  v_created_at timestamptz;
begin
  select
    id,
    periodo_base_inicio,
    periodo_base_fim,
    created_at
  into
    v_forecast_id,
    v_base_inicio,
    v_base_fim,
    v_created_at
  from public.inventory_forecast
  where account_owner_id = p_owner_id
    and (p_forecast_id is null or id = p_forecast_id)
  order by
    case when id = p_forecast_id then 0 else 1 end,
    created_at desc
  limit 1;

  if v_forecast_id is null then
    return jsonb_build_object(
      'status', 'missing',
      'forecast_id', null,
      'resumo', jsonb_build_object(
        'meses_total', 0,
        'meses_realizados', 0,
        'meses_pendentes', 0
      ),
      'serie', '[]'::jsonb
    );
  end if;

  return (
    with ultimo_realizado as (
      select max(ano_mes) as ano_mes
      from public.agg_gasto_mensal
      where account_owner_id = p_owner_id
    ),
    comparativo as (
      select
        p.ano_mes,
        to_char(p.ano_mes, 'MM/YYYY') as label,
        round(coalesce(p.valor_previsto, 0)::numeric, 2) as valor_previsto,
        round(coalesce(p.valor_previsto_entrada, 0)::numeric, 2) as valor_previsto_entrada,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round(coalesce(a.valor_saida, 0)::numeric, 2)
          else null
        end as valor_realizado,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round((coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0))::numeric, 2)
          else null
        end as vies,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round(abs(coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0))::numeric, 2)
          else null
        end as erro_absoluto,
        case
          when ur.ano_mes is not null
            and p.ano_mes <= ur.ano_mes
            and coalesce(a.valor_saida, 0) > 0
            then round((((coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0)) / a.valor_saida) * 100)::numeric, 2)
          else null
        end as erro_percentual,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then 'realizado'
          else 'pendente'
        end as status
      from public.f_previsao_gasto_mensal p
      cross join ultimo_realizado ur
      left join public.agg_gasto_mensal a
        on a.account_owner_id = p_owner_id
       and a.ano_mes = p.ano_mes
      where p.account_owner_id = p_owner_id
        and p.inventory_forecast_id = v_forecast_id
        and p.cenario = 'base'
      order by p.ano_mes
    ),
    resumo as (
      select
        count(*) as meses_total,
        count(*) filter (where status = 'realizado') as meses_realizados,
        count(*) filter (where status = 'pendente') as meses_pendentes,
        round(coalesce(sum(valor_previsto) filter (where status = 'realizado'), 0)::numeric, 2) as total_previsto_realizado,
        round(coalesce(sum(valor_realizado), 0)::numeric, 2) as total_realizado,
        round(coalesce(sum(vies), 0)::numeric, 2) as vies_total,
        round(coalesce(sum(erro_absoluto), 0)::numeric, 2) as erro_absoluto_total,
        case
          when coalesce(sum(valor_realizado), 0) > 0
            then round(((sum(vies) / sum(valor_realizado)) * 100)::numeric, 2)
          else null
        end as vies_percentual,
        case
          when coalesce(sum(valor_realizado), 0) > 0
            then round(((sum(erro_absoluto) / sum(valor_realizado)) * 100)::numeric, 2)
          else null
        end as wape_percentual,
        case
          when count(*) filter (where status = 'realizado' and coalesce(valor_realizado, 0) > 0) > 0
            then round(
              coalesce(avg(abs(erro_percentual)) filter (where status = 'realizado' and coalesce(valor_realizado, 0) > 0), 0)::numeric,
              2
            )
          else null
        end as mape_percentual
      from comparativo
    )
    select jsonb_build_object(
      'status', 'ok',
      'forecast_id', v_forecast_id,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim,
      'created_at', v_created_at,
      'resumo', jsonb_build_object(
        'meses_total', r.meses_total,
        'meses_realizados', r.meses_realizados,
        'meses_pendentes', r.meses_pendentes,
        'total_previsto_realizado', r.total_previsto_realizado,
        'total_realizado', r.total_realizado,
        'vies_total', r.vies_total,
        'erro_absoluto_total', r.erro_absoluto_total,
        'vies_percentual', r.vies_percentual,
        'wape_percentual', r.wape_percentual,
        'mape_percentual', r.mape_percentual,
        'acuracia_wape', case when r.wape_percentual is null then null else greatest(0, round((100 - r.wape_percentual)::numeric, 2)) end,
        'acuracia_mape', case when r.mape_percentual is null then null else greatest(0, round((100 - r.mape_percentual)::numeric, 2)) end
      ),
      'serie', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'ano_mes', c.ano_mes,
            'label', c.label,
            'valor_previsto', c.valor_previsto,
            'valor_previsto_entrada', c.valor_previsto_entrada,
            'valor_realizado', c.valor_realizado,
            'vies', c.vies,
            'erro_absoluto', c.erro_absoluto,
            'erro_percentual', c.erro_percentual,
            'status', c.status
          ) order by c.ano_mes
        )
        from comparativo c
      ), '[]'::jsonb)
    )
    from resumo r
  );
end;
$$;

revoke all on function public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid) from public, anon, authenticated;
grant execute on function public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
