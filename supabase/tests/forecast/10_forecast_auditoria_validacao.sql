-- Validacao de 20261008_forecast_tendencia_e_auditoria.sql (executar em PostgreSQL local descartavel, apos os
-- stubs e as migrations). Tudo roda dentro de uma transacao e termina em ROLLBACK.
--
-- Tenants (12 meses de 10/2025 a 09/2026):
--   A: gasto realizado de 02/2026 a 09/2026 das telas da Auditoria (10/2025 a 01/2026 ficticios);
--   B: so existe para o teste de isolamento;
--   C: queda forte no fim (inclinacao derruba o fator abaixo de 0,5);
--   D: alta forte no fim (fator acima de 1,5);
--   E: sem saida nos ultimos 3 meses, so entradas.

\set ON_ERROR_STOP on
begin;

select forecast_test.semear(
  'aaaaaaaa-0000-0000-0000-000000000001',
  array[2100, 1950, 1800, 2900, 3211.53, 3788.03, 2813.54, 2266.15, 2762.19, 2432.84, 6290.55, 368.41]
);
insert into public.app_users (id, username, credential) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'owner_b', 'admin');
select forecast_test.semear(
  'cccccccc-0000-0000-0000-000000000001',
  array[5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 3000, 800, 50]
);
select forecast_test.semear(
  'dddddddd-0000-0000-0000-000000000001',
  array[100, 100, 100, 100, 100, 100, 100, 100, 100, 500, 2000, 6000]
);
select forecast_test.semear(
  'eeeeeeee-0000-0000-0000-000000000001',
  array[1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 0, 0, 0],
  500
);

-- Fator de tendencia ------------------------------------------------------------------------------
select public.rpc_previsao_gasto_mensal_calcular('aaaaaaaa-0000-0000-0000-000000000001', null);

do $$
declare
  v_fator numeric;
  v_esperado numeric;
  v_antigo numeric;
  v_meses int;
  v_inicio date;
  v_fim date;
  v_linhas int;
  v_invalidas int;
begin
  -- Mesma conta feita sobre os 7 meses da janela (03/2026 a 09/2026), com o mes como indice 0..6.
  with v(i, y) as (
    values (0, 3788.03), (1, 2813.54), (2, 2266.15), (3, 2762.19), (4, 2432.84), (5, 6290.55), (6, 368.41)
  ),
  s as (
    select regr_slope(y, i) as inclinacao,
           avg(y) filter (where i >= 4) as ultimos,
           avg(y) filter (where i between 1 and 3) as anteriores
      from v
  )
  select 0.6 * ultimos / anteriores + 0.4 * (1 + inclinacao * 6 / ultimos),
         0.6 * ultimos / anteriores + 0.4
    into v_esperado, v_antigo
    from s;

  select fator_tendencia, qtd_meses_base, periodo_base_inicio, periodo_base_fim
    into v_fator, v_meses, v_inicio, v_fim
    from public.inventory_forecast
   where account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform forecast_test.ok(v_inicio = date '2025-10-01' and v_fim = date '2026-09-01' and v_meses = 12,
    'snapshot do tenant A com base 10/2025 a 09/2026 (12 meses)');
  perform forecast_test.ok(abs(v_fator - v_esperado) < 0.0001,
    format('fator usa a inclinacao em R$/mes: %s (esperado %s)', v_fator, round(v_esperado, 4)));
  perform forecast_test.ok(round(v_fator, 2) = 1.01 and round(v_antigo, 2) = 1.10,
    'snapshot de 30/09/2026: fator 1,01 com a correcao (era 1,10)');

  select count(*), count(*) filter (where valor_previsto is null or valor_previsto < 0)
    into v_linhas, v_invalidas
    from public.f_previsao_gasto_mensal
   where account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' and cenario = 'base';
  perform forecast_test.ok(v_linhas = 12 and v_invalidas = 0, '12 meses previstos (10/2026 a 09/2027), sem valor nulo ou negativo');
end;
$$;

select public.rpc_previsao_gasto_mensal_calcular_periodo(
  'aaaaaaaa-0000-0000-0000-000000000001', date '2025-10-01', date '2026-09-30', null
);

