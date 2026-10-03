-- Controle negativo: comportamento do fator de tendencia na versao de 20260423_fix_forecast_snapshot_versioning.sql
-- (a que esta em producao antes de 20261008). Roda antes da migration nova e termina em ROLLBACK.
--
-- Tenant A usa o gasto realizado de 02/2026 a 09/2026 das telas da Auditoria (10/2025 a 01/2026 sao ficticios).

\set ON_ERROR_STOP on
begin;

select forecast_test.semear(
  'aaaaaaaa-0000-0000-0000-000000000001',
  array[2100, 1950, 1800, 2900, 3211.53, 3788.03, 2813.54, 2266.15, 2762.19, 2432.84, 6290.55, 368.41]
);
select public.rpc_previsao_gasto_mensal_calcular('aaaaaaaa-0000-0000-0000-000000000001', null);

do $$
declare
  v_fator numeric;
  v_razao numeric := ((2432.84 + 6290.55 + 368.41) / 3) / ((2813.54 + 2266.15 + 2762.19) / 3);
begin
  select fator_tendencia into v_fator
    from public.inventory_forecast
   where account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform forecast_test.ok(
    abs(v_fator - (0.6 * v_razao + 0.4)) < 0.0005,
    format('versao antiga: fator %s = 0,6 x razao + 0,4 (inclinacao ignorada)', v_fator)
  );
  perform forecast_test.ok(round(v_fator, 2) = 1.10, 'versao antiga: fator 1,10, igual ao snapshot de 30/09/2026');
end;
$$;

-- Sem saida nos ultimos 3 meses (so entradas): ultimos_3m = 0, o termo da inclinacao vira nulo e o calculo falha.
select forecast_test.semear(
  'eeeeeeee-0000-0000-0000-000000000001',
  array[1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 0, 0, 0],
  500
);
select forecast_test.erro(
  $sql$select public.rpc_previsao_gasto_mensal_calcular('eeeeeeee-0000-0000-0000-000000000001', null)$sql$,
  '23502',
  'versao antiga: sem saida nos ultimos 3 meses o fator fica nulo e o snapshot nao e gravado'
);

rollback;
