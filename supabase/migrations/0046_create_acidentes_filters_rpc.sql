drop function if exists public.rpc_acidentes_filtros();

create or replace function public.rpc_acidentes_filtros()
returns table (
  centros_servico text[],
  tipos text[],
  lesoes text[],
  partes text[],
  agentes text[],
  cargos text[]
)
language sql
security definer
set search_path = public as $$
  with centros as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(a.centro_servico), ''), 'Nao informado') as label
        from public.acidentes a
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  tipos as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.acidentes a
        cross join lateral regexp_split_to_table(
          coalesce(nullif(a.tipo, ''), 'Nao informado'),
          E'\\s*[;,]\\s*'
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  agentes as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.acidentes a
        cross join lateral regexp_split_to_table(
          coalesce(nullif(a.agente, ''), 'Nao informado'),
          E'\\s*[;,]\\s*'
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  cargos as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(a.cargo), ''), 'Nao informado') as label
        from public.acidentes a
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  lesoes as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.acidentes a
        cross join lateral unnest(
          case
            when coalesce(array_length(a.lesoes, 1), 0) > 0 then a.lesoes
            else array[coalesce(nullif(trim(to_jsonb(a)->>'lesao'), ''), 'Nao informado')]
          end
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  partes as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.acidentes a
        cross join lateral unnest(
          case
            when coalesce(array_length(a.partes_lesionadas, 1), 0) > 0 then a.partes_lesionadas
            else array[coalesce(nullif(trim(to_jsonb(a)->>'parteLesionada'), ''), 'Nao informado')]
          end
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  )
  select
    coalesce((select valores from centros), array[]::text[]) as centros_servico,
    coalesce((select valores from tipos), array[]::text[]) as tipos,
    coalesce((select valores from lesoes), array[]::text[]) as lesoes,
    coalesce((select valores from partes), array[]::text[]) as partes,
    coalesce((select valores from agentes), array[]::text[]) as agentes,
    coalesce((select valores from cargos), array[]::text[]) as cargos;
$$;

grant execute on function public.rpc_acidentes_filtros() to anon, authenticated, service_role;
