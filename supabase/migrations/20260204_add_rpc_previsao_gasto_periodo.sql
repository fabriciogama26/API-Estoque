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
  v_prev_inicio date;
  v_prev_fim date;
  v_meses int := 0;
  v_media numeric := 0;
  v_fator numeric := 1;
  v_metodo text := 'media_simples';
  v_forecast_existente int := 0;
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

  if p_fator_tendencia is not null and p_fator_tendencia > 0 then
    v_fator := p_fator_tendencia;
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
    null,
    null,
    round(v_media * v_fator * 12, 2),
    (select coalesce(sum(valor_saida), 0) from public.agg_gasto_mensal where account_owner_id = p_owner_id and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date),
    v_metodo,
    'medio',
    now();

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;
