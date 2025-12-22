-- Policy provisoria (substituida depois por rbac.manage) para gerir user_roles.

alter table public.user_roles enable row level security;

drop policy if exists "user_roles authenticated manage" on public.user_roles;
create policy "user_roles authenticated manage" on public.user_roles
  for all
  to authenticated
  using (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('estoque.write')
  )
  with check (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('estoque.write')
  );
