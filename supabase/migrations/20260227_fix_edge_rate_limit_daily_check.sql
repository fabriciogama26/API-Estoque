-- Corrige ambiguidade de colunas na funcao edge_rate_limit_daily_check.

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

  select t.success_count, t.error_count, t.locked_until
    into v_success, v_error, v_locked
  from public.edge_rate_limits_daily t
  where t.account_owner_id = p_owner_id
    and t.category = p_category
    and t.day_date = v_day;

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
