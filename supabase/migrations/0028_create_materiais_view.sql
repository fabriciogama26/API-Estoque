-- Cria uma view consolidando materiais com cores e características agregadas.
-- Inclui colunas resolvidas com joins para retornar nomes relacionados.
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS public.materiais_view CASCADE';

  EXECUTE $sql$
  CREATE OR REPLACE VIEW public.materiais_view AS
  WITH caracteristica_bruta AS (
    SELECT
      mgce.material_id,
      ce.caracteristica_material
    FROM public.material_grupo_caracteristica_epi AS mgce
    LEFT JOIN public.caracteristica_epi AS ce
      ON ce.id::text = mgce.grupo_caracteristica_epi::text
  ),
  caracteristicas AS (
    SELECT
      material_id,
      STRING_AGG(caracteristica_material, '; ' ORDER BY LOWER(caracteristica_material)) AS "caracteristicaNome"
    FROM (
      SELECT DISTINCT material_id, caracteristica_material
      FROM caracteristica_bruta
      WHERE caracteristica_material IS NOT NULL
    ) sub
    GROUP BY material_id
  ),
  cor_bruta AS (
    SELECT
      mgc.material_id,
      c.cor
    FROM public.material_grupo_cor AS mgc
    LEFT JOIN public.cor AS c
      ON c.id::text = mgc.grupo_material_cor::text
  ),
  cores AS (
    SELECT
      material_id,
      STRING_AGG(cor, '; ' ORDER BY LOWER(cor)) AS "corNome"
    FROM (
      SELECT DISTINCT material_id, cor
      FROM cor_bruta
      WHERE cor IS NOT NULL
    ) sub
    GROUP BY material_id
  )
  SELECT
    m.*,
    gmi.nome AS "materialItemNome",
    fab.fabricante AS "fabricanteNome",
    gm.nome AS "grupoMaterialNome",
    mc.numero_calcado AS "numeroCalcadoNome",
    mv.medidas AS "numeroVestimentaNome",
    COALESCE(uc.display_name, uc.username, m."usuarioCadastro"::text) AS "usuarioCadastroNome",
    COALESCE(ua.display_name, ua.username, m."usuarioAtualizacao"::text) AS "usuarioAtualizacaoNome",
    COALESCE(caracteristicas."caracteristicaNome", '-') AS "caracteristicaNome",
    COALESCE(cores."corNome", '-') AS "corNome"
  FROM public.materiais AS m
  LEFT JOIN public.grupos_material_itens AS gmi ON gmi.id::text = m."nome"::text
  LEFT JOIN public.fabricantes AS fab ON fab.id::text = m."fabricante"::text
  LEFT JOIN public.grupos_material AS gm ON gm.id::text = m."grupoMaterial"::text
  LEFT JOIN public.medidas_calcado AS mc ON mc.id::text = m."numeroCalcado"::text
  LEFT JOIN public.medidas_vestimentas AS mv ON mv.id::text = m."numeroVestimenta"::text
  LEFT JOIN public.app_users AS uc ON uc.id::text = m."usuarioCadastro"::text
  LEFT JOIN public.app_users AS ua ON ua.id::text = m."usuarioAtualizacao"::text
  LEFT JOIN caracteristicas ON caracteristicas.material_id = m.id
  LEFT JOIN cores ON cores.material_id = m.id;
  $sql$;

  EXECUTE 'GRANT SELECT ON public.materiais_view TO authenticated, anon, service_role';
END
$$;