do $$
declare
  v_fator numeric;
  v_qtd int;
begin
  select count(*), max(fator_tendencia) into v_qtd, v_fator
    from public.inventory_forecast
   where account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform forecast_test.ok(v_qtd = 1 and round(v_fator, 2) = 1.01,
    'calcular_periodo usa a mesma formula (mesmo snapshot, fator 1,01)');
end;
$$;

select public.rpc_previsao_gasto_mensal_calcular('cccccccc-0000-0000-0000-000000000001', null);
select public.rpc_previsao_gasto_mensal_calcular('dddddddd-0000-0000-0000-000000000001', null);
select public.rpc_previsao_gasto_mensal_calcular('eeeeeeee-0000-0000-0000-000000000001', null);

do $$
declare
  v_bruto numeric;
  v_fator numeric;
  v_invalidas int;
begin
  -- C: janela 03/2026 a 09/2026 = 5000, 5000, 5000, 5000, 3000, 800, 50.
  with v(i, y) as (values (0, 5000), (1, 5000), (2, 5000), (3, 5000), (4, 3000), (5, 800), (6, 50)),
  s as (
    select regr_slope(y, i) as inclinacao,
           avg(y) filter (where i >= 4) as ultimos,
           avg(y) filter (where i between 1 and 3) as anteriores
      from v
  )
  select 0.6 * ultimos / anteriores + 0.4 * (1 + inclinacao * 6 / ultimos) into v_bruto from s;

  select fator_tendencia into v_fator
    from public.inventory_forecast where account_owner_id = 'cccccccc-0000-0000-0000-000000000001';
  select count(*) filter (where valor_previsto is null or valor_previsto < 0) into v_invalidas
    from public.f_previsao_gasto_mensal where account_owner_id = 'cccccccc-0000-0000-0000-000000000001';
  perform forecast_test.ok(v_bruto < 0 and v_fator = 0.5 and v_invalidas = 0,
    format('queda forte: fator bruto %s fica limitado em 0,5 e nenhuma previsao fica negativa', round(v_bruto, 2)));

  select fator_tendencia into v_fator
    from public.inventory_forecast where account_owner_id = 'dddddddd-0000-0000-0000-000000000001';
  perform forecast_test.ok(v_fator = 1.5, 'alta forte: fator limitado em 1,5');

  select fator_tendencia into v_fator
    from public.inventory_forecast where account_owner_id = 'eeeeeeee-0000-0000-0000-000000000001';
  select count(*) filter (where valor_previsto is null) into v_invalidas
    from public.f_previsao_gasto_mensal where account_owner_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform forecast_test.ok(v_fator = 0.5 and v_invalidas = 0,
    'sem saida nos ultimos 3 meses: snapshot gravado com fator 0,5 (antes falhava por fator nulo)');
end;
$$;

select public.rpc_previsao_gasto_mensal_calcular('cccccccc-0000-0000-0000-000000000001', 2.0);

do $$
declare
  v_fator numeric;
  v_config text[];
begin
  select fator_tendencia into v_fator
    from public.inventory_forecast where account_owner_id = 'cccccccc-0000-0000-0000-000000000001';
  perform forecast_test.ok(v_fator = 2.0, 'fator informado em p_fator_tendencia continua sem limite');

  select array_agg(p.proname || ':' || coalesce(array_to_string(p.proconfig, ','), '') order by p.proname)
    into v_config
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('rpc_previsao_gasto_mensal_calcular', 'rpc_previsao_gasto_mensal_calcular_periodo', 'rpc_previsao_gasto_mensal_consultar');
  perform forecast_test.ok(
    v_config = array[
      'rpc_previsao_gasto_mensal_calcular:search_path=pg_catalog, public',
      'rpc_previsao_gasto_mensal_calcular_periodo:search_path=pg_catalog, public',
      'rpc_previsao_gasto_mensal_consultar:search_path=pg_catalog, public'
    ],
    'calcular, calcular_periodo e consultar com search_path fixo'
  );
