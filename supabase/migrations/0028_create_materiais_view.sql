-- Cria uma view consolidando materiais com cores e características agregadas.
-- Inclui colunas resolvidas com joins para retornar nomes relacionados.
DO $$
DECLARE
  caracteristica_join_column text;
  caracteristica_nome_column text;
  caracteristica_join_clause text;
  caracteristica_nome_fallback text;
  caracteristica_id_fallback text;
  caracteristica_id_expr_sql text;
  caracteristica_nome_expr_sql text;
  cor_join_column text;
  cor_nome_column text;
  cor_join_clause text;
  cor_nome_fallback text;
  cor_id_fallback text;
  cor_id_expr_sql text;
  cor_nome_expr_sql text;
  material_item_id_column text;
  material_item_nome_column text;
  nome_item_relacionado_column text;
  material_item_id_base text;
  material_item_nome_base text;
  nome_item_relacionado_base text;
  material_item_id_expr_sql text;
  material_item_nome_expr_sql text;
  nome_item_relacionado_expr_sql text;
  material_item_join_expr text;
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
    AND column_name IN (
      'grupo_caracteristica_epi_id',
      'caracteristica_epi_id',
      'grupo_caracteristica_epi',
      'grupoCaracteristicaEpiId',
      'caracteristicaEpiId',
      'grupoCaracteristicaEpi'
    )
  LIMIT 1;

  SELECT column_name
  INTO caracteristica_nome_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_caracteristica_epi'
    AND column_name IN (
      'caracteristica_epi',
      'caracteristicaEpi',
      'nome_caracteristica',
      'nomeCaracteristica'
    )
  LIMIT 1;

  SELECT column_name
  INTO cor_join_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_cor'
    AND column_name IN (
      'grupo_material_cor',
      'grupo_cor_id',
      'grupo_cor',
      'cor_id',
      'grupoMaterialCorId',
      'grupoCorId',
      'grupoCor',
      'corId'
    )
  LIMIT 1;

  SELECT column_name
  INTO cor_nome_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_cor'
    AND column_name IN (
      'cor',
      'cor_nome',
      'nome_cor',
      'nomeCor'
    )
  LIMIT 1;

  SELECT column_name
  INTO material_item_id_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materiais'
    AND column_name IN (
      'materialItemId',
      'material_item_id',
      'item_relacionado_id',
      'itemRelacionadoId',
      'grupoMaterialItemId',
      'grupo_material_item_id'
    )
  ORDER BY array_position(ARRAY[
      'materialItemId',
      'material_item_id',
      'item_relacionado_id',
      'itemRelacionadoId',
      'grupoMaterialItemId',
      'grupo_material_item_id'
    ], column_name)
  LIMIT 1;

  SELECT column_name
  INTO material_item_nome_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materiais'
    AND column_name IN (
      'materialItemNome',
      'material_item_nome',
      'item_relacionado_nome',
      'itemRelacionadoNome'
    )
  ORDER BY array_position(ARRAY[
      'materialItemNome',
      'material_item_nome',
      'item_relacionado_nome',
      'itemRelacionadoNome'
    ], column_name)
  LIMIT 1;

  SELECT column_name
  INTO nome_item_relacionado_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materiais'
    AND column_name IN (
      'nomeItemRelacionado',
      'nome_item_relacionado',
      'nomeRelacionado',
      'nome_relacionado'
    )
  ORDER BY array_position(ARRAY[
      'nomeItemRelacionado',
      'nome_item_relacionado',
      'nomeRelacionado',
      'nome_relacionado'
    ], column_name)
  LIMIT 1;

  caracteristica_join_clause := CASE
    WHEN caracteristica_join_column IS NOT NULL THEN
      format('LEFT JOIN public.caracteristica_epi AS ce ON ce.id::text = mgce.%I::text', caracteristica_join_column)
    ELSE
      'LEFT JOIN public.caracteristica_epi AS ce ON FALSE'
  END;

  caracteristica_nome_fallback := CASE
    WHEN caracteristica_nome_column IS NOT NULL THEN
      format('NULLIF(TRIM(mgce.%I::text), '''')', caracteristica_nome_column)
    ELSE
      'NULL'
  END;

  caracteristica_id_fallback := CASE
    WHEN caracteristica_join_column IS NOT NULL THEN
      format('NULLIF(mgce.%I::text, '''')', caracteristica_join_column)
    WHEN caracteristica_nome_column IS NOT NULL THEN
      format('NULLIF(mgce.%I::text, '''')', caracteristica_nome_column)
    ELSE
      'NULL'
  END;

  caracteristica_nome_expr_sql := format(
    'TRIM(COALESCE(ce.caracteristica_material, %s))',
    caracteristica_nome_fallback
  );

  caracteristica_id_expr_sql := format(
    'COALESCE(ce.id::text, %s)',
    caracteristica_id_fallback
  );

  cor_join_clause := CASE
    WHEN cor_join_column IS NOT NULL THEN
      format('LEFT JOIN public.cor AS c ON c.id::text = mgc.%I::text', cor_join_column)
    ELSE
      'LEFT JOIN public.cor AS c ON FALSE'
  END;

  cor_nome_fallback := CASE
    WHEN cor_nome_column IS NOT NULL THEN
      format('NULLIF(TRIM(mgc.%I::text), '''')', cor_nome_column)
    ELSE
      'NULL'
  END;

  cor_id_fallback := CASE
    WHEN cor_join_column IS NOT NULL THEN
      format('NULLIF(mgc.%I::text, '''')', cor_join_column)
    WHEN cor_nome_column IS NOT NULL THEN
      format('NULLIF(mgc.%I::text, '''')', cor_nome_column)
    ELSE
      'NULL'
  END;

  cor_nome_expr_sql := format(
    'TRIM(COALESCE(c.cor, %s))',
    cor_nome_fallback
  );

  cor_id_expr_sql := format(
    'COALESCE(c.id::text, %s)',
    cor_id_fallback
  );

  material_item_id_base := CASE
    WHEN material_item_id_column IS NOT NULL THEN
      format('NULLIF(m.%I::text, '''')', material_item_id_column)
    ELSE
      'NULL'
  END;

  material_item_nome_base := CASE
    WHEN material_item_nome_column IS NOT NULL THEN
      format('NULLIF(TRIM(m.%I::text), '''')', material_item_nome_column)
    ELSE
      'NULL'
  END;

  nome_item_relacionado_base := CASE
    WHEN nome_item_relacionado_column IS NOT NULL THEN
      format('NULLIF(TRIM(m.%I::text), '''')', nome_item_relacionado_column)
    ELSE
      'NULL'
  END;

  material_item_join_expr := CASE
    WHEN material_item_id_column IS NOT NULL THEN
      format('COALESCE(NULLIF(m.%I::text, ''''), NULLIF(m.nome::text, ''''))', material_item_id_column)
    ELSE
      'NULLIF(m.nome::text, '''')'
  END;

  material_item_id_expr_sql := format(
    'COALESCE(%s, NULLIF(gmi2.id::text, ''''), NULLIF(m.nome::text, ''''))',
    material_item_id_base
  );

  material_item_nome_expr_sql := format(
    'COALESCE(%s, %s, NULLIF(gmi2.nome, ''''), NULLIF(m.nome, ''''))',
    material_item_nome_base,
    nome_item_relacionado_base
  );

  nome_item_relacionado_expr_sql := format(
    'COALESCE(%s, %s, NULLIF(gmi2.nome, ''''), NULLIF(m.nome, ''''))',
    nome_item_relacionado_base,
    material_item_nome_base
  );

  -- Cria view principal
  create_view_sql := format($sql$
CREATE OR REPLACE VIEW public.materiais_view AS
WITH caracteristicas_base AS (
  SELECT DISTINCT
    mgce.material_id,
    %1$s AS caracteristica_id,
    %2$s AS caracteristica_material
  FROM public.material_grupo_caracteristica_epi AS mgce
  %3$s
  WHERE %2$s IS NOT NULL AND %2$s <> ''
),
caracteristicas AS (
  SELECT
    material_id,
    JSONB_AGG(JSONB_BUILD_OBJECT('id', caracteristica_id, 'nome', caracteristica_material) ORDER BY LOWER(caracteristica_material)) AS caracteristicas_json,
    ARRAY_AGG(caracteristica_material ORDER BY LOWER(caracteristica_material)) AS caracteristicas_nomes,
    STRING_AGG(caracteristica_material, '; ' ORDER BY LOWER(caracteristica_material)) AS caracteristicas_texto
  FROM caracteristicas_base
  GROUP BY material_id
),
cores_base AS (
  SELECT DISTINCT
    mgc.material_id,
    %4$s AS cor_id,
    %5$s AS cor_nome
  FROM public.material_grupo_cor AS mgc
  %6$s
  WHERE %5$s IS NOT NULL AND %5$s <> ''
),
cores AS (
  SELECT
    material_id,
    JSONB_AGG(JSONB_BUILD_OBJECT('id', cor_id, 'nome', cor_nome) ORDER BY LOWER(cor_nome)) AS cores_json,
    ARRAY_AGG(cor_nome ORDER BY LOWER(cor_nome)) AS cores_nomes,
    STRING_AGG(cor_nome, '; ' ORDER BY LOWER(cor_nome)) AS cores_texto
  FROM cores_base
  GROUP BY material_id
)
SELECT
  m.*,
  %7$s AS "materialItemId",
  %8$s AS "materialItemNome",
  %9$s AS "nomeItemRelacionado",
  gm.nome AS "grupoMaterialNome",
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
LEFT JOIN public.grupos_material_itens AS gmi2 ON gmi2.id::text = %10$s
LEFT JOIN public.medidas_calcado AS mc ON mc.id::text = m."numeroCalcado"::text
LEFT JOIN public.medidas_vestimentas AS mv ON mv.id::text = m."numeroVestimenta"::text
LEFT JOIN public.app_users AS uc ON uc.id::text = m."usuarioCadastro"::text
LEFT JOIN public.app_users AS ua ON ua.id::text = m."usuarioAtualizacao"::text
LEFT JOIN caracteristicas ON caracteristicas.material_id = m.id
LEFT JOIN cores ON cores.material_id = m.id;
$sql$,
    caracteristica_id_expr_sql,
    caracteristica_nome_expr_sql,
    caracteristica_join_clause,
    cor_id_expr_sql,
    cor_nome_expr_sql,
    cor_join_clause,
    material_item_id_expr_sql,
    material_item_nome_expr_sql,
    nome_item_relacionado_expr_sql,
    material_item_join_expr);

  EXECUTE create_view_sql;

  EXECUTE 'GRANT SELECT ON public.materiais_view TO authenticated, anon, service_role';
END
$$;
