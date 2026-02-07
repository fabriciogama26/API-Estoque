alter table public.f_previsao_gasto_mensal
  add column if not exists inventory_forecast_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'f_previsao_gasto_mensal_inventory_forecast_fkey'
  ) then
    alter table public.f_previsao_gasto_mensal
      add constraint f_previsao_gasto_mensal_inventory_forecast_fkey
      foreign key (inventory_forecast_id)
      references public.inventory_forecast(id)
      on delete set null;
  end if;
end $$;

create index if not exists f_previsao_gasto_mensal_forecast_idx
  on public.f_previsao_gasto_mensal (account_owner_id, inventory_forecast_id, ano_mes);

create unique index if not exists inventory_forecast_owner_periodo_inicio_uidx
  on public.inventory_forecast (account_owner_id, periodo_base_inicio);
