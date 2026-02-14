-- Adds actor user reference and secures RLS for edge function error reports.

alter table if exists public.edge_functions_error_report
  alter column id drop identity if exists;

alter table if exists public.edge_functions_error_report
  alter column id drop default;

alter table if exists public.edge_functions_error_report
  alter column id type uuid using gen_random_uuid();

alter table if exists public.edge_functions_error_report
  alter column id set default gen_random_uuid();

drop sequence if exists public.edge_functions_error_report_id_seq;

alter table if exists public.edge_functions_error_report
  add column if not exists user_id uuid;

do $$
begin
  if to_regclass('public.edge_functions_error_report') is not null then
    if not exists (
      select 1
        from pg_constraint
       where conname = 'edge_functions_error_report_user_id_fkey'
    ) then
      execute 'alter table public.edge_functions_error_report add constraint edge_functions_error_report_user_id_fkey foreign key (user_id) references public.app_users(id) on delete set null';
    end if;

    execute 'create index if not exists edge_functions_error_report_user_id_idx on public.edge_functions_error_report (user_id)';
  end if;
end $$;

alter table if exists public.edge_functions_error_report enable row level security;
alter table if exists public.edge_functions_error_report force row level security;

drop policy if exists edge_functions_error_report_select_master on public.edge_functions_error_report;
create policy edge_functions_error_report_select_master
  on public.edge_functions_error_report
  for select
  to authenticated
  using (public.is_master());

drop policy if exists edge_functions_error_report_insert_service_role on public.edge_functions_error_report;
create policy edge_functions_error_report_insert_service_role
  on public.edge_functions_error_report
  for insert
  to service_role
  with check (auth.role() = 'service_role');
