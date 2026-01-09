-- Replica as regras do INSERT (CA duplicado, base com CA vazio, hash completo) para UPDATE,
-- sempre ignorando o próprio registro (m.id <> NEW.id).

DO $$
BEGIN
  -- Garante helper fn_normalize_any
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_normalize_any' AND p.pronargs = 1
  ) THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.fn_normalize_any(p_val anyelement)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $fn$
        SELECT lower(trim(coalesce(p_val::text, '')));
      $fn$;
    $ddl$;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material_update()
RETURNS trigger AS
$$
DECLARE
  v_ca_norm text;
  v_hash_base text;
  v_hash_completo text;
BEGIN
  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca), '');

  -- Regra: C.A nao pode repetir na mesma base (fabricante+grupo+item+numero+cores+caracteristicas), ignorando o proprio
  IF v_ca_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca), '') = v_ca_norm
      AND public.material_hash_base(m.id) = public.material_hash_base(NEW.id)
      AND public.material_hash_completo(m.id) = public.material_hash_completo(NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ja existe material cadastrado com este C.A. na mesma base.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  v_hash_completo := public.material_hash_completo(NEW.id);

  NEW.hash_base := v_hash_base;
  NEW.hash_completo := v_hash_completo;

  -- Se CA estiver vazio, bloquear base igual (fabricante+grupo+item+numero+cores+caracteristicas) sem perguntar (ignorando o proprio)
  IF v_ca_norm IS NULL AND EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_base(m.id) = v_hash_base
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com base igual e CA vazio.';
  END IF;

  -- Hash completo igual (cores/caracteristicas e C.A.), ignorando o proprio
  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS impedir_material_duplicado_update ON public.materiais;
CREATE TRIGGER impedir_material_duplicado_update
BEFORE UPDATE ON public.materiais
FOR EACH ROW
EXECUTE FUNCTION public.evitar_duplicidade_material_update();
