-- RLS initplan: avoid per-row auth.role() evaluation on rate limit tables.

-- edge_rate_limits
drop policy if exists "edge_rate_limits select service_role" on public.edge_rate_limits;
create policy "edge_rate_limits select service_role" on public.edge_rate_limits
  for select
  using ((select auth.role()) = 'service_role');

drop policy if exists "edge_rate_limits insert service_role" on public.edge_rate_limits;
create policy "edge_rate_limits insert service_role" on public.edge_rate_limits
  for insert
  with check ((select auth.role()) = 'service_role');

-- edge_rate_limits_daily
drop policy if exists "edge_rate_limits_daily select service_role" on public.edge_rate_limits_daily;
create policy "edge_rate_limits_daily select service_role" on public.edge_rate_limits_daily
  for select
  using ((select auth.role()) = 'service_role');

drop policy if exists "edge_rate_limits_daily insert service_role" on public.edge_rate_limits_daily;
create policy "edge_rate_limits_daily insert service_role" on public.edge_rate_limits_daily
  for insert
  with check ((select auth.role()) = 'service_role');

drop policy if exists "edge_rate_limits_daily update service_role" on public.edge_rate_limits_daily;
create policy "edge_rate_limits_daily update service_role" on public.edge_rate_limits_daily
  for update
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- rate_limit_config / auth_rate_limits / api_rate_limits / idempotency_keys
drop policy if exists "rate_limit_config service_role" on public.rate_limit_config;
create policy "rate_limit_config service_role" on public.rate_limit_config
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "auth_rate_limits service_role" on public.auth_rate_limits;
create policy "auth_rate_limits service_role" on public.auth_rate_limits
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "api_rate_limits service_role" on public.api_rate_limits;
create policy "api_rate_limits service_role" on public.api_rate_limits
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "idempotency_keys service_role" on public.idempotency_keys;
create policy "idempotency_keys service_role" on public.idempotency_keys
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
