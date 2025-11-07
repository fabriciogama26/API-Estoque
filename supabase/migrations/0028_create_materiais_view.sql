-- Cria uma view consolidando materiais com cores e características agregadas.
-- Inclui colunas resolvidas com joins para retornar nomes relacionados.
DO $$
DECLARE
  caracteristica_join_column text;
  cor_join_column text;
  create_view_sql text;
BEGIN
  -- Remove a view antiga para recriar com segurança
  EXECUTE 'DROP VIEW IF EXISTS public.materiais_view CASCADE';

  -- Detecta colunas de ligação
  SELECT column_name
  INTO caracteristica_join_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_caracteristica_epi'
    AND column_name IN ('grupo_caracteristica_epi_id','caracteristica_epi_id','grupo_caracteristica_epi')
  LIMIT 1;

  SELECT column_name
  INTO cor_join_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_cor'
    AND column_name IN ('grupo_material_cor','grupo_cor_id','grupo_cor','cor_id','cor')
  LIMIT 1;

  -- Cria view principal
  create_view_sql := format($sql$
CREATE OR REPLACE VIEW public.materiais_view AS
WITH caracteristicas_base AS (
  SELECT DISTINCT
    mgce.material_id,
    ce.id,
    TRIM(ce.caracteristica_material) AS caracteristica_material
  FROM public.material_grupo_caracteristica_epi AS mgce
  JOIN public.caracteristica_epi AS ce
    ON ce.id = mgce.%1$I
  WHERE TRIM(COALESCE(ce.caracteristica_material, '')) <> ''
),
caracteristicas AS (
  SELECT
    material_id,
    JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'nome', caracteristica_material) ORDER BY LOWER(caracteristica_material)) AS caracteristicas_json,
    ARRAY_AGG(caracteristica_material ORDER BY LOWER(caracteristica_material)) AS caracteristicas_nomes,
    STRING_AGG(caracteristica_material, '; ' ORDER BY LOWER(caracteristica_material)) AS caracteristicas_texto
  FROM caracteristicas_base
  GROUP BY material_id
),
cores_base AS (
  SELECT DISTINCT
    mgc.material_id,
    c.id,
    TRIM(c.cor) AS cor_nome
  FROM public.material_grupo_cor AS mgc
  JOIN public.cor AS c
    ON c.id = mgc.%2$I
  WHERE TRIM(COALESCE(c.cor, '')) <> ''
),
cores AS (
  SELECT
    material_id,
    JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'nome', cor_nome) ORDER BY LOWER(cor_nome)) AS cores_json,
    ARRAY_AGG(cor_nome ORDER BY LOWER(cor_nome)) AS cores_nomes,
    STRING_AGG(cor_nome, '; ' ORDER BY LOWER(cor_nome)) AS cores_texto
  FROM cores_base
  GROUP BY material_id
)
SELECT
  m.*,
  gm.nome AS "grupoMaterialNome",
  gmi2.nome AS "nomeItemRelacionado",
  mc.numero_calcado AS "numeroCalcadoNome",
  mv.medidas AS "numeroVestimentaNome",
  COALESCE(
    NULLIF(uc.display_name, ''),
    NULLIF(uc.username, ''),
    m."usuarioCadastro"::text
  ) AS "usuarioCadastroNome",
  COALESCE(
    NULLIF(ua.display_name, ''),
    NULLIF(ua.username, ''),
    m."usuarioAtualizacao"::text
  ) AS "usuarioAtualizacaoNome",
  COALESCE(caracteristicas.caracteristicas_json, '[]'::jsonb) AS caracteristicas,
  COALESCE(caracteristicas.caracteristicas_nomes, '{}'::text[]) AS caracteristicas_nomes,
  COALESCE(caracteristicas.caracteristicas_texto, '') AS caracteristicas_texto,
  COALESCE(cores.cores_json, '[]'::jsonb) AS cores,
  COALESCE(cores.cores_nomes, '{}'::text[]) AS cores_nomes,
  COALESCE(cores.cores_texto, '') AS cores_texto
FROM public.materiais AS m
LEFT JOIN public.grupos_material AS gm ON gm.id::text = m."grupoMaterial"::text
LEFT JOIN public.grupos_material_itens AS gmi2 ON gmi2.id::text = m.nome::text
LEFT JOIN public.medidas_calcado AS mc ON mc.id::text = m."numeroCalcado"::text
LEFT JOIN public.medidas_vestimentas AS mv ON mv.id::text = m."numeroVestimenta"::text
LEFT JOIN public.app_users AS uc ON uc.id::text = m."usuarioCadastro"::text
LEFT JOIN public.app_users AS ua ON ua.id::text = m."usuarioAtualizacao"::text
LEFT JOIN caracteristicas ON caracteristicas.material_id = m.id
LEFT JOIN cores ON cores.material_id = m.id;
$sql$, caracteristica_join_column, cor_join_column);

  EXECUTE create_view_sql;

  EXECUTE 'GRANT SELECT ON public.materiais_view TO authenticated, anon, service_role';
END
$$;
