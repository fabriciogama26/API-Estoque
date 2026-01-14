-- Preflight de material para o frontend decidir se deve prosseguir com o cadastro/edição.
--
-- Regras:
-- 1) CA duplicado em outro registro visível (dentro do escopo por owner) -> BLOQUEIA.
-- 2) Base igual (fabricante + grupo + item + número + cores + características)
--    e CA ausente (do novo OU do existente) -> BLOQUEIA.
-- 3) Base igual (mesmos campos acima) e CA diferente (ambos preenchidos)
--    -> ALERTA para confirmação (BASE_CA_DIFF).
--
-- Escopo por owner:
-- - Se p_account_owner_id vier preenchido: compara somente com esse owner (ou legados owner NULL).
-- - Se p_account_owner_id for NULL: usa o owner da sessÃ£o (public.my_owner_id()).
--
-- Edição:
-- - Se p_material_id vier preenchido:
--     exclui o próprio registro da busca (m.id <> p_material_id).
--
-- Observação importante (arrays):
-- - Arrays NULL, vazios ou contendo apenas NULL são normalizados
--   para sentinels (__sem_cor__ / __sem_carac__), garantindo
--   comparação correta com registros sem vínculos no banco.

----------------------------------------------------------------------
-- 1) Drop qualquer assinatura antiga da função (overloads)
----------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'material_preflight_check'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ';';
  END LOOP;
END;
$$;

----------------------------------------------------------------------
-- 2) Criação da função corrigida
----------------------------------------------------------------------
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
  p_material_id uuid DEFAULT NULL          -- create = NULL | update = id
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
  --------------------------------------------------------------------
  -- Resolve número: específico > calçado > vestimenta
  --------------------------------------------------------------------
  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_calcado), '');
  END IF;

  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_vestimenta), '');
  END IF;

  v_numero_norm := COALESCE(v_numero, v_numero_sentinel);

  --------------------------------------------------------------------
  -- Normalização de cores (ordem não importa)
  -- Trata: NULL | [] | [NULL] | mistura -> __sem_cor__
  --------------------------------------------------------------------
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

  --------------------------------------------------------------------
  -- Normalização de características (ordem não importa)
  -- Trata: NULL | [] | [NULL] | mistura -> __sem_carac__
  --------------------------------------------------------------------
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

  --------------------------------------------------------------------
  -- Base normalizada para comparação
  --------------------------------------------------------------------
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

      -- Cores do banco normalizadas
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

      -- Características do banco normalizadas
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

  --------------------------------------------------------------------
  -- Avaliação das regras
  --------------------------------------------------------------------
  SELECT
    -- Regra 1: CA duplicado (mesma base + CA), ignorando o proprio
    EXISTS (
      SELECT 1
      FROM base b
      WHERE v_ca_norm IS NOT NULL
        AND b.ca_norm = v_ca_norm
        AND b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.nome = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
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

    -- IDs envolvidos na regra 3
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
