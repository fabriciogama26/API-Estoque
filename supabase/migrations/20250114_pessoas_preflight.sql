-- Preflight e trigger de duplicidade para Pessoas
-- Regras:
-- 1) Bloqueio: matricula duplicada (escopo por account_owner_id; master enxerga todos).
-- 2) Alerta: nome igual e matricula diferente (retorna ids para o frontend decidir).
-- 3) Em UPDATE, ignora o proprio registro (p_pessoa_id / NEW.id).

-- Drop overloads antigos, se existirem
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'pessoas_preflight_check'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ';';
  END LOOP;
END;
$$;

-- Helper de normalizacao
CREATE OR REPLACE FUNCTION public.fn_normalize_any(p_val anyelement)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
SELECT lower(trim(coalesce(p_val::text, '')));
$$;

-- RPC de preflight
CREATE OR REPLACE FUNCTION public.pessoas_preflight_check(
  p_owner uuid,
  p_nome text,
  p_matricula text,
  p_pessoa_id uuid DEFAULT NULL   -- NULL=create, id=update
)
RETURNS TABLE (
  matricula_conflict boolean,
  nome_conflict boolean,
  conflict_ids uuid[]
) LANGUAGE plpgsql STABLE AS
$$
DECLARE
  v_nome_norm text := NULLIF(fn_normalize_any(p_nome), '');
  v_mat_norm text := NULLIF(fn_normalize_any(p_matricula), '');
BEGIN
  WITH base AS (
    SELECT
      id,
      NULLIF(fn_normalize_any(nome), '') AS nome_norm,
      NULLIF(fn_normalize_any(matricula), '') AS mat_norm
    FROM public.pessoas p
    WHERE
      (p_owner IS NULL OR p.account_owner_id IS NULL OR p.account_owner_id = p_owner)
      AND (p_pessoa_id IS NULL OR p.id <> p_pessoa_id)
  )
  SELECT
    EXISTS (
      SELECT 1 FROM base b
      WHERE v_mat_norm IS NOT NULL
        AND b.mat_norm = v_mat_norm
    ),
    EXISTS (
      SELECT 1 FROM base b
      WHERE v_nome_norm IS NOT NULL
        AND b.nome_norm = v_nome_norm
        AND b.mat_norm IS NOT NULL
        AND (v_mat_norm IS NULL OR b.mat_norm <> v_mat_norm)
    ),
    (
      SELECT ARRAY_AGG(b.id)
      FROM base b
      WHERE v_nome_norm IS NOT NULL
        AND b.nome_norm = v_nome_norm
        AND b.mat_norm IS NOT NULL
        AND (v_mat_norm IS NULL OR b.mat_norm <> v_mat_norm)
    )
  INTO matricula_conflict, nome_conflict, conflict_ids;

  RETURN NEXT;
END;
$$;

-- Trigger: bloqueia matricula duplicada (ignora o proprio em UPDATE)
CREATE OR REPLACE FUNCTION public.evitar_duplicidade_pessoa()
RETURNS trigger AS
$$
DECLARE
  v_mat_norm text;
  v_owner uuid;
BEGIN
  v_mat_norm := NULLIF(fn_normalize_any(NEW.matricula), '');
  v_owner := NEW.account_owner_id;

  IF v_mat_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.pessoas p
    WHERE (v_owner IS NULL OR p.account_owner_id IS NULL OR p.account_owner_id = v_owner)
      AND (TG_OP <> 'UPDATE' OR p.id <> NEW.id)
      AND NULLIF(fn_normalize_any(p.matricula), '') = v_mat_norm
  ) THEN
    RAISE EXCEPTION 'Ja existe pessoa com esta matricula.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS impedir_pessoa_duplicada ON public.pessoas;
CREATE TRIGGER impedir_pessoa_duplicada
BEFORE INSERT OR UPDATE ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.evitar_duplicidade_pessoa();
