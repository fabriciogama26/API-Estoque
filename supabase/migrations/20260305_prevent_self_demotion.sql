-- Impede que o usuario rebaixe/desative a propria credencial.

create or replace function public.rpc_admin_set_user_role(
  target_user_id uuid,
  role_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
  v_role_name text;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    if role_id is null then
      raise exception 'nao permitido rebaixar a propria credencial' using errcode = '42501';
    end if;
    select lower(name) into v_role_name from public.roles where id = role_id;
    if v_role_name is null or v_role_name not in ('admin', 'master') then
      raise exception 'nao permitido rebaixar a propria credencial' using errcode = '42501';
    end if;
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  delete from public.user_roles
   where user_id = target_user_id
     and scope_parent_user_id = v_target_owner;

  if role_id is not null then
    insert into public.user_roles (user_id, role_id, scope_parent_user_id)
    values (target_user_id, role_id, v_target_owner);
  end if;
end;
$$;

create or replace function public.rpc_admin_set_user_status(
  target_user_id uuid,
  status boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() and status = false then
    raise exception 'nao permitido desativar o proprio usuario' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  update public.app_users
     set ativo = status,
         updated_at = now()
   where id = target_user_id;
end;
$$;

create or replace function public.rpc_admin_grant_permission_override(
  target_user_id uuid,
  overrides jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
  v_item jsonb;
  v_key text;
  v_allowed boolean;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  delete from public.user_permission_overrides where user_id = target_user_id;

  if overrides is null then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(overrides)
  loop
    v_key := (v_item ->> 'permission_key');
    v_allowed := (v_item ->> 'allowed')::boolean;
    if target_user_id = auth.uid() and v_key = 'rbac.manage' and v_allowed is false then
      raise exception 'nao permitido remover permissao rbac.manage' using errcode = '42501';
    end if;
    if v_key is not null then
      insert into public.user_permission_overrides (user_id, permission_key, allowed)
      values (target_user_id, v_key, v_allowed);
    end if;
  end loop;
end;
$$;
