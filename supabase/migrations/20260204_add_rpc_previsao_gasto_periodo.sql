create or replace function public.rpc_previsao_gasto_mensal_calcular_periodo(
  p_owner_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_fator_tendencia numeric default null
)
returns jsonb
language plpgsql
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
  v_fator numeric := 1;
  v_metodo text := 'sazonal';
  v_forecast_existente int := 0;
  v_nivel_confianca text := 'alto';
  v_seq_meses int := 0;
  v_seq_inicio date;
  v_seq_fim date;
  v_variacao_percentual numeric := 0;
  v_forecast_id uuid;
  v_ultimo_mes numeric := 0;
  v_media_ult3 numeric := 0;
  v_media_6_atras numeric := 0;
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
    select m.ano_mes,
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

  select count(*) into v_forecast_existente
  from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and cenario = 'base'
    and ano_mes between v_prev_inicio and v_prev_fim;

  if v_forecast_existente = 12 then
    return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
  end if;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_periodo_usado_inicio, v_periodo_usado_fim, interval '1 month') gs
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
      valor_saida
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
    from generate_series(v_periodo_usado_inicio, v_periodo_usado_fim, interval '1 month') gs
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
    coalesce(avg(case when ano_mes between (v_periodo_usado_fim - interval '2 months')::date and v_periodo_usado_fim then valor_saida end), 0),
    coalesce(avg(case when ano_mes between (v_periodo_usado_fim - interval '8 months')::date and (v_periodo_usado_fim - interval '6 months')::date then valor_saida end), 0)
  into v_media_ult3, v_media_6_atras
  from base;

  if v_media_6_atras > 0 then
    v_fator := round(v_media_ult3 / v_media_6_atras, 4);
  else
    v_fator := 1;
  end if;

  -- tipo_tendencia sera calculada com base na variacao_percentual

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
    v_periodo_usado_inicio,
    v_periodo_usado_fim,
    v_used_meses,
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between v_periodo_usado_inicio and v_periodo_usado_fim),
    v_media,
    v_fator,
    (
      case
        when (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date) <= 0
          then 'sem_base'
        else
          case
            when round(
              (
                (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
                /
                (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date)
              ) * 100, 2) >= 2
              then 'subida'
            when round(
              (
                (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
                /
                (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date)
              ) * 100, 2) <= -2
              then 'queda'
            else 'estavel'
          end
      end
    ),
    (
      case
        when (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date) <= 0
          then 0
        else round(
          (
            (round(v_media * v_fator * 12, 2) - (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date))
            /
            (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date)
          ) * 100, 2)
      end
    ),
    round(v_media * v_fator * 12, 2),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_periodo_usado_inicio - interval '12 months')::date and (v_periodo_usado_fim - interval '12 months')::date),
    v_metodo,
    v_nivel_confianca,
    now()
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
      from generate_series(v_periodo_usado_inicio, v_periodo_usado_fim, interval '1 month') gs
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

  return jsonb_build_object(
    'status', 'ok',
    'usedMonths', v_used_meses,
    'periodo_usado_inicio', v_periodo_usado_inicio,
    'periodo_usado_fim', v_periodo_usado_fim,
    'nivel_confianca', v_nivel_confianca,
    'resultado', public.rpc_previsao_gasto_mensal_consultar(p_owner_id)
  );
end;
$$;
