-- Corrige uso de record nao inicializado e aplica override por plano com colunas em planos_users

create or replace function public.rate_limit_check_and_hit(
  p_scope text,
  p_route text,
  p_identity_hash text,
  p_owner_id uuid,
  p_ip_hash text
) returns table(
  allowed boolean,
  hits integer,
  max_hits integer,
  retry_after integer,
  window_start timestamp with time zone,
  blocked_until timestamp with time zone
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_now timestamp with time zone := now();
  v_window_start timestamp with time zone;
  v_blocked_until timestamp with time zone;
  v_hits integer;
  v_plan_id uuid;
  v_plan_max_hits integer;
  v_plan_window_seconds integer;
  v_plan_block_seconds integer;
  v_max_hits integer;
  v_window_seconds integer;
  v_block_seconds integer;
begin
  if p_scope = 'api' and p_owner_id is not null then
    select plan_id into v_plan_id
      from public.app_users
      where id = p_owner_id;
  end if;

  if p_scope = 'api' and v_plan_id is not null then
    select
      case
        when p_route like 'create.%' then limit_create_burst_hits
        when p_route like 'pdf.%' then limit_pdf_burst_hits
        when p_route like 'import.%' then limit_import_burst_hits
        else null
      end,
      case
        when p_route like 'create.%' then limit_create_burst_window_seconds
        when p_route like 'pdf.%' then limit_pdf_burst_window_seconds
        when p_route like 'import.%' then limit_import_burst_window_seconds
        else null
      end,
      case
        when p_route like 'create.%' then limit_create_burst_block_seconds
        when p_route like 'pdf.%' then limit_pdf_burst_block_seconds
        when p_route like 'import.%' then limit_import_burst_block_seconds
        else null
      end
    into v_plan_max_hits, v_plan_window_seconds, v_plan_block_seconds
    from public.planos_users
    where id = v_plan_id;
  end if;

  if p_scope = 'api'
     and v_plan_max_hits is not null
     and v_plan_window_seconds is not null
     and v_plan_block_seconds is not null then
    v_max_hits := v_plan_max_hits;
    v_window_seconds := v_plan_window_seconds;
    v_block_seconds := v_plan_block_seconds;
  else
    select r.max_hits, r.window_seconds, r.block_seconds
      into v_max_hits, v_window_seconds, v_block_seconds
    from public.rate_limit_config r
    where r.route = p_route and r.scope = p_scope;

    if not found then
      return query select true, null::integer, null::integer, null::integer, null::timestamp with time zone, null::timestamp with time zone;
      return;
    end if;
  end if;

  if p_scope = 'auth' and (p_identity_hash is null or p_identity_hash = '') then
    return query select true, null::integer, v_max_hits, null::integer, null::timestamp with time zone, null::timestamp with time zone;
    return;
  end if;

  if p_scope = 'api' and (p_owner_id is null or p_ip_hash is null or p_ip_hash = '') then
    return query select true, null::integer, v_max_hits, null::integer, null::timestamp with time zone, null::timestamp with time zone;
    return;
  end if;

  if p_scope = 'auth' then
    delete from public.auth_rate_limits ar
      where ar.window_start < (v_now - interval '2 days');

    select ar.blocked_until into v_blocked_until
      from public.auth_rate_limits ar
      where ar.identity_hash = p_identity_hash
        and ar.route = p_route
        and ar.blocked_until is not null
        and ar.blocked_until > v_now
      order by ar.blocked_until desc
      limit 1;
  else
    delete from public.api_rate_limits apr
      where apr.window_start < (v_now - interval '2 days');

    select apr.blocked_until into v_blocked_until
      from public.api_rate_limits apr
      where apr.account_owner_id = p_owner_id
        and apr.ip_hash = p_ip_hash
        and apr.route = p_route
        and apr.blocked_until is not null
        and apr.blocked_until > v_now
      order by apr.blocked_until desc
      limit 1;
  end if;

  if v_blocked_until is not null then
    return query select false,
      null::integer,
      v_max_hits,
      greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer),
      null::timestamp with time zone,
      v_blocked_until;
    return;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds
  );

  if p_scope = 'auth' then
    insert into public.auth_rate_limits(identity_hash, route, window_start, hits)
      values (p_identity_hash, p_route, v_window_start, 1)
    on conflict (identity_hash, route, window_start)
      do update set hits = public.auth_rate_limits.hits + 1
      returning hits into v_hits;
  else
    insert into public.api_rate_limits(account_owner_id, ip_hash, route, window_start, hits)
      values (p_owner_id, p_ip_hash, p_route, v_window_start, 1)
    on conflict (account_owner_id, ip_hash, route, window_start)
      do update set hits = public.api_rate_limits.hits + 1
      returning hits into v_hits;
  end if;

  if v_hits > v_max_hits then
    v_blocked_until := v_now + make_interval(secs => v_block_seconds);

    if p_scope = 'auth' then
      update public.auth_rate_limits ar
        set blocked_until = v_blocked_until
        where ar.identity_hash = p_identity_hash
          and ar.route = p_route
          and ar.window_start = v_window_start;
    else
      update public.api_rate_limits apr
        set blocked_until = v_blocked_until
        where apr.account_owner_id = p_owner_id
          and apr.ip_hash = p_ip_hash
          and apr.route = p_route
          and apr.window_start = v_window_start;
    end if;

    return query select false, v_hits, v_max_hits, v_block_seconds, v_window_start, v_blocked_until;
    return;
  end if;

  return query select true, v_hits, v_max_hits, null::integer, v_window_start, null::timestamp with time zone;
end;
$$;