end;
$$;

-- Auditoria ---------------------------------------------------------------------------------------
-- O snapshot do tenant A preve 10/2026 a 09/2027 e o agregado vai so ate 09/2026: nenhum mes realizado.
select forecast_test.login('aaaaaaaa-0000-0000-0000-000000000001');

do $$
declare
  v jsonb;
begin
  v := public.rpc_previsao_gasto_mensal_auditar('aaaaaaaa-0000-0000-0000-000000000001', null);
  perform forecast_test.ok(
    (v->'resumo'->>'meses_realizados')::int = 0 and (v->'resumo'->>'meses_pendentes')::int = 12,
    'auditoria: snapshot novo com 0 de 12 meses realizados'
  );
  perform forecast_test.ok(
    jsonb_typeof(v->'resumo'->'acuracia_wape') = 'null'
      and jsonb_typeof(v->'resumo'->'acuracia_mape') = 'null'
      and jsonb_typeof(v->'resumo'->'wape_percentual') = 'null'
      and jsonb_typeof(v->'resumo'->'vies_percentual') = 'null',
    'auditoria: sem mes realizado, acuracia/WAPE/vies voltam nulos (antes acuracia = 0)'
  );
end;
$$;

select forecast_test.login(null, null);

-- 10/2026 realizado 25% acima do previsto: WAPE 20% e acuracia 80%.
insert into public.agg_gasto_mensal (account_owner_id, ano_mes, valor_saida, valor_entrada)
select account_owner_id, ano_mes, round(valor_previsto * 1.25, 2), 0
  from public.f_previsao_gasto_mensal
 where account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   and ano_mes = date '2026-10-01'
   and cenario = 'base';

select forecast_test.login('aaaaaaaa-0000-0000-0000-000000000001');

do $$
declare
  v jsonb;
begin
  v := public.rpc_previsao_gasto_mensal_auditar('aaaaaaaa-0000-0000-0000-000000000001', null);
  perform forecast_test.ok(
    (v->'resumo'->>'meses_realizados')::int = 1
      and abs((v->'resumo'->>'wape_percentual')::numeric - 20) < 0.05
      and (v->'resumo'->>'acuracia_wape')::numeric = round(100 - (v->'resumo'->>'wape_percentual')::numeric, 2)
      and abs((v->'resumo'->>'acuracia_mape')::numeric - 80) < 0.05,
    format('auditoria: 1 mes realizado, acuracia = 100 - WAPE (%s%%)', v->'resumo'->>'acuracia_wape')
  );
end;
$$;

select forecast_test.login(null, null);

update public.agg_gasto_mensal a
   set valor_saida = round(f.valor_previsto / 10, 2)
  from public.f_previsao_gasto_mensal f
 where a.account_owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   and a.ano_mes = date '2026-10-01'
   and f.account_owner_id = a.account_owner_id
   and f.ano_mes = a.ano_mes
   and f.cenario = 'base';

select forecast_test.login('aaaaaaaa-0000-0000-0000-000000000001');

do $$
declare
  v jsonb;
begin
  v := public.rpc_previsao_gasto_mensal_auditar('aaaaaaaa-0000-0000-0000-000000000001', null);
  perform forecast_test.ok(
    (v->'resumo'->>'wape_percentual')::numeric > 100 and (v->'resumo'->>'acuracia_wape')::numeric = 0,
    format('auditoria: WAPE de %s%% vira acuracia 0, nunca negativa', v->'resumo'->>'wape_percentual')
  );
end;
$$;

-- Isolamento: a funcao interna continua fechada e a RPC publica valida o owner da sessao.
do $$
begin
  perform forecast_test.ok(
    not has_function_privilege('authenticated', 'public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid)', 'execute'),
    'auditoria: funcao interna sem execute para authenticated'
  );
end;
$$;

select forecast_test.erro(
  $sql$select public.rpc_previsao_gasto_mensal_auditar('bbbbbbbb-0000-0000-0000-000000000001', null)$sql$,
  '42501',
  'auditoria: owner A nao le a auditoria do owner B'
);

rollback;
