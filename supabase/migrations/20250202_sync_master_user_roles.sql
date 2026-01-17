-- Garante role master para usuarios com credential master (app_users).
-- Isso faz is_master()/has_permission funcionar via user_roles.

DO $$
DECLARE
  v_role_id uuid;
  v_cred_id uuid;
BEGIN
  select id
    into v_role_id
    from public.roles
   where lower(name) = 'master'
   limit 1;

  if v_role_id is null then
    raise notice 'Role master nao encontrada em public.roles.';
    return;
  end if;

  select id
    into v_cred_id
    from public.app_credentials_catalog
   where lower(id_text) = 'master'
   limit 1;

  if v_cred_id is null then
    raise notice 'Credencial master nao encontrada em public.app_credentials_catalog.';
    return;
  end if;

  insert into public.user_roles (user_id, role_id, scope_parent_user_id)
  select
    u.id,
    v_role_id,
    coalesce(u.parent_user_id, u.id)
  from public.app_users u
  where u.credential = v_cred_id
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = u.id
        and ur.role_id = v_role_id
        and ur.scope_parent_user_id = coalesce(u.parent_user_id, u.id)
    );
END;
$$;
