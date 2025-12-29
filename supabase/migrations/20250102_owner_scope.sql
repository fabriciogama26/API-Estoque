-- Escopo por account_owner usando funções auxiliares.
-- Ajuste nomes/colunas conforme seu schema real antes de aplicar.

set check_function_bodies = off;

-- Retorna o owner (account) da sessão atual:
-- 1) se for dependente: owner_app_user_id em app_users_dependentes
-- 2) senão: coalesce(parent_user_id, id) em app_users (owner/admin)
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

comment on function public.current_account_owner_id is 'Retorna o owner (account) da sessão atual, considerando dependentes.';

revoke all on function public.current_account_owner_id() from public;
grant execute on function public.current_account_owner_id() to authenticated;

-- Flags de master/admin via roles (nome master/admin) ou colunas booleanas se existirem.
create or replace function public.current_actor_is_master()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with flags as (
    select coalesce((row_to_json(u)::jsonb ->> 'is_master')::boolean, false) as col_master
      from public.app_users u
     where u.id = auth.uid()
  ), roles_flag as (
    select exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid()
         and lower(r.name) = 'master'
    ) as role_master
  )
  select coalesce(f.col_master, false) or coalesce(r.role_master, false)
    from flags f cross join roles_flag r;
$$;

revoke all on function public.current_actor_is_master() from public;
grant execute on function public.current_actor_is_master() to authenticated;

-- app_users: leitura por owner scope ou master; update apenas self (demais via RPC).
alter table if exists public.app_users enable row level security;
alter table if exists public.app_users force row level security;

drop policy if exists app_users_scope_select on public.app_users;
create policy app_users_scope_select on public.app_users
  for select using (
    public.current_actor_is_master()
    or coalesce(parent_user_id, id) = public.current_account_owner_id()
  );

drop policy if exists app_users_self_update on public.app_users;
create policy app_users_self_update on public.app_users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- app_users_dependentes: leitura por owner scope ou master.
alter table if exists public.app_users_dependentes enable row level security;
alter table if exists public.app_users_dependentes force row level security;

drop policy if exists app_users_dep_scope_select on public.app_users_dependentes;
create policy app_users_dep_scope_select on public.app_users_dependentes
  for select using (
    public.current_actor_is_master()
    or owner_app_user_id = public.current_account_owner_id()
  );

-- app_users_credential_history: leitura por owner scope (owner_app_user_id) ou master; escrita via RPC.
alter table if exists public.app_users_credential_history enable row level security;
alter table if exists public.app_users_credential_history force row level security;

drop policy if exists app_users_history_select on public.app_users_credential_history;
create policy app_users_history_select on public.app_users_credential_history
  for select using (
    public.current_actor_is_master()
    or owner_app_user_id = public.current_account_owner_id()
  );

-- user_roles: leitura dentro do owner scope; escrita direta bloqueada (usar RPC).
alter table if exists public.user_roles enable row level security;
alter table if exists public.user_roles force row level security;

drop policy if exists user_roles_scope_select on public.user_roles;
create policy user_roles_scope_select on public.user_roles
  for select using (
    public.current_actor_is_master()
    or scope_parent_user_id = public.current_account_owner_id()
  );

drop policy if exists user_roles_block_write on public.user_roles;
create policy user_roles_block_write on public.user_roles for insert with check (false);
drop policy if exists user_roles_block_update on public.user_roles;
create policy user_roles_block_update on public.user_roles for update using (false) with check (false);
drop policy if exists user_roles_block_delete on public.user_roles;
create policy user_roles_block_delete on public.user_roles for delete using (false);

-- user_permission_overrides: leitura por owner scope (join app_users) ou master; escrita direta bloqueada (usar RPC).
alter table if exists public.user_permission_overrides enable row level security;
alter table if exists public.user_permission_overrides force row level security;

drop policy if exists overrides_select on public.user_permission_overrides;
create policy overrides_select on public.user_permission_overrides
  for select using (
    public.current_actor_is_master()
    or exists (
      select 1
        from public.app_users u
       where u.id = public.user_permission_overrides.user_id
         and coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
    )
  );

drop policy if exists overrides_block_write on public.user_permission_overrides;
create policy overrides_block_write on public.user_permission_overrides for insert with check (false);
drop policy if exists overrides_block_update on public.user_permission_overrides;
create policy overrides_block_update on public.user_permission_overrides for update using (false) with check (false);
drop policy if exists overrides_block_delete on public.user_permission_overrides;
create policy overrides_block_delete on public.user_permission_overrides for delete using (false);

-- app_errors e api_errors: leitura pelo proprio usuario (se desejar) ou master; ajuste conforme necessidade.
alter table if exists public.app_errors enable row level security;
alter table if exists public.app_errors force row level security;

drop policy if exists app_errors_scope_select on public.app_errors;
create policy app_errors_scope_select on public.app_errors
  for select using (
    public.current_actor_is_master()
    or user_id = auth.uid()
  );

-- Exemplo de policy para tabelas com account_owner_id (replicar para cada tabela de negócio).
-- Materiais:
alter table if exists public.materiais enable row level security;
alter table if exists public.materiais force row level security;

drop policy if exists materiais_owner_select on public.materiais;
create policy materiais_owner_select on public.materiais
  for select using (
    account_owner_id = public.current_account_owner_id()
    or public.current_actor_is_master()
  );

drop policy if exists materiais_owner_insert on public.materiais;
create policy materiais_owner_insert on public.materiais
  for insert with check (
    account_owner_id = public.current_account_owner_id()
  );

drop policy if exists materiais_owner_update on public.materiais;
create policy materiais_owner_update on public.materiais
  for update using (
    account_owner_id = public.current_account_owner_id()
  )
  with check (
    account_owner_id = public.current_account_owner_id()
  );

drop policy if exists materiais_owner_delete on public.materiais;
create policy materiais_owner_delete on public.materiais
  for delete using (
    account_owner_id = public.current_account_owner_id()
  );

-- Repita o padrão acima para todas as tabelas com account_owner_id (pessoas, entradas, saidas, hht_mensal, historicos, etc.).

