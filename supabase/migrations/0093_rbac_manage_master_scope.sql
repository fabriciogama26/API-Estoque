-- Ajusta policies de gestão para permitir master gerenciar qualquer owner e admins dentro do próprio owner.

create or replace function public.is_role_master(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = coalesce(p_user_id, auth.uid())
      and lower(r.name) = 'master'
  );
$$;

comment on function public.is_role_master(uuid) is 'Retorna true se o usuário tiver role master (via user_roles).';

drop policy if exists "user_roles authenticated manage" on public.user_roles;
create policy "user_roles authenticated manage" on public.user_roles
  for all
  to authenticated
  using (
    (
      public.is_role_master()
      or public.my_owner_id(user_id) = public.my_owner_id()
    )
    and public.has_permission('rbac.manage')
  )
  with check (
    (
      public.is_role_master()
      or public.my_owner_id(user_id) = public.my_owner_id()
    )
    and public.has_permission('rbac.manage')
  );

drop policy if exists "user_permission_overrides authenticated manage" on public.user_permission_overrides;
create policy "user_permission_overrides authenticated manage" on public.user_permission_overrides
  for all
  to authenticated
  using (
    (
      public.is_role_master()
      or public.my_owner_id(user_id) = public.my_owner_id()
    )
    and public.has_permission('rbac.manage')
  )
  with check (
    (
      public.is_role_master()
      or public.my_owner_id(user_id) = public.my_owner_id()
    )
    and public.has_permission('rbac.manage')
  );

alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;
