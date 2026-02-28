create table if not exists public.edge_rate_limits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_owner_id uuid not null,
  function_name text not null,
  window_start timestamptz not null
);

create unique index if not exists edge_rate_limits_unique on public.edge_rate_limits(account_owner_id, function_name, window_start);
create index if not exists edge_rate_limits_created_at_idx on public.edge_rate_limits(created_at desc);
create index if not exists edge_rate_limits_function_idx on public.edge_rate_limits(function_name);

comment on table public.edge_rate_limits is 'Controle de rate limit por tenant e funcao edge.';
comment on column public.edge_rate_limits.account_owner_id is 'Tenant/owner associado ao request.';
comment on column public.edge_rate_limits.function_name is 'Nome da edge function.';
comment on column public.edge_rate_limits.window_start is 'Inicio da janela de rate limit (UTC).';

alter table public.edge_rate_limits enable row level security;

create policy "edge_rate_limits select service_role" on public.edge_rate_limits
  for select using (auth.role() = 'service_role');

create policy "edge_rate_limits insert service_role" on public.edge_rate_limits
  for insert with check (auth.role() = 'service_role');
