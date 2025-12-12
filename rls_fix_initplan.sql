-- Gera DDL para corrigir as policies sinalizadas no lint 0003 (auth_rls_initplan).
-- Envolve chamadas a auth.<fn>() com (select auth.<fn>()) para evitar reavaliação linha a linha.
-- Execute este script em produção/staging; copie o resultado (coluna ddl) e rode os ALTER POLICY gerados.

WITH target_policies(schema_name, table_name, policy_name) AS (
  VALUES
    ('public', 'material_price_history', 'precos select'),
    ('public', 'material_price_history', 'precos modify'),
    ('public', 'materiais', 'materiais select'),
    ('public', 'pessoas', 'pessoas select'),
    ('public', 'pessoas', 'pessoas_update'),
    ('public', 'entradas', 'entradas insert authenticated'),
    ('public', 'entradas', 'entradas select'),
    ('public', 'entradas', 'entradas update authenticated'),
    ('public', 'saidas', 'saidas insert authenticated'),
    ('public', 'saidas', 'saidas select'),
    ('public', 'saidas', 'saidas update authenticated'),
    ('public', 'acidentes', 'acidentes select'),
    ('public', 'acidentes', 'acidentes insert authenticated'),
    ('public', 'acidentes', 'acidentes update authenticated'),
    ('public', 'app_users_credential_history', 'app_users_cred_hist select authenticated'),
    ('public', 'app_users_credential_history', 'app_users_cred_hist insert authenticated'),
    ('public', 'app_users', 'app_users admin update'),
    ('public', 'app_users', 'app_users admin insert'),
    ('public', 'app_users', 'app_users admin delete'),
    ('public', 'api_errors', 'api_errors select service_role'),
    ('public', 'api_errors', 'api_errors insert service_role')
)
SELECT
  CASE
    -- INSERT policies: só WITH CHECK é permitido
    WHEN p.polcmd = 'a' THEN format(
      $fmt$
ALTER POLICY %I ON %I.%I
  WITH CHECK (%s);
$fmt$,
      tp.policy_name,
      tp.schema_name,
      tp.table_name,
      regexp_replace(
        coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'true'),
        'auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '(select auth.\1(\2))',
        'g'
      )
    )
    -- SELECT ou DELETE: só USING é permitido
    WHEN p.polcmd IN ('r', 'd') THEN format(
      $fmt$
ALTER POLICY %I ON %I.%I
  USING (%s);
$fmt$,
      tp.policy_name,
      tp.schema_name,
      tp.table_name,
      regexp_replace(
        coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'),
        'auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '(select auth.\1(\2))',
        'g'
      )
    )
    -- UPDATE ou ALL: USING + WITH CHECK
    ELSE format(
      $fmt$
ALTER POLICY %I ON %I.%I
  USING (%s)
  WITH CHECK (%s);
$fmt$,
      tp.policy_name,
      tp.schema_name,
      tp.table_name,
      regexp_replace(
        coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'),
        'auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '(select auth.\1(\2))',
        'g'
      ),
      regexp_replace(
        coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'true'),
        'auth\.([a-zA-Z0-9_]+)\(([^)]*)\)',
        '(select auth.\1(\2))',
        'g'
      )
    )
  END AS ddl
FROM target_policies tp
JOIN pg_policy p ON p.polname = tp.policy_name
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = tp.schema_name
ORDER BY tp.schema_name, tp.table_name, tp.policy_name;
