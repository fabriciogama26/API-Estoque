-- Catalogo sem account_owner_id: somente SELECT publico (RLS ligado).
-- Remove policies DELETE de todas as tabelas.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
  p record;
  v_exclude text[] := ARRAY[
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
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'account_owner_id'
      )
      AND t.table_name <> ALL(v_exclude)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = r.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, r.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO public USING (true)',
      r.table_name || '_select_public',
      r.table_name
    );
  END LOOP;
END $$;
