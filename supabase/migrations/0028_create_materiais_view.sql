-- Cria uma view consolidando materiais com cores e características agregadas.
-- A view expõe estruturas em JSON e listas auxiliares para facilitar filtros
-- no backend e frontend. A definição ajusta dinamicamente os nomes das colunas
-- de vínculo de características e de cores para lidar com diferenças entre ambientes.
DO $$
DECLARE
  caracteristica_join_column text;
  cor_join_column text;
  create_view_sql text;
  caracteristica_columns text;
  cor_columns text;
  caracteristica_candidate text;
  cor_candidate text;
  materiais_uuid_columns text;
  grupo_material_column text;
  grupo_material_join text := '';
  grupo_material_select text := E',\n  NULL::text as "grupoMaterialNome"';
  grupo_material_item_column text;
  grupo_material_item_join text := '';
  grupo_material_item_select text := E',\n  NULL::text as "grupoMaterialItemNome"';
BEGIN
  EXECUTE 'drop view if exists public.vw_materiais_vinculos';
  EXECUTE 'drop view if exists public.materiais_view';

  SELECT string_agg(column_name, ', ')
    INTO caracteristica_columns
  FROM (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'material_grupo_caracteristica_epi'
    ORDER BY ordinal_position
  ) as caracteristica_cols;

  RAISE NOTICE 'Colunas disponíveis em material_grupo_caracteristica_epi: %',
    COALESCE(caracteristica_columns, '<nenhuma>');

  FOR caracteristica_candidate IN
    SELECT unnest(ARRAY[
      'grupo_caracteristica_epi_id',
      'caracteristica_epi_id',
      'grupo_caracteristica_epi'
    ])
  LOOP
    PERFORM 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'material_grupo_caracteristica_epi'
      AND column_name = caracteristica_candidate;

    IF FOUND THEN
      caracteristica_join_column := caracteristica_candidate;
      EXIT;
    END IF;
  END LOOP;

  IF caracteristica_join_column IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar a coluna de vínculo de características em material_grupo_caracteristica_epi.';
  END IF;

  SELECT string_agg(column_name, ', ')
    INTO cor_columns
  FROM (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'material_grupo_cor'
    ORDER BY ordinal_position
  ) as cor_cols;

  RAISE NOTICE 'Colunas disponíveis em material_grupo_cor: %',
    COALESCE(cor_columns, '<nenhuma>');

  SELECT string_agg(column_name, ', ')
    INTO materiais_uuid_columns
  FROM (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'materiais'
      AND data_type = 'uuid'
    ORDER BY ordinal_position
  ) as materiais_uuid_cols;

  RAISE NOTICE 'Colunas UUID disponíveis em public.materiais: %',
    COALESCE(materiais_uuid_columns, '<nenhuma>');

  FOR cor_candidate IN
    SELECT unnest(ARRAY[
      'grupo_material_cor',
      'grupo_cor_id',
      'grupo_cor',
      'cor_id',
      'cor'
    ])
  LOOP
    PERFORM 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'material_grupo_cor'
      AND column_name = cor_candidate;

    IF FOUND THEN
      cor_join_column := cor_candidate;
      EXIT;
    END IF;
  END LOOP;

  IF cor_join_column IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar a coluna de vínculo de cores em material_grupo_cor.';
  END IF;

  RAISE NOTICE 'Utilizando coluna de vínculo de características: %', caracteristica_join_column;
  RAISE NOTICE 'Utilizando coluna de vínculo de cores: %', cor_join_column;

  SELECT string_agg(column_name, ', ')
    INTO materiais_uuid_columns
  FROM (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'materiais'
      AND data_type = 'uuid'
    ORDER BY ordinal_position
  ) as materiais_uuid_cols;

  RAISE NOTICE 'Colunas UUID disponíveis em public.materiais: %',
    COALESCE(materiais_uuid_columns, '<nenhuma>');

  SELECT column_name
    INTO grupo_material_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materiais'
    AND data_type = 'uuid'
    AND column_name IN (
      'grupo_material_id',
      'grupo_material',
      'grupoMaterialId',
      'grupoMaterial'
    )
  ORDER BY CASE column_name
             WHEN 'grupo_material_id' THEN 0
             WHEN 'grupoMaterialId' THEN 1
             WHEN 'grupo_material' THEN 2
             WHEN 'grupoMaterial' THEN 3
             ELSE 4
           END
  LIMIT 1;

  IF grupo_material_column IS NOT NULL THEN
    grupo_material_join := format(E'\nleft join public.grupos_material as gm on gm.id = m.%I', grupo_material_column);
    grupo_material_select := E',\n  gm.nome as "grupoMaterialNome"';
    RAISE NOTICE 'Utilizando coluna de grupo de material: %', grupo_material_column;
  ELSE
    RAISE NOTICE 'Nenhuma coluna UUID de grupo de material encontrada em public.materiais.';
  END IF;

  SELECT column_name
    INTO grupo_material_item_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materiais'
    AND data_type = 'uuid'
    AND column_name IN (
      'grupo_material_item_id',
      'grupo_material_item',
      'grupoMaterialItemId',
      'grupoMaterialItem',
      'item_id',
      'itemId'
    )
  ORDER BY CASE column_name
             WHEN 'grupo_material_item_id' THEN 0
             WHEN 'grupoMaterialItemId' THEN 1
             WHEN 'grupo_material_item' THEN 2
             WHEN 'grupoMaterialItem' THEN 3
             WHEN 'item_id' THEN 4
             WHEN 'itemId' THEN 5
             ELSE 6
           END
  LIMIT 1;

  IF grupo_material_item_column IS NOT NULL THEN
    grupo_material_item_join := format(E'\nleft join public.grupos_material_itens as gmi on gmi.id = m.%I', grupo_material_item_column);
    grupo_material_item_select := E',\n  gmi.nome as "grupoMaterialItemNome"';
    RAISE NOTICE 'Utilizando coluna de item de grupo de material: %', grupo_material_item_column;
  ELSE
    RAISE NOTICE 'Nenhuma coluna UUID de item de grupo de material encontrada em public.materiais.';
  END IF;

  create_view_sql := format($sql$
create or replace view public.materiais_view as
with caracteristicas_base as (
  select distinct
    mgce.material_id,
    ce.id,
    trim(ce.caracteristica_material) as caracteristica_material
  from public.material_grupo_caracteristica_epi as mgce
  join public.caracteristica_epi as ce
    on ce.id = mgce.%1$I
  where trim(coalesce(ce.caracteristica_material, '')) <> ''
),
caracteristicas as (
  select
    material_id,
    jsonb_agg(
      jsonb_build_object('id', id, 'nome', caracteristica_material)
      order by lower(caracteristica_material)
    ) as caracteristicas_json,
    array_agg(caracteristica_material order by lower(caracteristica_material)) as caracteristicas_nomes,
    string_agg(caracteristica_material, '; ' order by lower(caracteristica_material)) as caracteristicas_texto
  from caracteristicas_base
  group by material_id
),
cores_base as (
  select distinct
    mgc.material_id,
    c.id,
    trim(c.cor) as cor_nome
  from public.material_grupo_cor as mgc
  join public.cor as c
    on c.id = mgc.%2$I
  where trim(coalesce(c.cor, '')) <> ''
),
cores as (
  select
    material_id,
    jsonb_agg(
      jsonb_build_object('id', id, 'nome', cor_nome)
      order by lower(cor_nome)
    ) as cores_json,
    array_agg(cor_nome order by lower(cor_nome)) as cores_nomes,
    string_agg(cor_nome, '; ' order by lower(cor_nome)) as cores_texto
  from cores_base
  group by material_id
)
select
  m.*%3$s%4$s,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_vinculos,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_agg,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_list,
  coalesce(caracteristicas.caracteristicas_nomes, '{}'::text[]) as caracteristicas_nomes,
  coalesce(caracteristicas.caracteristicas_nomes, '{}'::text[]) as caracteristicas_list_nomes,
  coalesce(caracteristicas.caracteristicas_texto, '') as "caracteristicasTexto",
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristicas_texto,
  coalesce(caracteristicas.caracteristicas_texto, '') as "caracteristicaEpi",
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristica_epi,
  coalesce(caracteristicas.caracteristicas_texto, '') as "caracteristicaNome",
  coalesce(cores.cores_json, '[]'::jsonb) as cores,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_vinculos,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_agg,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_list,
  coalesce(cores.cores_nomes, '{}'::text[]) as cores_nomes,
  coalesce(cores.cores_nomes, '{}'::text[]) as cores_list_nomes,
  coalesce(cores.cores_texto, '') as "coresTexto",
  coalesce(cores.cores_texto, '') as cores_texto,
  coalesce(cores.cores_texto, '') as "corMaterial",
  coalesce(cores.cores_texto, '') as cor_material,
  coalesce(cores.cores_texto, '') as "corNome"
from public.materiais as m%5$s%6$s
left join caracteristicas on caracteristicas.material_id = m.id
left join cores on cores.material_id = m.id;
$sql$, caracteristica_join_column, cor_join_column, grupo_material_select, grupo_material_item_select, grupo_material_join, grupo_material_item_join);

  EXECUTE create_view_sql;
  EXECUTE 'create or replace view public.vw_materiais_vinculos as select * from public.materiais_view';
  EXECUTE 'grant select on public.materiais_view to authenticated, anon, service_role';
  EXECUTE 'grant select on public.vw_materiais_vinculos to authenticated, anon, service_role';
END
$$;
