-- Expande permissoes de pagina para as permissoes base exigidas pela RLS.

create or replace function public.expand_permission_dependencies(p_permissions text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  with recursive deps(permission_key) as (
    select distinct nullif(btrim(value), '')
    from unnest(coalesce(p_permissions, '{}'::text[])) as value

    union

    select mapping.depends_on
    from deps
    join (
      values
        ('estoque.dashboard', 'estoque.read'),
        ('dashboard_analise_estoque', 'estoque.read'),
        ('estoque.atual', 'estoque.read'),
        ('estoque.entradas', 'estoque.read'),
        ('estoque.saidas', 'estoque.read'),
        ('estoque.saidas', 'pessoas.read'),
        ('estoque.materiais', 'estoque.read'),
        ('estoque.termo', 'estoque.read'),
        ('estoque.termo', 'pessoas.read'),
        ('estoque.relatorio', 'estoque.read'),
        ('estoque.reprocessar', 'estoque.read'),
        ('acidentes.dashboard', 'acidentes.read')
    ) as mapping(permission_key, depends_on)
      on mapping.permission_key = deps.permission_key
    where nullif(btrim(mapping.depends_on), '') is not null
  )
  select coalesce(
    array(
      select distinct permission_key
      from deps
      where permission_key is not null
      order by permission_key
    ),
    '{}'::text[]
  );
$$;

comment on function public.expand_permission_dependencies(text[]) is
  'Expande permissoes de pagina em permissoes base exigidas pela RLS.';

create or replace function public.has_permission(p_key text, p_user_id uuid default auth.uid())
returns boolean
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
  override as (
    select allowed
    from public.user_permission_overrides o
    where o.user_id = coalesce(p_user_id, auth.uid())
      and o.permission_key = p_key
    limit 1
  ),
  role_perm as (
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
    from role_perm
    where key not in (
      select permission_key from overrides where allowed = false
    )
    union
    select permission_key
    from overrides
    where allowed = true
  ),
  effective as (
    select case
      when (select master_flag from is_master) then array(select key from public.permissions)
      else public.expand_permission_dependencies(coalesce(array(select key from merged), '{}'::text[]))
    end as permissions
  )
  select case
    when exists(select 1 from override where allowed = false) then false
    when exists(select 1 from override where allowed = true) then true
    else coalesce(p_key = any((select permissions from effective)), false)
  end;
$$;

comment on function public.has_permission(text, uuid) is
  'Resolve permissoes por roles/overrides e expande dependencias de permissao exigidas pela RLS.';

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
  select case
    when (select master_flag from is_master) then array(select key from public.permissions)
    else public.expand_permission_dependencies(coalesce(array(select key from merged), '{}'::text[]))
  end;
$$;

comment on function public.resolve_user_permissions(uuid) is
  'Permissoes efetivas por roles/overrides, com expansao de dependencias de pagina exigidas pela RLS.';
