-- Ajusta RBAC para gestão segura e remove dependência de credential legacy para master.

----------------------------
-- 1) Novas permissions de gestão
----------------------------
insert into public.permissions (key, description) values
  ('rbac.manage', 'Gerenciar roles e overrides'),
  ('users.manage', 'Gerenciar usuarios (ativar/inativar, dependentes)'),
  ('credentials.manage', 'Gerenciar catalogo/credenciais')
on conflict (key) do nothing;

-- Concede gestão para master/admin/owner
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('rbac.manage', 'users.manage', 'credentials.manage')
where lower(r.name) in ('master', 'admin', 'owner')
on conflict do nothing;

----------------------------
-- 2) has_permission: override deny/allow -> role, sem legado credential master
----------------------------
create or replace function public.has_permission(p_key text, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  with override as (
    select allowed
    from public.user_permission_overrides o
    where o.user_id = coalesce(p_user_id, auth.uid())
      and o.permission_key = p_key
    limit 1
  ),
  role_perm as (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = coalesce(p_user_id, auth.uid())
      and p.key = p_key
    limit 1
  )
  select case
           when exists(select 1 from override where allowed = false) then false
           when exists(select 1 from override where allowed = true) then true
           when exists(select 1 from role_perm) then true
           else false
         end;
$$;

comment on function public.has_permission(text, uuid) is 'Override deny tem prioridade, depois allow, depois role_permissions; sem legado credential master.';

----------------------------
-- 3) resolve_user_permissions: master só por role
----------------------------
create or replace function public.resolve_user_permissions(p_user_id uuid default auth.uid())
returns text[]
language sql
security definer
set search_path = public
as $$
  with is_master as (
    select exists(
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = coalesce(p_user_id, auth.uid())
        and lower(r.name) = 'master'
    ) as master_flag
  ),
  role_perms as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = coalesce(p_user_id, auth.uid())
  ),
  overrides as (
    select permission_key, allowed
    from public.user_permission_overrides
    where user_id = coalesce(p_user_id, auth.uid())
  ),
  merged as (
    select key
    from role_perms
    where key not in (
      select permission_key from overrides where allowed = false
    )
    union
    select permission_key
    from overrides
    where allowed = true
  )
  select
    case
      when (select master_flag from is_master) then
        array(select key from public.permissions)
      else
        coalesce(array(select key from merged), '{}')
    end;
$$;

comment on function public.resolve_user_permissions(uuid) is 'Permissões efetivas por roles/overrides; master apenas por role master.';

----------------------------
-- 4) v_me: is_master derivado de role master
----------------------------
create or replace view public.v_me as
with base as (
  select
    u.id as user_id,
    u.parent_user_id,
    public.my_owner_id(u.id) as owner_id,
    coalesce(u.perm_version, 1) as perm_version
  from public.app_users u
  where u.id = auth.uid()
),
roles_agg as (
  select ur.user_id, array_agg(distinct r.name) as roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
  group by ur.user_id
),
is_master as (
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and lower(r.name) = 'master'
  ) as master_flag
),
perms as (
  select public.resolve_user_permissions(auth.uid()) as permissions
)
select
  b.user_id,
  b.owner_id,
  b.parent_user_id,
  coalesce(ra.roles, '{}') as roles,
  perms.permissions as permissions,
  b.perm_version,
  (select master_flag from is_master) as is_master
from base b
left join roles_agg ra on ra.user_id = b.user_id
cross join perms;

comment on view public.v_me is 'Perfil do usuario autenticado: owner_id, parent_user_id, roles, permissions[], perm_version, is_master (somente role master).';

----------------------------
-- 5) Policies de gestão: usa rbac.manage
----------------------------
-- user_roles
drop policy if exists "user_roles authenticated manage" on public.user_roles;
create policy "user_roles authenticated manage" on public.user_roles
  for all
  to authenticated
  using (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('rbac.manage')
  )
  with check (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('rbac.manage')
  );

-- user_permission_overrides
drop policy if exists "user_permission_overrides authenticated manage" on public.user_permission_overrides;
create policy "user_permission_overrides authenticated manage" on public.user_permission_overrides
  for all
  to authenticated
  using (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('rbac.manage')
  )
  with check (
    public.my_owner_id(user_id) = public.my_owner_id()
    and public.has_permission('rbac.manage')
  );

-- Reconfirma RLS habilitada
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;
