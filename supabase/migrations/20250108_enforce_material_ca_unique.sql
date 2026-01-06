-- Impede cadastrar/atualizar materiais com C.A associado a grupos/itens diferentes.
-- Regra: um C.A pode se repetir, mas apenas dentro do mesmo grupo e do mesmo item (nome).
-- Se o mesmo C.A aparecer com grupo ou item diferente, deve bloquear.

-- Garante helper de normalizacao (caso migration 0057 ainda nao tenha rodado).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_normalize_text'
      AND p.pronargs = 1
      AND p.proargtypes[0] = 'text'::regtype
  ) THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.fn_normalize_text(p_val text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $fn$
        SELECT lower(trim(coalesce(p_val, '')));
      $fn$;
    $ddl$;
  END IF;

  -- Helper tolerante para tipos diferentes (uuid/text/others) -> text.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_normalize_any'
      AND p.pronargs = 1
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

-- Normaliza valores vazios para evitar falsos nulos/duplicidades.
UPDATE public.materiais
SET ca = NULLIF(TRIM(ca), '')
WHERE ca IS NOT NULL;

-- Checa duplicidades atuais antes de aplicar a restricao.
DO $$
DECLARE
  dup_list text;
BEGIN
  WITH base AS (
    SELECT
      fn_normalize_any(ca) AS ca_norm,
      fn_normalize_any("grupoMaterial") AS grupo_norm,
      fn_normalize_any(nome) AS nome_norm
    FROM public.materiais
    WHERE ca IS NOT NULL
      AND length(trim(ca::text)) > 0
      AND length(trim(nome::text)) > 0
      AND length(trim("grupoMaterial"::text)) > 0
  ),
  conflitos AS (
    SELECT
      ca_norm,
      array_agg(DISTINCT format('grupo=%s, item=%s', grupo_norm, nome_norm)) AS combos
    FROM base
    GROUP BY ca_norm
    HAVING count(DISTINCT (grupo_norm, nome_norm)) > 1
  )
  SELECT string_agg(format('C.A %s: %s', ca_norm, array_to_string(combos, ' / ')), '; ')
  INTO dup_list
  FROM conflitos;

  IF dup_list IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar regra de C.A. unico por grupo/item. Ajuste os conflitos: %', dup_list;
  END IF;
END;
$$;

-- Remove indices anteriores e cria indice auxiliar (nao unico) para lookup por C.A normalizado.
DROP INDEX IF EXISTS materiais_ca_unique_idx;
DROP INDEX IF EXISTS materiais_nome_ca_unique_idx;
DROP INDEX IF EXISTS materiais_grupo_nome_ca_unique_idx;
DROP INDEX IF EXISTS materiais_ca_norm_idx;
CREATE INDEX IF NOT EXISTS materiais_ca_norm_idx
  ON public.materiais (fn_normalize_any(ca))
  WHERE ca IS NOT NULL AND length(trim(ca)) > 0;

-- Mensagem amigavel via trigger antes de bater no indice unico.
CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material()
RETURNS trigger AS
$$
DECLARE
  v_ca_norm text;
  v_grupo_norm text;
  v_nome_norm text;
BEGIN
  NEW.hash_base := public.material_hash_base(NEW.id);
  NEW.hash_completo := public.material_hash_completo(NEW.id);

  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca), '');
  v_grupo_norm := NULLIF(fn_normalize_any(NEW."grupoMaterial"), '');
  v_nome_norm := NULLIF(fn_normalize_any(NEW.nome), '');

  IF v_ca_norm IS NOT NULL AND v_nome_norm IS NOT NULL AND v_grupo_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca), '') = v_ca_norm
      AND (
        NULLIF(fn_normalize_any(m."grupoMaterial"), '') IS DISTINCT FROM v_grupo_norm OR
        NULLIF(fn_normalize_any(m.nome), '') IS DISTINCT FROM v_nome_norm
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe C.A associado a outro grupo ou item.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id AND m.hash_completo = NEW.hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas, valor e CA.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id AND m.hash_base = NEW.hash_base
  ) THEN
    RAISE EXCEPTION 'Material duplicado (mesmo fabricante/grupo/item/numero especifico).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
