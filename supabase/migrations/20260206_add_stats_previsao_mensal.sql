alter table if exists public.f_previsao_gasto_mensal
  add column if not exists contingencia_p75 numeric(14, 2) not null default 0,
  add column if not exists p90 numeric(14, 2) not null default 0,
  add column if not exists mediana numeric(14, 2) not null default 0,
  add column if not exists coef_var numeric(10, 4) not null default 0,
  add column if not exists media_robusta numeric(14, 2) not null default 0,
  add column if not exists alerta_volatil boolean not null default false;
