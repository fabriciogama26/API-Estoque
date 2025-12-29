-- Security hardening: funcoes de owner/roles, RPCs e RLS ajustados ao schema real (owner = parent/owner_app_user_id).
-- Revise antes de aplicar em producao.

set check_function_bodies = off;

-- Utilitario de mascara simples para e-mail.
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
           when p_email is null or length(btrim(p_email)) = 0 then null
           else regexp_replace(p_email, '(^.).*(@.+$)', '\1***\2')
         end;
$$;

comment on function public.mask_email is 'Mascara e-mail (primeiro caractere + *** + dominio).';

-- OWNER da sessao (fonte unica): dependente -> owner_app_user_id; principal -> coalesce(parent_user_id, id).
create or replace function public.current_account_owner_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  perform set_config('row_security', 'off', true);

  select d.owner_app_user_id
    into v_owner
    from public.app_users_dependentes d
   where d.auth_user_id = auth.uid()
   limit 1;

  if v_owner is not null then
    return v_owner;
  end if;

  select coalesce(u.parent_user_id, u.id)
    into v_owner
    from public.app_users u
   where u.id = auth.uid()
   limit 1;

  return v_owner;
end;
$$;

revoke all on function public.current_account_owner_id() from public;
grant execute on function public.current_account_owner_id() to authenticated;

-- Checa role (admin/master) no escopo do owner atual usando user_roles + roles.
create or replace function public.has_role(p_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_ok boolean;
begin
  perform set_config('row_security', 'off', true);
  v_owner := public.current_account_owner_id();

  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid()
       and ur.scope_parent_user_id = v_owner
       and lower(r.name) = lower(p_role)
  ) into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.is_master()
returns boolean
language sql
stable
as $$ select public.has_role('master'); $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select public.has_role('admin') or public.has_role('master'); $$;

-- RPC: busca usuarios dentro do owner scope (admin/master ou mesmo owner).
create or replace function public.search_users(
  p_term text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  username text,
  email_masked text,
  ativo boolean,
  parent_user_id uuid,
  owner_scope uuid
) language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_master boolean;
begin
  if p_term is null or length(trim(p_term)) < 2 then
    return;
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  return query
    select u.id,
           u.display_name,
           u.username,
           public.mask_email(u.email) as email_masked,
           u.ativo,
           u.parent_user_id,
           coalesce(u.parent_user_id, u.id) as owner_scope
      from public.app_users u
     where (
        v_is_master
        or coalesce(u.parent_user_id, u.id) = v_owner
      )
       and (
         u.username ilike '%' || trim(p_term) || '%'
         or u.display_name ilike '%' || trim(p_term) || '%'
         or u.email ilike '%' || trim(p_term) || '%'
       )
     order by u.display_name nulls last, u.username nulls last
     limit least(greatest(p_limit, 1), 50)
    offset greatest(p_offset, 0);
end;
$$;

comment on function public.search_users is 'Busca usuarios filtrando por owner scope do chamador e retorna email mascarado.';

-- RPC: define role do usuario (admin/master + mesmo owner; master pode atravessar).
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

  delete from public.user_roles
   where user_id = target_user_id
     and scope_parent_user_id = v_target_owner;

  if role_id is not null then
    insert into public.user_roles (user_id, role_id, scope_parent_user_id)
    values (target_user_id, role_id, v_target_owner);
  end if;
end;
$$;

-- RPC: define status ativo/inativo do usuario (admin/master + mesmo owner).
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

-- RPC: aplica overrides de permissoes (admin/master + mesmo owner).
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
    if v_key is not null then
      insert into public.user_permission_overrides (user_id, permission_key, allowed)
      values (target_user_id, v_key, v_allowed);
    end if;
  end loop;
end;
$$;

-- RPC: grava historico de credencial/permissoes (admin/master + mesmo owner).
create or replace function public.rpc_admin_write_credential_history(
  target_user_id uuid,
  owner_user_id uuid,
  dependent_id uuid,
  user_username text,
  changed_by uuid,
  changed_by_username text,
  before_pages jsonb,
  after_pages jsonb
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
    'role_update',
    null,
    null,
    before_pages,
    after_pages
  );
end;
$$;

