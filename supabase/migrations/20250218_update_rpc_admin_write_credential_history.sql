-- Permite registrar diferentes acoes no historico de credenciais (ex.: password_reset).

create or replace function public.rpc_admin_write_credential_history(
  target_user_id uuid,
  owner_user_id uuid,
  dependent_id uuid,
  user_username text,
  changed_by uuid,
  changed_by_username text,
  before_pages jsonb,
  after_pages jsonb,
  p_action text default 'role_update',
  p_before_credential text default null,
  p_after_credential text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
  v_action text := nullif(trim(coalesce(p_action, 'role_update')), '');
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

  insert into public.app_users_credential_history (
    user_id,
    target_auth_user_id,
    owner_app_user_id,
    target_dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    action,
    before_credential,
    after_credential,
    before_pages,
    after_pages
  ) values (
    owner_user_id,
    target_user_id,
    v_target_owner,
    dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    v_action,
    p_before_credential,
    p_after_credential,
    before_pages,
    after_pages
  );
end;
$$;

revoke all on function public.rpc_admin_write_credential_history(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text
) from public;

grant execute on function public.rpc_admin_write_credential_history(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text
) to authenticated;
