-- Corrige ambiguidade com window_start (coluna vs OUT param) na rate_limit_check_and_hit

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
declare
  v_config record;
  v_now timestamp with time zone := now();
  v_window_start timestamp with time zone;
  v_blocked_until timestamp with time zone;
  v_hits integer;
begin
  select r.route, r.scope, r.max_hits, r.window_seconds, r.block_seconds
    into v_config
  from public.rate_limit_config r
  where r.route = p_route and r.scope = p_scope;

  if not found then
    return query select true, null::integer, null::integer, null::integer, null::timestamp with time zone, null::timestamp with time zone;
    return;
  end if;

  if p_scope = 'auth' and (p_identity_hash is null or p_identity_hash = '') then
    return query select true, null::integer, v_config.max_hits, null::integer, null::timestamp with time zone, null::timestamp with time zone;
    return;
  end if;

  if p_scope = 'api' and (p_owner_id is null or p_ip_hash is null or p_ip_hash = '') then
    return query select true, null::integer, v_config.max_hits, null::integer, null::timestamp with time zone, null::timestamp with time zone;
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
      v_config.max_hits,
      greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer),
      null::timestamp with time zone,
      v_blocked_until;
    return;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / v_config.window_seconds) * v_config.window_seconds
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

  if v_hits > v_config.max_hits then
    v_blocked_until := v_now + make_interval(secs => v_config.block_seconds);

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

    return query select false, v_hits, v_config.max_hits, v_config.block_seconds, v_window_start, v_blocked_until;
    return;
  end if;

  return query select true, v_hits, v_config.max_hits, null::integer, v_window_start, null::timestamp with time zone;
end;
$$;
