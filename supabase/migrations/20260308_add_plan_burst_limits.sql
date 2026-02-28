-- Limites burst por plano (create/pdf/import) para rate limit dinamico

alter table public.planos_users
  add column if not exists limit_create_burst_hits integer,
  add column if not exists limit_create_burst_window_seconds integer,
  add column if not exists limit_create_burst_block_seconds integer,
  add column if not exists limit_pdf_burst_hits integer,
  add column if not exists limit_pdf_burst_window_seconds integer,
  add column if not exists limit_pdf_burst_block_seconds integer,
  add column if not exists limit_import_burst_hits integer,
  add column if not exists limit_import_burst_window_seconds integer,
  add column if not exists limit_import_burst_block_seconds integer;

comment on column public.planos_users.limit_create_burst_hits is 'Limite de burst (max hits) para create.*';
comment on column public.planos_users.limit_create_burst_window_seconds is 'Janela (segundos) do burst para create.*';
comment on column public.planos_users.limit_create_burst_block_seconds is 'Tempo de bloqueio (segundos) do burst para create.*';
comment on column public.planos_users.limit_pdf_burst_hits is 'Limite de burst (max hits) para pdf.*';
comment on column public.planos_users.limit_pdf_burst_window_seconds is 'Janela (segundos) do burst para pdf.*';
comment on column public.planos_users.limit_pdf_burst_block_seconds is 'Tempo de bloqueio (segundos) do burst para pdf.*';
comment on column public.planos_users.limit_import_burst_hits is 'Limite de burst (max hits) para import.*';
comment on column public.planos_users.limit_import_burst_window_seconds is 'Janela (segundos) do burst para import.*';
comment on column public.planos_users.limit_import_burst_block_seconds is 'Tempo de bloqueio (segundos) do burst para import.*';
