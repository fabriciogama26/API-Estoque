-- Restringe gestão de roles/overrides para impedir dependente-admin de alterar titular ou dar master.

create or replace function public.is_owner(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.app_users where id = p_user_id and parent_user_id is null
  );
$$;

comment on function public.is_owner(uuid) is 'Retorna true se o usuario for titular (parent_user_id is null).';

drop policy if exists "user_roles authenticated manage" on public.user_roles;
create policy "user_roles authenticated manage" on public.user_roles
  for all
  to authenticated
  using (
    (
      public.is_role_master()
      or (
        public.my_owner_id(user_id) = public.my_owner_id()
        and not public.is_owner(user_id)
        and not exists (
          select 1 from public.roles r where r.id = user_roles.role_id and lower(r.name) = 'master'
        )
      )
    )
    and public.has_permission('rbac.manage')
  )
  with check (
    (
      public.is_role_master()
      or (
        public.my_owner_id(user_id) = public.my_owner_id()
        and not public.is_owner(user_id)
        and not exists (
          select 1 from public.roles r where r.id = user_roles.role_id and lower(r.name) = 'master'
        )
      )
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
      or (
        public.my_owner_id(user_id) = public.my_owner_id()
        and not public.is_owner(user_id)
      )
    )
    and public.has_permission('rbac.manage')
  )
  with check (
    (
      public.is_role_master()
      or (
        public.my_owner_id(user_id) = public.my_owner_id()
        and not public.is_owner(user_id)
      )
    )
    and public.has_permission('rbac.manage')
  );

alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;
