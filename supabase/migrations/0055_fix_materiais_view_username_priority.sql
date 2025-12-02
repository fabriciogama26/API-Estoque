-- Ajusta a prioridade de username na view de materiais e preenche usernames ausentes.
DO $$
BEGIN
  -- Preenche username vazio com display_name para evitar nulls.
  UPDATE public.app_users
  SET username = COALESCE(NULLIF(username, ''), NULLIF(display_name, ''))
  WHERE (username IS NULL OR username = '')
    AND (display_name IS NOT NULL AND display_name <> '');

  -- Recria view priorizando username antes de display_name.
  EXECUTE 'DROP VIEW IF EXISTS public.materiais_view CASCADE';

  EXECUTE $sql$
  CREATE OR REPLACE VIEW public.materiais_view AS
  WITH caracteristica_bruta AS (
    SELECT
      mgce.material_id,
      ce.id::text AS caracteristica_id,
      ce.caracteristica_material
    FROM public.material_grupo_caracteristica_epi AS mgce
    LEFT JOIN public.caracteristica_epi AS ce
      ON ce.id::text = mgce.grupo_caracteristica_epi::text
    WHERE ce.caracteristica_material IS NOT NULL
  ),
  caracteristicas_ord AS (
    SELECT DISTINCT ON (material_id, LOWER(TRIM(caracteristica_material)))
      material_id,
      caracteristica_id,
      caracteristica_material
    FROM caracteristica_bruta
    ORDER BY material_id, LOWER(TRIM(caracteristica_material))
  ),
  caracteristicas AS (
    SELECT
      material_id,
      ARRAY_AGG(caracteristica_id) AS caracteristicas_ids,
      ARRAY_AGG(caracteristica_material) AS caracteristicas_nome
    FROM caracteristicas_ord
    GROUP BY material_id
  ),
  cor_bruta AS (
    SELECT
      mgc.material_id,
      c.id::text AS cor_id,
      c.cor
    FROM public.material_grupo_cor AS mgc
    LEFT JOIN public.cor AS c
      ON c.id::text = mgc.grupo_material_cor::text
    WHERE c.cor IS NOT NULL
  ),
  cores_ord AS (
    SELECT DISTINCT ON (material_id, LOWER(TRIM(cor)))
      material_id,
      cor_id,
      cor
    FROM cor_bruta
    ORDER BY material_id, LOWER(TRIM(cor))
  ),
  cores AS (
    SELECT
      material_id,
      ARRAY_AGG(cor_id) AS cores_ids,
      ARRAY_AGG(cor) AS cores_nome
    FROM cores_ord
    GROUP BY material_id
  )
  SELECT
    m.id,
    m.nome,
    gmi.nome AS "materialItemNome",
    m.fabricante,
    fab.fabricante AS "fabricanteNome",
    m."validadeDias",
    m.ca,
    m."valorUnitario",
    m."estoqueMinimo",
    m.ativo,
    m.descricao,
    m."grupoMaterial",
    gm.nome AS "grupoMaterialNome",
    m."numeroCalcado",
    mc.numero_calcado AS "numeroCalcadoNome",
    m."numeroVestimenta",
    mv.medidas AS "numeroVestimentaNome",
    m."numeroEspecifico",
    cores.cores_ids AS "coresIds",
    cores.cores_nome AS "corNome",
    COALESCE(array_to_string(cores.cores_nome, '' ; ''), '''') AS "coresTexto",
    caracteristicas.caracteristicas_ids AS "caracteristicasIds",
    caracteristicas.caracteristicas_nome AS "caracteristicaNome",
    COALESCE(array_to_string(caracteristicas.caracteristicas_nome, '' ; ''), '''') AS "caracteristicasTexto",
    m."usuarioCadastro",
    COALESCE(uc.username, uc.display_name) AS "usuarioCadastroNome",
    uc.username AS "usuarioCadastroUsername",
    m."usuarioAtualizacao",
    COALESCE(ua.username, ua.display_name) AS "usuarioAtualizacaoNome",
    ua.username AS "usuarioAtualizacaoUsername",
    m."dataCadastro",
    m."atualizadoEm"
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
