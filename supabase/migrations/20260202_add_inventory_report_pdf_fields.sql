-- Adiciona campos de geracao de PDF no historico de relatorios.

alter table if exists public.inventory_report
  add column if not exists pdf_gerado_em timestamptz null;

alter table if exists public.inventory_report
  add column if not exists pdf_gerado_por uuid null;

alter table if exists public.inventory_report
  add constraint inventory_report_pdf_gerado_por_fkey
  foreign key (pdf_gerado_por) references public.app_users(id);

drop policy if exists inventory_report_update_owner on public.inventory_report;
create policy inventory_report_update_owner
  on public.inventory_report
  for update
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  )
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );
