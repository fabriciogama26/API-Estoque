create or replace function public.rpc_previsao_gasto_mensal_consultar(p_owner_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_base_fim date;
  v_base_inicio date;
  v_prev_inicio date;
  v_prev_fim date;
  v_meses int := 0;
  v_total numeric := 0;
  v_media numeric := 0;
  v_media_entrada numeric := 0;
  v_prev_year_total numeric := 0;
  v_variacao numeric := 0;
  v_forecast_id uuid;
  v_tipo_tendencia text := 'estavel';
  v_prev_total numeric := 0;
  v_fator numeric := null;
  v_metodo text := null;
begin
  perform public.rpc_refresh_gasto_mensal(p_owner_id);

  select max(ano_mes) into v_base_fim
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and (valor_saida > 0 or valor_entrada > 0);

  if v_base_fim is null then
    v_base_fim := (date_trunc('month', now()) - interval '1 day')::date;
  end if;

  v_base_inicio := (date_trunc('month', v_base_fim) - interval '11 months')::date;
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

  select coalesce(sum(valor_saida), 0) into v_total
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim;

  select coalesce(avg(valor_saida), 0) into v_media
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim;

  select coalesce(sum(valor_saida), 0) into v_prev_year_total
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date;

  if v_prev_year_total > 0 then
    v_variacao := (v_total - v_prev_year_total) / v_prev_year_total;
  end if;

  select coalesce(sum(valor_previsto), 0), max(metodo) into v_prev_total, v_metodo
  from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and cenario = 'base'
    and ano_mes between v_prev_inicio and v_prev_fim;

  select fator_tendencia into v_fator
  from public.inventory_forecast
  where account_owner_id = p_owner_id
  order by created_at desc
  limit 1;

  if v_prev_year_total <= 0 then
    v_variacao := 0;
    v_tipo_tendencia := 'sem_base';
    v_metodo := coalesce(v_metodo, 'media_simples');
  else
    v_variacao := round(((v_prev_total - v_prev_year_total) / v_prev_year_total) * 100, 2);
    if v_variacao >= 2 then
      v_tipo_tendencia := 'subida';
    elsif v_variacao <= -2 then
      v_tipo_tendencia := 'queda';
    else
      v_tipo_tendencia := 'estavel';
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'periodo_base_inicio', v_base_inicio,
    'periodo_base_fim', v_base_fim,
    'meses_base', 12,
    'gasto_total_periodo', v_total,
    'media_mensal', v_media,
    'gasto_ano_anterior', v_prev_year_total,
    'variacao_percentual', coalesce(v_variacao, 0),
    'previsao_total', v_prev_total,
    'metodo_previsao', v_metodo,
    'fator_tendencia', v_fator,
    'tipo_tendencia', v_tipo_tendencia,
    'historico', (
      select jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'label', to_char(ano_mes, 'MM/YYYY'),
          'valor_saida', valor_saida,
          'valor_entrada', valor_entrada,
          'media_movel', media_movel
        ) order by ano_mes
      )
      from (
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
        )
        select
          ano_mes,
          valor_saida,
          valor_entrada,
          round(avg(valor_saida) over (order by ano_mes rows between 2 preceding and current row), 2) as media_movel
        from base
      ) serie
    ),
    'previsao', (
      select jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'label', to_char(ano_mes, 'MM/YYYY'),
          'valor_previsto', valor_previsto,
          'metodo', metodo,
          'cenario', cenario
        ) order by ano_mes
      )
      from public.f_previsao_gasto_mensal
      where account_owner_id = p_owner_id
        and cenario = 'base'
        and ano_mes between v_prev_inicio and v_prev_fim
    )
  );
end;
$$;

create or replace function public.rpc_previsao_gasto_mensal_calcular(p_owner_id uuid, p_fator_tendencia numeric default null)
returns jsonb
language plpgsql
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
  v_forecast_existente int := 0;
  v_forecast_id uuid;
  v_open_inicio date;
  v_ultimo_mes numeric := 0;
  v_media_ult3 numeric := 0;
  v_media_6_atras numeric := 0;
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

  -- recalcula sempre para atualizar o forecast aberto

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
      valor_saida,
      row_number() over (order by ano_mes) as t
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
    coalesce(ultimo_mes, 0),
    1
  into v_media, v_media_entrada, v_ultimo_mes, v_fator
  from stats;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_base_inicio, v_base_fim, interval '1 month') gs
  ),
  base as (
    select
      m.ano_mes,
      coalesce(a.valor_saida, 0) as valor_saida
    from meses m
    left join public.agg_gasto_mensal a
      on a.account_owner_id = p_owner_id
     and a.ano_mes = m.ano_mes
  )
  select
    coalesce(avg(case when ano_mes between (v_base_fim - interval '2 months')::date and v_base_fim then valor_saida end), 0),
    coalesce(avg(case when ano_mes between (v_base_fim - interval '8 months')::date and (v_base_fim - interval '6 months')::date then valor_saida end), 0)
  into v_media_ult3, v_media_6_atras
  from base;

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
      regr_slope(valor_saida, extract(epoch from ano_mes)) as slope
    from base_tendencia
    where ano_mes >= (v_base_fim - interval '6 months')::date
  )
  select
    case
      when anteriores_3m > 0 then
        0.6 * (ultimos_3m / anteriores_3m) +
        0.4 * (1 + (slope * 30 * 6 / nullif(ultimos_3m, 0)))
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
  ) stats on stats.mes_ref = prev.mes_ref
  on conflict (account_owner_id, ano_mes, cenario) do update
    set valor_previsto = excluded.valor_previsto,
        valor_previsto_entrada = excluded.valor_previsto_entrada,
        metodo = excluded.metodo,
        inventory_forecast_id = excluded.inventory_forecast_id,
        contingencia_p75 = excluded.contingencia_p75,
        p90 = excluded.p90,
        mediana = excluded.mediana,
        coef_var = excluded.coef_var,
        media_robusta = excluded.media_robusta,
        alerta_volatil = excluded.alerta_volatil,
        updated_at = now();

  update public.f_previsao_gasto_mensal
  set inventory_forecast_id = v_forecast_id
  where account_owner_id = p_owner_id
    and inventory_forecast_id is null
    and ano_mes between v_prev_inicio and v_prev_fim;

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;
