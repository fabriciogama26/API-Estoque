-- Cria uma view consolidando materiais com cores e características agregadas.
-- A view expõe estruturas em JSON e listas auxiliares para facilitar filtros
-- no backend e frontend. A definição ajusta dinamicamente o nome da coluna
-- de vínculo de características para lidar com diferenças entre ambientes.
DO $$
DECLARE
  caracteristica_join_column text;
  create_view_sql text;
BEGIN
  SELECT column_name
    INTO caracteristica_join_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'material_grupo_caracteristica_epi'
    AND column_name IN ('grupo_caracteristica_epi_id', 'caracteristica_epi_id')
  ORDER BY CASE column_name
             WHEN 'grupo_caracteristica_epi_id' THEN 0
             ELSE 1
           END
  LIMIT 1;

  IF caracteristica_join_column IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar a coluna de vínculo em material_grupo_caracteristica_epi.';
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
    on c.id = mgc.grupo_cor_id
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
  m.*,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_vinculos,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_agg,
  coalesce(caracteristicas.caracteristicas_json, '[]'::jsonb) as caracteristicas_list,
  coalesce(caracteristicas.caracteristicas_nomes, '{}'::text[]) as caracteristicas_nomes,
  coalesce(caracteristicas.caracteristicas_nomes, '{}'::text[]) as caracteristicas_list_nomes,
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristicasTexto,
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristicas_texto,
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristicaEpi,
  coalesce(caracteristicas.caracteristicas_texto, '') as caracteristica_epi,
  coalesce(cores.cores_json, '[]'::jsonb) as cores,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_vinculos,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_agg,
  coalesce(cores.cores_json, '[]'::jsonb) as cores_list,
  coalesce(cores.cores_nomes, '{}'::text[]) as cores_nomes,
  coalesce(cores.cores_nomes, '{}'::text[]) as cores_list_nomes,
  coalesce(cores.cores_texto, '') as coresTexto,
  coalesce(cores.cores_texto, '') as cores_texto,
  coalesce(cores.cores_texto, '') as corMaterial,
  coalesce(cores.cores_texto, '') as cor_material
from public.materiais as m
left join caracteristicas on caracteristicas.material_id = m.id
left join cores on cores.material_id = m.id;
$sql$, caracteristica_join_column);

  EXECUTE create_view_sql;
  EXECUTE 'create or replace view public.vw_materiais_vinculos as select * from public.materiais_view';
  EXECUTE 'grant select on public.materiais_view to authenticated, anon, service_role';
  EXECUTE 'grant select on public.vw_materiais_vinculos to authenticated, anon, service_role';
END
$$;
