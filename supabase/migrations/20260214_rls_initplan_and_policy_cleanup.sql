-- RLS performance: make auth/current_setting calls initplan-safe.
-- Cleanup redundant permissive policies.

-- app_users
drop policy if exists app_users_select_scope on public.app_users;
create policy app_users_select_scope
  on public.app_users
  for select
  to authenticated
  using (
    public.is_master()
    or id = (select auth.uid())
    or coalesce(parent_user_id, id) = public.current_account_owner_id()
  );

drop policy if exists app_users_update_scope on public.app_users;
create policy app_users_update_scope
  on public.app_users
  for update
  to authenticated
  using (
    public.is_master()
    or id = (select auth.uid())
    or (
      public.has_permission('users.manage'::text)
      and coalesce(parent_user_id, id) = public.current_account_owner_id()
    )
  )
  with check (
    public.is_master()
    or id = (select auth.uid())
    or (
      public.has_permission('users.manage'::text)
      and coalesce(parent_user_id, id) = public.current_account_owner_id()
    )
  );

-- app_users_dependentes
drop policy if exists app_users_dependentes_select_scope on public.app_users_dependentes;
create policy app_users_dependentes_select_scope
  on public.app_users_dependentes
  for select
  to authenticated
  using (
    public.is_master()
    or owner_app_user_id = public.current_account_owner_id()
    or auth_user_id = (select auth.uid())
  );

-- app_errors
drop policy if exists app_errors_insert_authenticated on public.app_errors;
create policy app_errors_insert_authenticated
  on public.app_errors
  for insert
  to authenticated
  with check (true);

drop policy if exists app_errors_select_master on public.app_errors;
create policy app_errors_select_master
  on public.app_errors
  for select
  to authenticated
  using (public.is_master());

drop policy if exists app_errors_select_authenticated on public.app_errors;

-- api_errors
drop policy if exists api_errors_select_service_role on public.api_errors;
create policy api_errors_select_service_role
  on public.api_errors
  for select
  to service_role
  using ((select auth.role()) = 'service_role');

drop policy if exists api_errors_insert_service_role on public.api_errors;
create policy api_errors_insert_service_role
  on public.api_errors
  for insert
  to service_role
  with check ((select auth.role()) = 'service_role');

-- auth_session_activity
drop policy if exists auth_session_activity_service_role on public.auth_session_activity;
create policy auth_session_activity_service_role
  on public.auth_session_activity
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- edge_functions_error_report
drop policy if exists edge_functions_error_report_insert_service_role on public.edge_functions_error_report;
create policy edge_functions_error_report_insert_service_role
  on public.edge_functions_error_report
  for insert
  to service_role
  with check ((select auth.role()) = 'service_role');

-- user_roles
drop policy if exists user_roles_select_scope on public.user_roles;
create policy user_roles_select_scope
  on public.user_roles
  for select
  to authenticated
  using (
    public.is_master()
    or scope_parent_user_id = public.current_account_owner_id()
    or user_id = (select auth.uid())
  );

-- user_permission_overrides
drop policy if exists user_permission_overrides_select_scope on public.user_permission_overrides;
create policy user_permission_overrides_select_scope
  on public.user_permission_overrides
  for select
  to authenticated
  using (
    public.is_master()
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.app_users u
      where u.id = user_permission_overrides.user_id
        and coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
    )
  );

-- basic_registration_history
drop policy if exists basic_registration_history_insert_owner on public.basic_registration_history;
create policy basic_registration_history_insert_owner
  on public.basic_registration_history
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or public.has_permission('basic_registration.write'::text)
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.materiais'::text)
    )
    and (
      public.is_master()
      or account_owner_id = public.my_owner_id()
      or (public.my_owner_id() is null and account_owner_id = (select auth.uid()))
    )
  );

-- status_saida: remove redundant permissive policy
drop policy if exists status_saida_select_public on public.status_saida;
