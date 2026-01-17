-- RLS para tabelas de RBAC usadas em Configuracoes.

DO $$
DECLARE
  r record;
  v_tables text[] := ARRAY[
    'permissions',
    'role_permissions',
    'user_permission_overrides'
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

-- permissions (catalogo global, somente leitura)
ALTER TABLE IF EXISTS public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY permissions_block_insert
  ON public.permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY permissions_block_update
  ON public.permissions
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY permissions_block_delete
  ON public.permissions
  FOR DELETE
  TO authenticated
  USING (false);

-- role_permissions (catalogo global, somente leitura)
ALTER TABLE IF EXISTS public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY role_permissions_block_insert
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY role_permissions_block_update
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY role_permissions_block_delete
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (false);

-- user_permission_overrides (leitura por escopo + escrita via admin)
ALTER TABLE IF EXISTS public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permission_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY user_permission_overrides_select_scope
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.app_users u
      WHERE u.id = user_permission_overrides.user_id
        AND coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
    )
  );

CREATE POLICY user_permission_overrides_insert_scope
  ON public.user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = user_permission_overrides.user_id
          AND coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
      )
    )
  );

CREATE POLICY user_permission_overrides_update_scope
  ON public.user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = user_permission_overrides.user_id
          AND coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
      )
    )
  )
  WITH CHECK (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = user_permission_overrides.user_id
          AND coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
      )
    )
  );

CREATE POLICY user_permission_overrides_delete_scope
  ON public.user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    public.is_master()
    OR (
      public.has_permission('rbac.manage'::text)
      AND EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = user_permission_overrides.user_id
          AND coalesce(u.parent_user_id, u.id) = public.current_account_owner_id()
      )
    )
  );
