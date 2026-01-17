-- Ajusta regras de CA para bloquear duplicidade por owner (independente da base).

CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off AS
$$
DECLARE
  v_ca_norm text;
  v_hash_base text;
  v_hash_completo text;
  v_owner uuid;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca), '');
  v_owner := COALESCE(NEW.account_owner_id, public.my_owner_id());

  -- Regra: C.A nao pode repetir dentro do mesmo owner (independente da base)
  IF v_ca_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca), '') = v_ca_norm
      AND (
        (v_owner IS NULL AND m.account_owner_id IS NULL)
        OR m.account_owner_id = v_owner
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe material cadastrado com este C.A.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  NEW.hash_base := v_hash_base;

  -- Em UPDATE, consolida hash completo para validacao adicional
  IF TG_OP = 'UPDATE' THEN
    v_hash_completo := public.material_hash_completo(NEW.id);
    NEW.hash_completo := v_hash_completo;

    IF v_ca_norm IS NULL AND EXISTS (
      SELECT 1 FROM public.materiais m
      WHERE public.material_hash_base(m.id) = v_hash_base
        AND public.material_hash_completo(m.id) = v_hash_completo
    ) THEN
      RAISE EXCEPTION 'Material duplicado com base igual e CA vazio.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.materiais m
      WHERE public.material_hash_completo(m.id) = v_hash_completo
    ) THEN
      RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material_update()
RETURNS trigger AS
$$
DECLARE
  v_ca_norm text;
  v_hash_base text;
  v_hash_completo text;
  v_owner uuid;
BEGIN
  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca), '');
  v_owner := COALESCE(NEW.account_owner_id, public.my_owner_id());

  -- Regra: C.A nao pode repetir dentro do mesmo owner (independente da base)
  IF v_ca_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca), '') = v_ca_norm
      AND (
        (v_owner IS NULL AND m.account_owner_id IS NULL)
        OR m.account_owner_id = v_owner
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe material cadastrado com este C.A.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  v_hash_completo := public.material_hash_completo(NEW.id);

  NEW.hash_base := v_hash_base;
  NEW.hash_completo := v_hash_completo;

  IF v_ca_norm IS NULL AND EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_base(m.id) = v_hash_base
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com base igual e CA vazio.';
  END IF;

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
  p_caracteristicas_ids uuid[] DEFAULT NULL,
  p_material_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ca_conflict boolean,
  base_conflict_empty boolean,
  base_match_ca_diff boolean,
  base_match_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ca_norm text := NULLIF(fn_normalize_any(p_ca), '');
  v_numero text := NULLIF(fn_normalize_any(p_numero_especifico), '');
  v_numero_sentinel constant text := '__sem_numero__';
  v_numero_norm text;
  v_cores_input text;
  v_caracteristicas_input text;
BEGIN
  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_calcado), '');
  END IF;

  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_vestimenta), '');
  END IF;

  v_numero_norm := COALESCE(v_numero, v_numero_sentinel);

  SELECT COALESCE(
           NULLIF(
             array_to_string(
               ARRAY(
                 SELECT x::text
                 FROM unnest(COALESCE(p_cores_ids, ARRAY[]::uuid[])) AS x
                 WHERE x IS NOT NULL
                 ORDER BY 1
               ),
               ';'
             ),
             ''
           ),
           '__sem_cor__'
         )
  INTO v_cores_input;

  SELECT COALESCE(
           NULLIF(
             array_to_string(
               ARRAY(
                 SELECT x::text
                 FROM unnest(COALESCE(p_caracteristicas_ids, ARRAY[]::uuid[])) AS x
                 WHERE x IS NOT NULL
                 ORDER BY 1
               ),
               ';'
             ),
             ''
           ),
           '__sem_carac__'
         )
  INTO v_caracteristicas_input;

  WITH base AS (
    SELECT
      m.id,
      fn_normalize_any(m.fabricante) AS fab,
      fn_normalize_any(m."grupoMaterial") AS grp,
      fn_normalize_any(m.nome) AS nome,
      COALESCE(
        NULLIF(fn_normalize_any(public.material_resolve_numero(m.id)), ''),
        v_numero_sentinel
      ) AS num,
      COALESCE(NULLIF(fn_normalize_any(m.ca), ''), '') AS ca_norm,
      COALESCE(
        NULLIF(
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
          ''
        ),
        '__sem_cor__'
      ) AS cores_ids,
      COALESCE(
        NULLIF(
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
          ''
        ),
        '__sem_carac__'
      ) AS carac_ids
    FROM public.materiais m
    WHERE
      (p_material_id IS NULL OR m.id <> p_material_id)
      AND (
        m.account_owner_id IS NULL
        OR m.account_owner_id = COALESCE(p_account_owner_id, public.my_owner_id())
      )
  )
  SELECT
    -- Regra 1: CA duplicado por owner (independente da base)
    EXISTS (
      SELECT 1
      FROM base b
      WHERE v_ca_norm IS NOT NULL
        AND b.ca_norm = v_ca_norm
    ),
    -- Regra 2: Base igual + CA ausente
    EXISTS (
      SELECT 1
      FROM base b
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
    -- Regra 3: Base igual + CA diferente
    EXISTS (
      SELECT 1
      FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.nome = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND v_ca_norm IS NOT NULL
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
        AND v_ca_norm IS NOT NULL
        AND b.ca_norm <> ''
        AND b.ca_norm <> v_ca_norm
    )
  INTO
    ca_conflict,
    base_conflict_empty,
    base_match_ca_diff,
    base_match_ids;

  RETURN NEXT;
END;
$$;