-- RPC: reset de senha agora deve ser chamado via Edge Function.
create or replace function public.request_password_reset(
  target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
begin
  raise exception 'Reset de senha deve ser chamado via Edge Function request-password-reset.' using errcode = '0A000';
end;
$$;

comment on function public.request_password_reset is 'Reset protegido: use Edge Function request-password-reset.';

-- Definicao de search_path para evitar hijack em security definer.
alter function public.search_users(text, integer, integer) set search_path = public, pg_temp;
alter function public.rpc_admin_set_user_role(uuid, uuid) set search_path = public, pg_temp;
alter function public.rpc_admin_set_user_status(uuid, boolean) set search_path = public, pg_temp;
alter function public.rpc_admin_grant_permission_override(uuid, jsonb) set search_path = public, pg_temp;
alter function public.rpc_admin_write_credential_history(uuid, uuid, uuid, text, uuid, text, jsonb, jsonb) set search_path = public, pg_temp;
alter function public.request_password_reset(uuid) set search_path = public, pg_temp;

-- Revoga execute de todos e concede apenas para authenticated.
revoke all on function public.search_users(text, integer, integer) from public;
grant execute on function public.search_users(text, integer, integer) to authenticated;

revoke all on function public.rpc_admin_set_user_role(uuid, uuid) from public;
grant execute on function public.rpc_admin_set_user_role(uuid, uuid) to authenticated;

revoke all on function public.rpc_admin_set_user_status(uuid, boolean) from public;
grant execute on function public.rpc_admin_set_user_status(uuid, boolean) to authenticated;

revoke all on function public.rpc_admin_grant_permission_override(uuid, jsonb) from public;
grant execute on function public.rpc_admin_grant_permission_override(uuid, jsonb) to authenticated;

revoke all on function public.rpc_admin_write_credential_history(uuid, uuid, uuid, text, uuid, text, jsonb, jsonb) from public;
grant execute on function public.rpc_admin_write_credential_history(uuid, uuid, uuid, text, uuid, text, jsonb, jsonb) to authenticated;

revoke all on function public.request_password_reset(uuid) from public;
grant execute on function public.request_password_reset(uuid) to authenticated;

-- Habilita e força RLS nas tabelas sensiveis.
alter table if exists public.app_users enable row level security;
alter table if exists public.app_users force row level security;
alter table if exists public.app_users_dependentes enable row level security;
alter table if exists public.app_users_dependentes force row level security;
alter table if exists public.user_roles enable row level security;
alter table if exists public.user_roles force row level security;
alter table if exists public.user_permission_overrides enable row level security;
alter table if exists public.user_permission_overrides force row level security;
alter table if exists public.app_users_credential_history enable row level security;
alter table if exists public.app_users_credential_history force row level security;
alter table if exists public.app_errors enable row level security;
alter table if exists public.app_errors force row level security;

-- Policies baseadas em owner scope e roles.
do $$
begin
  drop policy if exists app_users_scope_select on public.app_users;
  create policy app_users_scope_select on public.app_users
    for select using (
      public.is_master()
      or coalesce(parent_user_id, id) = public.current_account_owner_id()
    );

  drop policy if exists app_users_self_update on public.app_users;
  create policy app_users_self_update on public.app_users
    for update using (id = auth.uid())
    with check (id = auth.uid());

  drop policy if exists app_users_dep_scope_select on public.app_users_dependentes;
  create policy app_users_dep_scope_select on public.app_users_dependentes
    for select using (
      public.is_master()
      or owner_app_user_id = public.current_account_owner_id()
    );

  drop policy if exists app_users_history_select on public.app_users_credential_history;
  create policy app_users_history_select on public.app_users_credential_history
    for select using (
      public.is_master()
      or owner_app_user_id = public.current_account_owner_id()
    );

  drop policy if exists user_roles_scope_select on public.user_roles;
  create policy user_roles_scope_select on public.user_roles
    for select using (
      public.is_master()
      or scope_parent_user_id = public.current_account_owner_id()
    );

  drop policy if exists user_roles_block_ins on public.user_roles;
  create policy user_roles_block_ins on public.user_roles for insert with check (false);
  drop policy if exists user_roles_block_upd on public.user_roles;
  create policy user_roles_block_upd on public.user_roles for update using (false) with check (false);
  drop policy if exists user_roles_block_del on public.user_roles;
  create policy user_roles_block_del on public.user_roles for delete using (false);

  drop policy if exists overrides_scope_select on public.user_permission_overrides;
  create policy overrides_scope_select on public.user_permission_overrides
    for select using (
      public.is_master()
      or exists (
        select 1
          from public.app_users u
         where u.id = public.user_permission_overrides.user_id
           and coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
      )
    );

  drop policy if exists overrides_block_ins on public.user_permission_overrides;
  create policy overrides_block_ins on public.user_permission_overrides for insert with check (false);
  drop policy if exists overrides_block_upd on public.user_permission_overrides;
  create policy overrides_block_upd on public.user_permission_overrides for update using (false) with check (false);
  drop policy if exists overrides_block_del on public.user_permission_overrides;
  create policy overrides_block_del on public.user_permission_overrides for delete using (false);

  drop policy if exists app_errors_scope_select on public.app_errors;
  create policy app_errors_scope_select on public.app_errors
    for select using (
      public.is_master()
      or user_id = auth.uid()
    );
end$$;

-- Para tabelas de negocio com account_owner_id, replique o padrao:
-- select/insert/update/delete exigindo account_owner_id = current_account_owner_id() (e master como excecao).
