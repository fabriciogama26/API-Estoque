-- RLS hard reset for internal tables (not public).
-- Tables: app_users, app_users_dependentes, app_users_credential_history,
-- app_credentials_catalog, app_errors, api_errors, roles, user_roles, planos, planos_users.

DO $$
DECLARE
  r record;
  v_tables text[] := ARRAY[
    'app_users',
    'app_users_dependentes',
    'app_users_credential_history',
    'app_credentials_catalog',
    'app_errors',
    'api_errors',
    'roles',
    'user_roles',
    'planos',
    'planos_users'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (v_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- app_users
alter table if exists public.app_users enable row level security;
alter table if exists public.app_users force row level security;

create policy app_users_scope_select
  on public.app_users
  for select
  to authenticated
  using (
    public.current_actor_is_master()
    or coalesce(parent_user_id, id) = public.current_account_owner_id()
  );

create policy app_users_self_update
  on public.app_users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- app_users_dependentes
alter table if exists public.app_users_dependentes enable row level security;
alter table if exists public.app_users_dependentes force row level security;

create policy app_users_dep_scope_select
  on public.app_users_dependentes
  for select
  to authenticated
  using (
    public.current_actor_is_master()
    or owner_app_user_id = public.current_account_owner_id()
  );

create policy app_users_dep_block_insert
  on public.app_users_dependentes
  for insert
  to authenticated
  with check (false);

create policy app_users_dep_block_update
  on public.app_users_dependentes
  for update
  to authenticated
  using (false)
  with check (false);

-- app_users_credential_history
alter table if exists public.app_users_credential_history enable row level security;
alter table if exists public.app_users_credential_history force row level security;

create policy app_users_history_select
  on public.app_users_credential_history
  for select
  to authenticated
  using (
    public.current_actor_is_master()
    or owner_app_user_id = public.current_account_owner_id()
  );

create policy app_users_history_block_insert
  on public.app_users_credential_history
  for insert
  to authenticated
  with check (false);

create policy app_users_history_block_update
  on public.app_users_credential_history
  for update
  to authenticated
  using (false)
  with check (false);

-- app_credentials_catalog (read-only for authenticated)
alter table if exists public.app_credentials_catalog enable row level security;
alter table if exists public.app_credentials_catalog force row level security;

create policy app_credentials_select
  on public.app_credentials_catalog
  for select
  to authenticated
  using (true);

create policy app_credentials_block_insert
  on public.app_credentials_catalog
  for insert
  to authenticated
  with check (false);

create policy app_credentials_block_update
  on public.app_credentials_catalog
  for update
  to authenticated
  using (false)
  with check (false);

-- app_errors (insert allowed, select only for master)
alter table if exists public.app_errors enable row level security;

create policy app_errors_select_master
  on public.app_errors
  for select
  to authenticated
  using (public.current_actor_is_master());

create policy app_errors_insert_authenticated
  on public.app_errors
  for insert
  to authenticated
  with check (true);

create policy app_errors_block_update
  on public.app_errors
  for update
  to authenticated
  using (false)
  with check (false);

-- api_errors (service_role only)
alter table if exists public.api_errors enable row level security;

create policy api_errors_select_service_role
  on public.api_errors
  for select
  to service_role
  using (auth.role() = 'service_role');

create policy api_errors_insert_service_role
  on public.api_errors
  for insert
  to service_role
  with check (auth.role() = 'service_role');

-- roles (read-only for authenticated)
alter table if exists public.roles enable row level security;
alter table if exists public.roles force row level security;

create policy roles_select_authenticated
  on public.roles
  for select
  to authenticated
  using (true);

create policy roles_block_insert
  on public.roles
  for insert
  to authenticated
  with check (false);

create policy roles_block_update
  on public.roles
  for update
  to authenticated
  using (false)
  with check (false);

-- user_roles (read-only in owner scope)
alter table if exists public.user_roles enable row level security;
alter table if exists public.user_roles force row level security;

create policy user_roles_scope_select
  on public.user_roles
  for select
  to authenticated
  using (
    public.current_actor_is_master()
    or scope_parent_user_id = public.current_account_owner_id()
  );

create policy user_roles_block_insert
  on public.user_roles
  for insert
  to authenticated
  with check (false);

create policy user_roles_block_update
  on public.user_roles
  for update
  to authenticated
  using (false)
  with check (false);

-- planos / planos_users (read-only for authenticated)
DO $$
BEGIN
  IF to_regclass('public.planos') IS NOT NULL THEN
    EXECUTE 'alter table public.planos enable row level security';
    EXECUTE 'alter table public.planos force row level security';
    EXECUTE 'create policy planos_select_authenticated on public.planos for select to authenticated using (true)';
    EXECUTE 'create policy planos_block_insert on public.planos for insert to authenticated with check (false)';
    EXECUTE 'create policy planos_block_update on public.planos for update to authenticated using (false) with check (false)';
  END IF;

  IF to_regclass('public.planos_users') IS NOT NULL THEN
    EXECUTE 'alter table public.planos_users enable row level security';
    EXECUTE 'alter table public.planos_users force row level security';
    EXECUTE 'create policy planos_users_select_authenticated on public.planos_users for select to authenticated using (true)';
    EXECUTE 'create policy planos_users_block_insert on public.planos_users for insert to authenticated with check (false)';
    EXECUTE 'create policy planos_users_block_update on public.planos_users for update to authenticated using (false) with check (false)';
  END IF;
END $$;
