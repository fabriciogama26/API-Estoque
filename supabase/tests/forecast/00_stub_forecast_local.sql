-- Stub das tabelas do forecast de gasto para validar as migrations em um PostgreSQL local e descartavel
-- (NUNCA executar no projeto Supabase real). Roda depois de supabase/tests/validades/00_stub_supabase_local.sql,
-- que cria roles, auth.uid(), app_users, is_master() e forecast_assert_owner_access().
--
-- Colunas e restricoes como em producao antes de 20260423 (20260203_create_inventory_forecast.sql,
-- 20260204_create_gasto_forecast_tables.sql, 20260204_add_updated_at_forecast.sql, 20260206_add_*),
-- sem RLS: os testes rodam como superusuario ou chamam as RPCs security definer.

create table if not exists public.agg_gasto_mensal (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id),
  ano_mes date not null,
  valor_saida numeric(14, 2) not null default 0,
  valor_entrada numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agg_gasto_mensal_owner_mes_unique unique (account_owner_id, ano_mes)
);

create table if not exists public.inventory_forecast (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id),
  periodo_base_inicio date not null,
  periodo_base_fim date not null,
  qtd_meses_base int4 not null,
  gasto_total_periodo numeric(14, 2) not null default 0,
  media_mensal numeric(14, 2) not null default 0,
  fator_tendencia numeric(10, 4) not null default 1,
  tipo_tendencia text not null default 'estavel',
  variacao_percentual numeric(10, 2),
  previsao_anual numeric(14, 2) not null default 0,
  previsao_anual_entrada numeric(14, 2) not null default 0,
  previsao_anual_saida numeric(14, 2) not null default 0,
  previsao_anual_saldo numeric(14, 2) not null default 0,
  gasto_ano_anterior numeric(14, 2),
  metodo_previsao text not null default 'media_simples',
  nivel_confianca text,
  created_at timestamptz not null default now(),
  constraint inventory_forecast_owner_period_unique unique (account_owner_id, periodo_base_inicio, periodo_base_fim)
);

create unique index if not exists inventory_forecast_owner_periodo_inicio_uidx
  on public.inventory_forecast (account_owner_id, periodo_base_inicio);

create table if not exists public.f_previsao_gasto_mensal (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id),
  ano_mes date not null,
  valor_previsto numeric(14, 2) not null default 0,
  valor_previsto_entrada numeric(14, 2) not null default 0,
  metodo text not null default 'media_movel_12',
  cenario text not null default 'base',
  inventory_forecast_id uuid references public.inventory_forecast(id) on delete set null,
  contingencia_p75 numeric(14, 2) not null default 0,
  p90 numeric(14, 2) not null default 0,
  mediana numeric(14, 2) not null default 0,
  coef_var numeric(10, 4) not null default 0,
  media_robusta numeric(14, 2) not null default 0,
  alerta_volatil boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint f_previsao_gasto_mensal_owner_mes_unique unique (account_owner_id, ano_mes, cenario)
);

create index if not exists f_previsao_gasto_mensal_owner_mes_idx
  on public.f_previsao_gasto_mensal (account_owner_id, ano_mes);

-- Os testes gravam agg_gasto_mensal direto; em producao esta funcao recalcula o agregado a partir de entradas/saidas.
create or replace function public.rpc_refresh_gasto_mensal(p_owner_id uuid)
returns void
language plpgsql
as $$
begin
  return;
end;
$$;

grant select on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Helpers dos testes (05_ e 10_), fora das transacoes que terminam em ROLLBACK.
create schema if not exists forecast_test;
grant usage on schema forecast_test to public;

create or replace function forecast_test.ok(p_condicao boolean, p_caso text)
returns void
language plpgsql
as $$
begin
  if p_condicao is distinct from true then
    raise exception 'FALHOU: %', p_caso;
  end if;
  raise notice 'ok - %', p_caso;
end;
$$;

create or replace function forecast_test.erro(p_sql text, p_trecho text, p_caso text)
returns void
language plpgsql
as $$
declare
  v_msg text;
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    if position(lower(p_trecho) in lower(v_msg)) > 0 or v_state = p_trecho then
      raise notice 'ok - % (erro esperado: %)', p_caso, v_msg;
      return;
    end if;
    raise exception 'FALHOU: % (erro inesperado: % / %)', p_caso, v_state, v_msg;
  end;
  raise exception 'FALHOU: % (nenhum erro gerado)', p_caso;
end;
$$;

create or replace function forecast_test.login(p_user uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(p_role, ''), true);
  if p_role in ('authenticated', 'service_role', 'anon') then
    execute format('set local role %I', p_role);
  end if;
end;
$$;

-- Cria o owner e 12 meses de agregado (10/2025 a 09/2026): saida do array, entrada fixa.
create or replace function forecast_test.semear(p_owner uuid, p_saidas numeric[], p_entrada numeric default 1000)
returns void
language plpgsql
as $$
begin
  insert into public.app_users (id, username, credential)
  values (p_owner, 'owner_' || left(p_owner::text, 8), 'admin')
  on conflict (id) do nothing;

  insert into public.agg_gasto_mensal (account_owner_id, ano_mes, valor_saida, valor_entrada)
  select p_owner, (date '2025-10-01' + make_interval(months => i - 1))::date, p_saidas[i], p_entrada
    from generate_subscripts(p_saidas, 1) as i;
end;
$$;
