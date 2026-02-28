-- Rate limit + idempotencia para API (auth e create)

create table if not exists public.rate_limit_config (
  route text primary key,
  scope text not null check (scope in ('auth', 'api')),
  max_hits integer not null check (max_hits > 0),
  window_seconds integer not null check (window_seconds > 0),
  block_seconds integer not null check (block_seconds > 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create table if not exists public.auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  identity_hash text not null,
  route text not null,
  window_start timestamp with time zone not null,
  hits integer not null default 0,
  blocked_until timestamp with time zone
);

create unique index if not exists auth_rate_limits_unique
  on public.auth_rate_limits(identity_hash, route, window_start);
create index if not exists auth_rate_limits_blocked_idx
  on public.auth_rate_limits(blocked_until);
create index if not exists auth_rate_limits_created_idx
  on public.auth_rate_limits(created_at desc);

create table if not exists public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  account_owner_id uuid not null,
  ip_hash text not null,
  route text not null,
  window_start timestamp with time zone not null,
  hits integer not null default 0,
  blocked_until timestamp with time zone
);

create unique index if not exists api_rate_limits_unique
  on public.api_rate_limits(account_owner_id, ip_hash, route, window_start);
create index if not exists api_rate_limits_blocked_idx
  on public.api_rate_limits(blocked_until);
create index if not exists api_rate_limits_created_idx
  on public.api_rate_limits(created_at desc);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  account_owner_id uuid not null,
  user_id uuid not null,
  route text not null,
  idempotency_key text not null,
  request_hash text not null,
  status_code integer,
  response_body jsonb,
  response_headers jsonb
);

create unique index if not exists idempotency_keys_unique
  on public.idempotency_keys(account_owner_id, user_id, route, idempotency_key);
create index if not exists idempotency_keys_expires_idx
  on public.idempotency_keys(expires_at);

alter table public.rate_limit_config enable row level security;
alter table public.auth_rate_limits enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.idempotency_keys enable row level security;

-- service_role only
create policy "rate_limit_config service_role" on public.rate_limit_config
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "auth_rate_limits service_role" on public.auth_rate_limits
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "api_rate_limits service_role" on public.api_rate_limits
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "idempotency_keys service_role" on public.idempotency_keys
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

revoke all on table public.rate_limit_config from anon, authenticated;
revoke all on table public.auth_rate_limits from anon, authenticated;
revoke all on table public.api_rate_limits from anon, authenticated;
revoke all on table public.idempotency_keys from anon, authenticated;

grant all on table public.rate_limit_config to service_role;
grant all on table public.auth_rate_limits to service_role;
grant all on table public.api_rate_limits to service_role;
grant all on table public.idempotency_keys to service_role;

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
  select route, scope, max_hits, window_seconds, block_seconds
    into v_config
  from public.rate_limit_config
  where route = p_route and scope = p_scope;

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
    delete from public.auth_rate_limits
      where window_start < (v_now - interval '2 days');

    select blocked_until into v_blocked_until
      from public.auth_rate_limits
      where identity_hash = p_identity_hash
        and route = p_route
        and blocked_until is not null
        and blocked_until > v_now
      order by blocked_until desc
      limit 1;
  else
    delete from public.api_rate_limits
      where window_start < (v_now - interval '2 days');

    select blocked_until into v_blocked_until
      from public.api_rate_limits
      where account_owner_id = p_owner_id
        and ip_hash = p_ip_hash
        and route = p_route
        and blocked_until is not null
        and blocked_until > v_now
      order by blocked_until desc
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
      update public.auth_rate_limits
        set blocked_until = v_blocked_until
        where identity_hash = p_identity_hash
          and route = p_route
          and window_start = v_window_start;
    else
      update public.api_rate_limits
        set blocked_until = v_blocked_until
        where account_owner_id = p_owner_id
          and ip_hash = p_ip_hash
          and route = p_route
          and window_start = v_window_start;
    end if;

    return query select false, v_hits, v_config.max_hits, v_config.block_seconds, v_window_start, v_blocked_until;
    return;
  end if;

  return query select true, v_hits, v_config.max_hits, null::integer, v_window_start, null::timestamp with time zone;
end;
$$;

revoke all on function public.rate_limit_check_and_hit(text, text, text, uuid, text) from public;
grant execute on function public.rate_limit_check_and_hit(text, text, text, uuid, text) to service_role;

insert into public.rate_limit_config(route, scope, max_hits, window_seconds, block_seconds)
values
  ('auth.login', 'auth', 5, 300, 300),
  ('auth.recover', 'auth', 3, 900, 900),
  ('create.pessoa', 'api', 100, 900, 300),
  ('create.material', 'api', 100, 900, 300),
  ('create.acidente', 'api', 100, 900, 300),
  ('create.entrada', 'api', 100, 900, 300),
  ('create.saida', 'api', 100, 900, 300)
on conflict (route) do update set
  scope = excluded.scope,
  max_hits = excluded.max_hits,
  window_seconds = excluded.window_seconds,
  block_seconds = excluded.block_seconds,
  updated_at = now();
