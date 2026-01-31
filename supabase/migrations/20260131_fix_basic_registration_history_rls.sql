-- Ajuste de RLS para historico do cadastro base.
-- Permite insert quando o usuario tem permissao de escrita equivalente (cadastro base, estoque ou pessoas).

alter table if exists public.basic_registration_history enable row level security;

drop policy if exists basic_registration_history_insert_owner on public.basic_registration_history;
create policy basic_registration_history_insert_owner
  on public.basic_registration_history
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('basic_registration.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('pessoas.write'::text)
    )
  );
