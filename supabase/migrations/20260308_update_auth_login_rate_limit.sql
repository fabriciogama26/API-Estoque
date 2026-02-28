-- Ajuste de rate limit do auth.login para 3 tentativas / 60s

insert into public.rate_limit_config(route, scope, max_hits, window_seconds, block_seconds)
values ('auth.login', 'auth', 3, 60, 60)
on conflict (route) do update set
  scope = excluded.scope,
  max_hits = excluded.max_hits,
  window_seconds = excluded.window_seconds,
  block_seconds = excluded.block_seconds,
  updated_at = now();
