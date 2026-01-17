-- RLS reset for internal tables (app/auth/roles).
-- Cleans legacy/public policies and recreates a minimal, owner-scoped set.

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
ALTER TABLE IF EXISTS public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_users FORCE ROW LEVEL SECURITY;

CREATE POLICY app_users_select_scope
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    OR id = auth.uid()
    OR coalesce(parent_user_id, id) = public.current_account_owner_id()
  );

CREATE POLICY app_users_update_scope
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (
    public.is_master()
    OR id = auth.uid()
    OR (
      public.has_permission('users.manage'::text)
      AND coalesce(parent_user_id, id) = public.current_account_owner_id()
    )
  )
  WITH CHECK (
    public.is_master()
    OR id = auth.uid()
    OR (
      public.has_permission('users.manage'::text)
      AND coalesce(parent_user_id, id) = public.current_account_owner_id()
    )
  );

-- app_users_dependentes
ALTER TABLE IF EXISTS public.app_users_dependentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_users_dependentes FORCE ROW LEVEL SECURITY;

CREATE POLICY app_users_dependentes_select_scope
  ON public.app_users_dependentes
  FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    OR owner_app_user_id = public.current_account_owner_id()
    OR auth_user_id = auth.uid()
  );

CREATE POLICY app_users_dependentes_insert_scope
  ON public.app_users_dependentes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('users.manage'::text)
      AND owner_app_user_id = public.current_account_owner_id()
    )
  );

CREATE POLICY app_users_dependentes_update_scope
  ON public.app_users_dependentes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_master()
    OR (
      public.has_permission('users.manage'::text)
      AND owner_app_user_id = public.current_account_owner_id()
    )
  )
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('users.manage'::text)
      AND owner_app_user_id = public.current_account_owner_id()
    )
  );

-- app_users_credential_history
ALTER TABLE IF EXISTS public.app_users_credential_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_users_credential_history FORCE ROW LEVEL SECURITY;

CREATE POLICY app_users_credential_history_select_scope
  ON public.app_users_credential_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    OR coalesce(owner_app_user_id, user_id) = public.current_account_owner_id()
  );

CREATE POLICY app_users_credential_history_insert_scope
  ON public.app_users_credential_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('credentials.manage'::text)
      AND coalesce(owner_app_user_id, user_id) = public.current_account_owner_id()
    )
  );

-- app_credentials_catalog (read-only)
ALTER TABLE IF EXISTS public.app_credentials_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_credentials_catalog FORCE ROW LEVEL SECURITY;

CREATE POLICY app_credentials_catalog_select
  ON public.app_credentials_catalog
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY app_credentials_catalog_block_insert
  ON public.app_credentials_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY app_credentials_catalog_block_update
  ON public.app_credentials_catalog
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- app_errors (insert allowed for authenticated)
ALTER TABLE IF EXISTS public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_errors_insert_authenticated
  ON public.app_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY app_errors_select_master
  ON public.app_errors
  FOR SELECT
  TO authenticated
  USING (public.is_master());

-- api_errors (service_role only)
ALTER TABLE IF EXISTS public.api_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_errors_select_service_role
  ON public.api_errors
  FOR SELECT
  TO service_role
  USING (auth.role() = 'service_role');

CREATE POLICY api_errors_insert_service_role
  ON public.api_errors
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- roles (read-only)
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles FORCE ROW LEVEL SECURITY;

CREATE POLICY roles_select_authenticated
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY roles_block_insert
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY roles_block_update
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- user_roles (rbac.manage for writes, owner scope for reads)
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_scope
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    OR scope_parent_user_id = public.current_account_owner_id()
    OR user_id = auth.uid()
  );

CREATE POLICY user_roles_insert_scope
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND scope_parent_user_id = public.current_account_owner_id()
    )
  );

CREATE POLICY user_roles_update_scope
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND scope_parent_user_id = public.current_account_owner_id()
    )
  )
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND scope_parent_user_id = public.current_account_owner_id()
    )
  );

-- planos / planos_users (read-only)
DO $$
BEGIN
  IF to_regclass('public.planos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.planos FORCE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY planos_select_authenticated ON public.planos FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY planos_block_insert ON public.planos FOR INSERT TO authenticated WITH CHECK (false)';
    EXECUTE 'CREATE POLICY planos_block_update ON public.planos FOR UPDATE TO authenticated USING (false) WITH CHECK (false)';
  END IF;

  IF to_regclass('public.planos_users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.planos_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.planos_users FORCE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY planos_users_select_authenticated ON public.planos_users FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY planos_users_block_insert ON public.planos_users FOR INSERT TO authenticated WITH CHECK (false)';
    EXECUTE 'CREATE POLICY planos_users_block_update ON public.planos_users FOR UPDATE TO authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;
