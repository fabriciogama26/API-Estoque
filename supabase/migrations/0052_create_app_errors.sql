create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null default 'app',
  page text not null default '',
  user_id text null,
  message text not null,
  stack text null,
  context jsonb null,
  severity text not null default 'error',
  fingerprint text not null,
  status text not null default 'open',
  resolved_at timestamptz null,
  resolved_by text null
);

create unique index if not exists app_errors_fingerprint_uidx on public.app_errors(fingerprint);
create index if not exists app_errors_created_at_idx on public.app_errors(created_at desc);
create index if not exists app_errors_status_created_idx on public.app_errors(status, created_at desc);
create index if not exists app_errors_page_idx on public.app_errors(page);

comment on table public.app_errors is 'Registros de erros do app';
comment on column public.app_errors.environment is 'Ambiente: app/dev/prod/homolog';
comment on column public.app_errors.page is 'Pagina ou rota onde ocorreu o erro';
comment on column public.app_errors.context is 'Contexto adicional em JSON';
comment on column public.app_errors.fingerprint is 'Hash simples para deduplicar erros semelhantes';
comment on column public.app_errors.status is 'Estado do erro: open/ignored/resolved';

