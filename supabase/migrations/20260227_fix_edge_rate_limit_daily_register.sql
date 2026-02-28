-- Corrige ambiguidade de colunas na funcao edge_rate_limit_daily_register.

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

  select t.*
    into v_row
  from public.edge_rate_limits_daily t
  where t.account_owner_id = p_owner_id
    and t.category = p_category
    and t.day_date = v_day
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
