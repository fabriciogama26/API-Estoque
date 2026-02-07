alter table public.f_previsao_gasto_mensal
  add column if not exists updated_at timestamptz not null default now();
