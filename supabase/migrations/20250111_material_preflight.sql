-- Preflight de material para o frontend decidir se deve prosseguir com o cadastro.
-- Regras:
-- 1) CA duplicado em outro grupo/item -> bloqueia.
-- 2) Base igual (fabricante+grupo+item+numero) e CA ausente (do novo ou do existente) -> bloqueia.
-- 3) Base igual e CA diferente (ambos preenchidos) -> alerta para confirmar (BASE_CA_DIFF).
-- Observa owner: se p_account_owner_id vier preenchido, compara apenas com registros do mesmo owner ou legados (owner NULL). Master (p_account_owner_id NULL) enxerga tudo.

-- Helper: normaliza qualquer tipo para texto minúsculo/trim.
DO $$
BEGIN
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

-- Recreation is needed because return type changed; drop existing signature first.
DO $$
DECLARE
  v_oid oid;
BEGIN
  SELECT p.oid
    INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'material_preflight_check'
    AND p.proargtypes = ARRAY[
      'uuid'::regtype::oid,
      'uuid'::regtype::oid,
      'uuid'::regtype::oid,
      'text'::regtype::oid,
      'uuid'::regtype::oid,
      'uuid'::regtype::oid,
      'text'::regtype::oid,
      'uuid'::regtype::oid,
      'uuid[]'::regtype::oid,
      'uuid[]'::regtype::oid
    ]::oidvector;

  IF v_oid IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION public.material_preflight_check(uuid, uuid, uuid, text, uuid, uuid, text, uuid, uuid[], uuid[]);';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.material_preflight_check(
  p_grupo uuid,
  p_nome uuid,
  p_fabricante uuid,
  p_numero_especifico text,
  p_numero_calcado uuid,
  p_numero_vestimenta uuid,
  p_ca text,
  p_account_owner_id uuid,
  p_cores_ids uuid[] DEFAULT NULL,
  p_caracteristicas_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  ca_conflict boolean,
  base_conflict_empty boolean,
  base_match_ca_diff boolean,
  base_match_ids uuid[]
) LANGUAGE plpgsql STABLE AS
$$
DECLARE
  v_ca_norm text := NULLIF(fn_normalize_any(p_ca), '');
  v_numero text := NULLIF(fn_normalize_any(p_numero_especifico), '');
  v_ca_sentinel constant text := '__sem_ca__';
  v_numero_sentinel constant text := '__sem_numero__';
  v_numero_norm text;
  v_cores_input text;
  v_caracteristicas_input text;
BEGIN
  -- Resolve numero: numeroEspecifico > numeroCalcado > numeroVestimenta
  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_calcado), '');
  END IF;
  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_vestimenta), '');
  END IF;
  v_numero_norm := COALESCE(v_numero, v_numero_sentinel);

  -- Normaliza arrays de cores e caracteristicas (ordem nao importa)
  SELECT COALESCE(array_to_string(ARRAY(SELECT unnest(p_cores_ids)::text ORDER BY 1), ';'), '__sem_cor__')
    INTO v_cores_input;
  SELECT COALESCE(array_to_string(ARRAY(SELECT unnest(p_caracteristicas_ids)::text ORDER BY 1), ';'), '__sem_carac__')
    INTO v_caracteristicas_input;

  WITH base AS (
    SELECT
      m.id,
      fn_normalize_any(m.fabricante) AS fab,
      fn_normalize_any(m."grupoMaterial") AS grp,
      fn_normalize_any(m.nome) AS nome,
      COALESCE(NULLIF(fn_normalize_any(public.material_resolve_numero(m.id)), ''), v_numero_sentinel) AS num,
      COALESCE(NULLIF(fn_normalize_any(m.ca), ''), '') AS ca_norm,
      COALESCE(
        (
          SELECT array_to_string(
            ARRAY(
              SELECT mgc.grupo_material_cor::text
              FROM public.material_grupo_cor mgc
              WHERE mgc.material_id = m.id
              ORDER BY mgc.grupo_material_cor::text
            ),
            ';'
          )
        ),
        '__sem_cor__'
      ) AS cores_ids,
      COALESCE(
        (
          SELECT array_to_string(
            ARRAY(
              SELECT mgce.grupo_caracteristica_epi::text
              FROM public.material_grupo_caracteristica_epi mgce
              WHERE mgce.material_id = m.id
              ORDER BY mgce.grupo_caracteristica_epi::text
            ),
            ';'
          )
        ),
        '__sem_carac__'
      ) AS carac_ids
    FROM public.materiais m
    WHERE
      p_account_owner_id IS NULL
      OR m.account_owner_id IS NULL
      OR m.account_owner_id = p_account_owner_id
  )
  SELECT
    -- CA igual (qualquer grupo/item): bloqueia
    EXISTS (
      SELECT 1 FROM base b
      WHERE v_ca_norm IS NOT NULL AND v_ca_norm <> ''
        AND b.ca_norm <> ''
        AND b.ca_norm = v_ca_norm
    ),
    -- Base igual + CA ausente (novo ou existente): bloqueia sem perguntar
    EXISTS (
      SELECT 1 FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.nome = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND (
          v_ca_norm IS NULL OR v_ca_norm = '' OR b.ca_norm = ''
        )
    ),
    -- Base igual + CA diferente (ambos preenchidos): pergunta
    EXISTS (
      SELECT 1 FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.nome = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND v_ca_norm IS NOT NULL AND v_ca_norm <> ''
        AND b.ca_norm <> ''
        AND b.ca_norm <> v_ca_norm
    ),
    (
      SELECT ARRAY_AGG(b.id)
      FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.nome = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND v_ca_norm IS NOT NULL AND v_ca_norm <> ''
        AND b.ca_norm <> ''
        AND b.ca_norm <> v_ca_norm
    )
  INTO ca_conflict, base_conflict_empty, base_match_ca_diff, base_match_ids;

  RETURN NEXT;
END;
$$;
