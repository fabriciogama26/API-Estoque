-- Cria tabela inventory_report para armazenar relatorios de estoque.

create table if not exists public.inventory_report (
  id uuid not null default gen_random_uuid(),
  account_owner_id uuid not null default public.my_owner_id(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  periodo_inicio date not null,
  periodo_fim date not null,
  termo text not null default '',
  pareto_saida jsonb not null default '{}'::jsonb,
  pareto_risco jsonb not null default '{}'::jsonb,
  pareto_financeiro jsonb not null default '{}'::jsonb,
  metadados jsonb not null default '{}'::jsonb,
  constraint inventory_report_pkey primary key (id)
);

alter table if exists public.inventory_report
  add constraint inventory_report_account_owner_id_fkey
  foreign key (account_owner_id) references public.app_users(id);

alter table if exists public.inventory_report
  add constraint inventory_report_created_by_fkey
  foreign key (created_by) references public.app_users(id);

create index if not exists inventory_report_owner_period_idx
  on public.inventory_report (account_owner_id, periodo_inicio, periodo_fim);

create index if not exists inventory_report_owner_meta_idx
  on public.inventory_report (account_owner_id, (metadados->>'tipo'), (metadados->>'origem'));

create index if not exists inventory_report_created_at_idx
  on public.inventory_report (created_at desc);

alter table if exists public.inventory_report enable row level security;
alter table if exists public.inventory_report force row level security;

drop policy if exists inventory_report_select_owner on public.inventory_report;
create policy inventory_report_select_owner
  on public.inventory_report
  for select
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists inventory_report_insert_owner on public.inventory_report;
create policy inventory_report_insert_owner
  on public.inventory_report
  for insert
  to authenticated
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );
