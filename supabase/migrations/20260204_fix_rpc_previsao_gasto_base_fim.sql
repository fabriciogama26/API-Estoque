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
      coalesce(a.valor_saida, 0) as valor_saida
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
      avg(valor_saida) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m
    from serie
  ),
  stats as (
    select
      avg(valor_saida)::numeric as media,
      (select valor_saida from serie order by ano_mes desc limit 1) as ultimo_mes,
      avg(media_3m)::numeric as media_suave
    from suavizado
  )
  select
    coalesce(media, 0),
    coalesce(ultimo_mes, 0),
    1
  into v_media, v_ultimo_mes, v_fator
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

  if v_media_6_atras > 0 then
    v_fator := round(v_media_ult3 / v_media_6_atras, 4);
  else
    v_fator := 1;
  end if;

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
        gasto_ano_anterior = excluded.gasto_ano_anterior,
        metodo_previsao = excluded.metodo_previsao,
        nivel_confianca = excluded.nivel_confianca,
        created_at = excluded.created_at
  returning id into v_forecast_id;

  insert into public.f_previsao_gasto_mensal (
    account_owner_id,
    ano_mes,
    valor_previsto,
    metodo,
    cenario,
    inventory_forecast_id,
    created_at,
    updated_at
  )
  select
    p_owner_id,
    prev.ano_mes,
    round(v_media * fator.fator_sazonal * v_fator, 2) as valor_previsto,
    v_metodo,
    'base',
    v_forecast_id,
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
        coalesce(a.valor_saida, 0) as valor_saida
      from meses m
      left join public.agg_gasto_mensal a
        on a.account_owner_id = p_owner_id
       and a.ano_mes = m.ano_mes
    ),
    suavizado as (
      select
        ano_mes,
        avg(valor_saida) over (order by ano_mes rows between 1 preceding and 1 following) as media_3m
      from base
    ),
    fatores as (
      select
        extract(month from ano_mes)::int as mes_ref,
        avg(media_3m)::numeric as media_mes
      from suavizado
      group by 1
    ),
    media_total as (
      select avg(media_3m)::numeric as media_geral
      from suavizado
    )
    select
      fatores.mes_ref,
      case
        when media_total.media_geral is null or media_total.media_geral = 0 then 1
        else fatores.media_mes / media_total.media_geral
      end as fator_sazonal
    from fatores, media_total
  ) fator on fator.mes_ref = prev.mes_ref
  on conflict (account_owner_id, ano_mes, cenario) do update
    set valor_previsto = excluded.valor_previsto,
        metodo = excluded.metodo,
        inventory_forecast_id = excluded.inventory_forecast_id,
        updated_at = now();

  update public.f_previsao_gasto_mensal
  set inventory_forecast_id = v_forecast_id
  where account_owner_id = p_owner_id
    and inventory_forecast_id is null
    and ano_mes between v_prev_inicio and v_prev_fim;

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;
