-- Adiciona coluna de quantidade de arquivos gerados no inventory_report.

alter table if exists public.inventory_report
  add column if not exists arquivos_total integer not null default 0;
