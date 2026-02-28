-- Limites diarios por plano (por categoria) e controle diario de consumo.

alter table if exists public.planos_users
  add column if not exists limit_pdf_daily integer,
  add column if not exists limit_export_daily integer,
  add column if not exists limit_import_daily integer;

comment on column public.planos_users.limit_pdf_daily is 'Limite diario de geracao de PDF por tenant.';
comment on column public.planos_users.limit_export_daily is 'Limite diario de exportacao (CSV) por tenant.';
comment on column public.planos_users.limit_import_daily is 'Limite diario de importacao por tenant.';

create table if not exists public.edge_rate_limits_daily (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  account_owner_id uuid not null,
  category text not null,
  day_date date not null,
  success_count integer not null default 0,
  error_count integer not null default 0,
  locked_until timestamptz null,
  constraint edge_rate_limits_daily_category_check check (category in ('pdf', 'export', 'import'))
);

create unique index if not exists edge_rate_limits_daily_unique on public.edge_rate_limits_daily(account_owner_id, category, day_date);
create index if not exists edge_rate_limits_daily_created_at_idx on public.edge_rate_limits_daily(created_at desc);
create index if not exists edge_rate_limits_daily_category_idx on public.edge_rate_limits_daily(category);
create index if not exists edge_rate_limits_daily_locked_idx on public.edge_rate_limits_daily(locked_until);

comment on table public.edge_rate_limits_daily is 'Controle diario de rate limit por tenant e categoria.';
comment on column public.edge_rate_limits_daily.account_owner_id is 'Tenant/owner associado ao request.';
comment on column public.edge_rate_limits_daily.category is 'Categoria (pdf, export, import).';
comment on column public.edge_rate_limits_daily.day_date is 'Dia considerado (America/Sao_Paulo).';
comment on column public.edge_rate_limits_daily.locked_until is 'Bloqueio apos erros, expira a meia-noite local.';

alter table public.edge_rate_limits_daily enable row level security;

create policy "edge_rate_limits_daily select service_role" on public.edge_rate_limits_daily
  for select using (auth.role() = 'service_role');

create policy "edge_rate_limits_daily insert service_role" on public.edge_rate_limits_daily
  for insert with check (auth.role() = 'service_role');

create policy "edge_rate_limits_daily update service_role" on public.edge_rate_limits_daily
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.edge_rate_limit_daily_check(p_owner_id uuid, p_category text)
returns table(
  allowed boolean,
  reason text,
  limit_value integer,
  success_count integer,
  error_count integer,
  locked_until timestamptz,
  day_date date
)
language plpgsql
as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_limit integer;
  v_success integer;
  v_error integer;
  v_locked timestamptz;
  v_plan_id uuid;
begin
  select plan_id into v_plan_id from public.app_users where id = p_owner_id;
  if v_plan_id is null then
    return query select false, 'plan_not_found', null::integer, 0, 0, null::timestamptz, v_day;
    return;
  end if;

  select
    case
      when p_category = 'pdf' then limit_pdf_daily
      when p_category = 'export' then limit_export_daily
      when p_category = 'import' then limit_import_daily
      else null
    end
  into v_limit
  from public.planos_users
  where id = v_plan_id;

  if v_limit is null then
    return query select false, 'limit_not_configured', null::integer, 0, 0, null::timestamptz, v_day;
    return;
  end if;

  select success_count, error_count, locked_until
    into v_success, v_error, v_locked
  from public.edge_rate_limits_daily
  where account_owner_id = p_owner_id
    and category = p_category
    and day_date = v_day;

  if v_locked is not null and v_locked > now() then
    return query select false, 'locked', v_limit, coalesce(v_success, 0), coalesce(v_error, 0), v_locked, v_day;
    return;
  end if;

  if coalesce(v_success, 0) >= v_limit then
    return query select false, 'limit_reached', v_limit, coalesce(v_success, 0), coalesce(v_error, 0), v_locked, v_day;
    return;
  end if;

  return query select true, 'ok', v_limit, coalesce(v_success, 0), coalesce(v_error, 0), v_locked, v_day;
end;
$$;

create or replace function public.edge_rate_limit_daily_register(
  p_owner_id uuid,
  p_category text,
  p_success boolean
)
returns table(
  success_count integer,
  error_count integer,
  locked_until timestamptz,
  day_date date
)
language plpgsql
as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_row public.edge_rate_limits_daily%rowtype;
  v_next_lock timestamptz;
begin
  insert into public.edge_rate_limits_daily(account_owner_id, category, day_date)
  values (p_owner_id, p_category, v_day)
  on conflict (account_owner_id, category, day_date) do nothing;

  select * into v_row
  from public.edge_rate_limits_daily
  where account_owner_id = p_owner_id
    and category = p_category
    and day_date = v_day
  for update;

  if p_success then
    v_row.success_count := v_row.success_count + 1;
  else
    v_row.error_count := v_row.error_count + 1;
    if v_row.error_count >= 3 then
      v_next_lock := ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo');
      v_row.locked_until := v_next_lock;
    end if;
  end if;

  update public.edge_rate_limits_daily
  set success_count = v_row.success_count,
      error_count = v_row.error_count,
      locked_until = v_row.locked_until,
      updated_at = now()
  where id = v_row.id;

  return query select v_row.success_count, v_row.error_count, v_row.locked_until, v_day;
end;
$$;
