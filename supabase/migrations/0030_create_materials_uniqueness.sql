-- 0030_create_materials_uniqueness.sql
-- 1. VIEW agregando campos obrigatórios + cores/características ordenadas + hash
CREATE OR REPLACE VIEW public.materiais_unicos_view AS
WITH cores_agg AS (
  SELECT
    mgc.material_id,
    ARRAY_AGG(DISTINCT LOWER(TRIM(c.cor)) ORDER BY LOWER(TRIM(c.cor))) AS cores_array,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT LOWER(TRIM(c.cor)) ORDER BY LOWER(TRIM(c.cor))), ';') AS cores_string
  FROM public.material_grupo_cor mgc
  LEFT JOIN public.cor c ON c.id::text = mgc.grupo_material_cor::text
  GROUP BY mgc.material_id
),
caracteristicas_agg AS (
  SELECT
    mgce.material_id,
    ARRAY_AGG(DISTINCT LOWER(TRIM(ce.caracteristica_material)) ORDER BY LOWER(TRIM(ce.caracteristica_material))) AS caracteristicas_array,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT LOWER(TRIM(ce.caracteristica_material)) ORDER BY LOWER(TRIM(ce.caracteristica_material))), ';') AS caracteristicas_string
  FROM public.material_grupo_caracteristica_epi mgce
  LEFT JOIN public.caracteristica_epi ce ON ce.id::text = mgce.grupo_caracteristica_epi::text
  GROUP BY mgce.material_id
)
SELECT
  m.id,
  m.fabricante,
  m."grupoMaterial",
  m."numeroEspecifico",
  m."valorUnitario",
  m.ca,
  COALESCE(cores_agg.cores_array, ARRAY[]::text[]) AS cores_array,
  COALESCE(caracteristicas_agg.caracteristicas_array, ARRAY[]::text[]) AS caracteristicas_array,
  md5(
    LOWER(
      CONCAT_WS('|',
        COALESCE(m.fabricante::text, ''),
        COALESCE(m."grupoMaterial"::text, ''),
        COALESCE(m."numeroEspecifico"::text, ''),
        COALESCE(TO_CHAR(m."valorUnitario", 'FM999999990.00'), ''),
        COALESCE(NULLIF(m.ca, ''), ''),
        COALESCE(cores_agg.cores_string, ''),
        COALESCE(caracteristicas_agg.caracteristicas_string, '')
      )
    )
  ) AS hash_unico
FROM public.materiais m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
LEFT JOIN caracteristicas_agg ON caracteristicas_agg.material_id = m.id;

-- 2. Função auxiliar que calcula o hash completo de um material
CREATE OR REPLACE FUNCTION public.material_hash_completo(p_material_id uuid)
RETURNS text LANGUAGE sql STABLE AS
$$
SELECT md5(
  LOWER(
    CONCAT_WS('|',
      COALESCE(m.fabricante::text, ''),
      COALESCE(m."grupoMaterial"::text, ''),
      COALESCE(m."numeroEspecifico"::text, ''),
      COALESCE(TO_CHAR(m."valorUnitario", 'FM999999990.00'), ''),
      COALESCE(NULLIF(m.ca, ''), ''),
      COALESCE(cores.cores_string, ''),
      COALESCE(caracteristicas.caracteristicas_string, '')
    )
  )
)
FROM public.materiais m
LEFT JOIN (
  SELECT
    mgc.material_id,
    ARRAY_TO_STRING(
      ARRAY_AGG(DISTINCT LOWER(TRIM(c.cor)) ORDER BY LOWER(TRIM(c.cor))),
      ';'
    ) AS cores_string
  FROM public.material_grupo_cor mgc
  LEFT JOIN public.cor c ON c.id::text = mgc.grupo_material_cor::text
  WHERE mgc.material_id = p_material_id
  GROUP BY mgc.material_id
) cores ON cores.material_id = m.id
LEFT JOIN (
  SELECT
    mgce.material_id,
    ARRAY_TO_STRING(
      ARRAY_AGG(DISTINCT LOWER(TRIM(ce.caracteristica_material)) ORDER BY LOWER(TRIM(ce.caracteristica_material))),
      ';'
    ) AS caracteristicas_string
  FROM public.material_grupo_caracteristica_epi mgce
  LEFT JOIN public.caracteristica_epi ce ON ce.id::text = mgce.grupo_caracteristica_epi::text
  WHERE mgce.material_id = p_material_id
  GROUP BY mgce.material_id
) caracteristicas ON caracteristicas.material_id = m.id
WHERE m.id = p_material_id;
$$;

-- 3. Função de trigger para evitar duplicidade de materiais
DROP TRIGGER IF EXISTS impedir_material_duplicado ON public.materiais;

CREATE TRIGGER impedir_material_duplicado
AFTER INSERT OR UPDATE ON public.materiais
FOR EACH ROW
EXECUTE FUNCTION public.evitar_duplicidade_material();

-- Função que verifica duplicidade de materiais com base no hash completo
CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material()
RETURNS trigger AS
$$
DECLARE
  novo_hash text;
BEGIN
  -- calcula o hash do material que está sendo inserido ou atualizado
  SELECT public.material_hash_completo(NEW.id) INTO novo_hash;

  -- verifica se já existe outro material com o mesmo hash
  IF EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_completo(m.id) = novo_hash
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores e características.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
