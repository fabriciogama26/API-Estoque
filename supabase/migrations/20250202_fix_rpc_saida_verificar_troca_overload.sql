-- Remove overload antigo (3 parametros) que conflita com a assinatura atual.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_saida_verificar_troca'
      AND p.pronargs = 3
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ';';
  END LOOP;
END;
$$;
