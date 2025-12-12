-- Logs de erros do backend/API. Mantido separado de app_errors (frontend).

create table if not exists public.api_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null default 'api',
  service text not null default 'api',
  method text null,
  path text null,
  status integer null,
  code text null,
  user_id text null,
  message text not null,
  stack text null,
  context jsonb null,
  severity text not null default 'error',
  fingerprint text not null
);

create index if not exists api_errors_created_at_idx on public.api_errors(created_at desc);
create index if not exists api_errors_status_created_idx on public.api_errors(status, created_at desc);
create index if not exists api_errors_service_idx on public.api_errors(service);
create index if not exists api_errors_path_idx on public.api_errors(path);
create index if not exists api_errors_fingerprint_idx on public.api_errors(fingerprint);

comment on table public.api_errors is 'Registros de erros do backend/API';
comment on column public.api_errors.environment is 'Ambiente: api/dev/prod/homolog';
comment on column public.api_errors.service is 'Servico ou modulo que gerou o log';
comment on column public.api_errors.path is 'Path/rota da requisicao';
comment on column public.api_errors.context is 'Contexto adicional em JSON';
comment on column public.api_errors.fingerprint is 'Hash simples para deduplicar erros semelhantes';

alter table public.api_errors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'api_errors'
      and policyname = 'api_errors select service_role'
  ) then
    create policy "api_errors select service_role" on public.api_errors
      for select using (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'api_errors'
      and policyname = 'api_errors insert service_role'
  ) then
    create policy "api_errors insert service_role" on public.api_errors
      for insert with check (auth.role() = 'service_role');
  end if;
end$$;
