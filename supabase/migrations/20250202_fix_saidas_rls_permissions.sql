-- Ajusta permissao de escrita em saidas para usar chaves existentes do app.

alter table if exists public.saidas enable row level security;

drop policy if exists saidas_insert_owner on public.saidas;
create policy saidas_insert_owner
  on public.saidas
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );

drop policy if exists saidas_update_owner on public.saidas;
create policy saidas_update_owner
  on public.saidas
  for update
  to authenticated
  using (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
  )
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );
