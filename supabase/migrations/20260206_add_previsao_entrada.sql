alter table if exists public.f_previsao_gasto_mensal
  add column if not exists valor_previsto_entrada numeric(14, 2) not null default 0;

alter table if exists public.inventory_forecast
  add column if not exists previsao_anual_entrada numeric(14, 2) not null default 0,
  add column if not exists previsao_anual_saida numeric(14, 2) not null default 0,
  add column if not exists previsao_anual_saldo numeric(14, 2) not null default 0;
