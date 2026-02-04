-- Cria tabela inventory_forecast para armazenar previsoes de gasto anual.

create table if not exists public.inventory_forecast (
  id uuid not null default gen_random_uuid(),
  account_owner_id uuid not null default public.my_owner_id(),
  periodo_base_inicio date not null,
  periodo_base_fim date not null,
  qtd_meses_base int4 not null,
  gasto_total_periodo numeric(14, 2) not null default 0,
  media_mensal numeric(14, 2) not null default 0,
  fator_tendencia numeric(10, 4) not null default 1,
  tipo_tendencia text not null default 'estavel',
  variacao_percentual numeric(10, 2),
  previsao_anual numeric(14, 2) not null default 0,
  gasto_ano_anterior numeric(14, 2),
  metodo_previsao text not null default 'media_simples',
  nivel_confianca text,
  created_at timestamptz not null default now(),
  constraint inventory_forecast_pkey primary key (id)
);

alter table if exists public.inventory_forecast
  add constraint inventory_forecast_account_owner_id_fkey
  foreign key (account_owner_id) references public.app_users(id);

alter table if exists public.inventory_forecast
  add constraint inventory_forecast_owner_period_unique
  unique (account_owner_id, periodo_base_inicio, periodo_base_fim);

create index if not exists inventory_forecast_owner_created_idx
  on public.inventory_forecast (account_owner_id, created_at desc);

alter table if exists public.inventory_forecast enable row level security;
alter table if exists public.inventory_forecast force row level security;

drop policy if exists inventory_forecast_select_owner on public.inventory_forecast;
create policy inventory_forecast_select_owner
  on public.inventory_forecast
  for select
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists inventory_forecast_insert_owner on public.inventory_forecast;
create policy inventory_forecast_insert_owner
  on public.inventory_forecast
  for insert
  to authenticated
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists inventory_forecast_update_owner on public.inventory_forecast;
create policy inventory_forecast_update_owner
  on public.inventory_forecast
  for update
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  )
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );
