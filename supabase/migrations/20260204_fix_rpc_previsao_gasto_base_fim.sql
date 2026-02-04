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
  v_variacao numeric := null;
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

  if v_meses < 12 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsAvailable', v_meses,
      'requiredMonths', 12,
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

  select coalesce(max(fator_tendencia), null) into v_fator
  from public.inventory_forecast
  where account_owner_id = p_owner_id
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'status', 'ok',
    'periodo_base_inicio', v_base_inicio,
    'periodo_base_fim', v_base_fim,
    'meses_base', 12,
    'gasto_total_periodo', v_total,
    'media_mensal', v_media,
    'gasto_ano_anterior', v_prev_year_total,
    'variacao_percentual', v_variacao,
    'previsao_total', v_prev_total,
    'metodo_previsao', v_metodo,
    'fator_tendencia', v_fator,
    'historico', (
      select jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'label', to_char(ano_mes, 'MM/YYYY'),
          'valor_saida', valor_saida,
          'valor_entrada', valor_entrada,
          'media_movel', round(avg(valor_saida) over (order by ano_mes rows between 2 preceding and current row), 2)
        ) order by ano_mes
      )
      from public.agg_gasto_mensal
      where account_owner_id = p_owner_id
        and ano_mes between v_base_inicio and v_base_fim
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
  v_media_ultimos3 numeric := 0;
  v_media_prev3 numeric := 0;
  v_delta numeric := 0;
  v_tipo_tendencia text := 'estavel';
  v_metodo text := 'media_simples';
  v_forecast_existente int := 0;
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

  if v_meses < 12 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsAvailable', v_meses,
      'requiredMonths', 12,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim
    );
  end if;

  select count(*) into v_forecast_existente
  from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and cenario = 'base'
    and ano_mes between v_prev_inicio and v_prev_fim;

  if v_forecast_existente = 12 then
    return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
  end if;

  select coalesce(avg(valor_saida), 0) into v_media
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim;

  select coalesce(avg(valor_saida), 0) into v_media_ultimos3
  from (
    select valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_base_inicio and v_base_fim
    order by ano_mes desc
    limit 3
  ) serie;

  select coalesce(avg(valor_saida), 0) into v_media_prev3
  from (
    select valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_base_inicio and v_base_fim
    order by ano_mes desc
    offset 3
    limit 3
  ) serie;

  if v_media_prev3 > 0 then
    v_delta := (v_media_ultimos3 - v_media_prev3) / v_media_prev3;
  end if;

  if v_delta > 0.05 then
    v_tipo_tendencia := 'subida';
    v_fator := 1.05;
  elsif v_delta < -0.05 then
    v_tipo_tendencia := 'queda';
    v_fator := 0.95;
  end if;

  if p_fator_tendencia is not null and p_fator_tendencia > 0 then
    v_fator := p_fator_tendencia;
  end if;

  if v_fator <> 1 then
    v_metodo := 'ajustada';
  end if;

  insert into public.f_previsao_gasto_mensal (
    account_owner_id,
    ano_mes,
    valor_previsto,
    metodo,
    cenario,
    created_at,
    updated_at
  )
  select
    p_owner_id,
    serie.ano_mes,
    round(v_media * v_fator, 2) as valor_previsto,
    v_metodo,
    'base',
    now(),
    now()
  from (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_prev_inicio, v_prev_fim, interval '1 month') gs
  ) serie
  on conflict (account_owner_id, ano_mes, cenario) do update
    set valor_previsto = excluded.valor_previsto,
        metodo = excluded.metodo,
        updated_at = now();

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
    12,
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between v_base_inicio and v_base_fim),
    v_media,
    v_fator,
    v_tipo_tendencia,
    null,
    round(v_media * v_fator * 12, 2),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date),
    v_metodo,
    'medio',
    now();

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;
