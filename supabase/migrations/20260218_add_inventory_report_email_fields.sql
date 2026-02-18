-- Adiciona campos de controle de envio de email em inventory_report.

alter table if exists public.inventory_report
  add column if not exists email_status text null;

alter table if exists public.inventory_report
  add column if not exists email_enviado_em timestamptz null;

alter table if exists public.inventory_report
  add column if not exists email_erro text null;

alter table if exists public.inventory_report
  add column if not exists email_tentativas integer not null default 0;

create index if not exists inventory_report_email_status_idx
  on public.inventory_report (account_owner_id, email_status);
