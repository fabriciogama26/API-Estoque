-- Cria a view consumida pelo dashboard de acidentes no frontend.

drop view if exists public.vw_indicadores_acidentes;

create view public.vw_indicadores_acidentes as
with acidentes_norm as (
  select
    a.id,
    date_part('year', a.data)::int as ano,
    to_char(date_trunc('month', a.data), 'YYYY-MM') as periodo,
    coalesce(nullif(trim(a.centro_servico), ''), 'Nao informado') as unidade,
    coalesce(nullif(trim(a.cargo), ''), 'Nao informado') as cargo,
    coalesce(
      nullif(
        array_remove(
          array(
            select trim(valor)
            from unnest(regexp_split_to_array(coalesce(nullif(a.tipo, ''), 'Nao informado'), E'\\s*[;,]\\s*')) as valor
          ),
          ''
        ),
        '{}'::text[]
      ),
      array['Nao informado']
    ) as tipos_array,
    coalesce(
      nullif(
        array_remove(
          array(
            select trim(valor)
            from unnest(regexp_split_to_array(coalesce(nullif(a.agente, ''), 'Nao informado'), E'\\s*[;,]\\s*')) as valor
          ),
          ''
        ),
        '{}'::text[]
      ),
      array['Nao informado']
    ) as agentes_array,
    coalesce(
      nullif(
        case
          when coalesce(array_length(a.partes_lesionadas, 1), 0) > 0 then
            array_remove(
              array(
                select trim(valor)
                from unnest(a.partes_lesionadas) as valor
              ),
              ''
            )
          when pl.parte_legacy is not null then
            array[pl.parte_legacy]
          else
            array['Nao informado']
        end,
        '{}'::text[]
      ),
      array['Nao informado']
    ) as partes_array,
    coalesce(
      nullif(
        case
          when coalesce(array_length(a.lesoes, 1), 0) > 0 then
            array_remove(
              array(
                select trim(valor)
                from unnest(a.lesoes) as valor
              ),
              ''
            )
          when pl.lesao_legacy is not null then
            array[pl.lesao_legacy]
          else
            array['Nao informado']
        end,
        '{}'::text[]
      ),
      array['Nao informado']
    ) as lesoes_array,
    coalesce(
      nullif(lower(trim(a.matricula)), ''),
      nullif(lower(trim(a.nome)), ''),
      a.id::text
    ) as pessoa_chave,
    greatest(coalesce(a."diasPerdidos", 0)::numeric, 0)::numeric as dias_perdidos,
    greatest(coalesce(a.hht, 0)::numeric, 0)::numeric as hht_total
  from public.acidentes a
  cross join lateral (
    select nullif(
      trim(
        coalesce(
          to_jsonb(a)->>'parteLesionada',
          to_jsonb(a)->>'parte_lesionada'
        )
      ),
      ''
    ) as parte_legacy,
    nullif(trim(coalesce(to_jsonb(a)->>'lesao', '')), '') as lesao_legacy
  ) pl
  where a.data is not null
),
resumo as (
  select
    ano,
    count(*) as total_acidentes,
    count(*) filter (where dias_perdidos > 0) as total_acidentes_afastamento,
    count(*) filter (where coalesce(dias_perdidos, 0) = 0) as total_acidentes_sem_afastamento,
    coalesce(sum(dias_perdidos), 0)::numeric as dias_perdidos,
    coalesce(sum(hht_total), 0)::numeric as hht_total
  from acidentes_norm
  group by ano
),
periodos as (
  select
    anos.ano,
    to_char(make_date(anos.ano, meses.mes, 1), 'YYYY-MM') as periodo,
    meses.mes
  from (select distinct ano from acidentes_norm) as anos
  cross join generate_series(1, 12) as meses(mes)
),
tendencia as (
  select
    p.ano,
    jsonb_agg(
      jsonb_build_object(
        'periodo', p.periodo,
        'total_acidentes', coalesce(m.total_acidentes, 0),
        'taxa_frequencia',
          case
            when coalesce(m.hht_total, 0) > 0 then round((coalesce(m.total_acidentes, 0)::numeric * 1000000) / m.hht_total, 2)
            else 0
          end,
        'taxa_gravidade',
          case
            when coalesce(m.hht_total, 0) > 0 then round((coalesce(m.dias_perdidos, 0) * 1000000) / m.hht_total, 2)
            else 0
          end
      )
      order by p.mes
    ) as tendencia
  from periodos p
  left join (
    select
      ano,
      periodo,
      count(*) as total_acidentes,
      coalesce(sum(dias_perdidos), 0)::numeric as dias_perdidos,
      coalesce(sum(hht_total), 0)::numeric as hht_total
    from acidentes_norm
    group by ano, periodo
  ) m on m.ano = p.ano and m.periodo = p.periodo
  group by p.ano
),
tipos as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('tipo', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as tipos
  from (
    select
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.tipos_array) as valor
    group by an.ano, label
  ) item
  group by item.ano
),
agentes as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('agente', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as agentes
  from (
    select
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.agentes_array) as valor
    group by an.ano, label
  ) item
  group by item.ano
),
partes as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('parte_lesionada', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as partes_lesionadas
  from (
    select
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.partes_array) as valor
    group by an.ano, label
  ) item
  group by item.ano
),
lesoes as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('lesao', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as lesoes
  from (
    select
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.lesoes_array) as valor
    group by an.ano, label
  ) item
  group by item.ano
),
cargos as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('cargo', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as cargos
  from (
    select
      ano,
      coalesce(nullif(trim(cargo), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm
    group by ano, label
  ) item
  group by item.ano
),
pessoas_centro as (
  select
    item.ano,
    jsonb_agg(
      jsonb_build_object('centro_servico', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as pessoas_por_centro
  from (
    select
      ano,
      coalesce(nullif(trim(unidade), ''), 'Nao informado') as label,
      count(distinct pessoa_chave) as total
    from acidentes_norm
    where pessoa_chave is not null
    group by ano, label
  ) item
  group by item.ano
)
select
  r.ano,
  'todas'::text as unidade,
  jsonb_build_object(
    'ano', r.ano,
    'periodo', r.ano::text,
    'periodo_label', concat('Ano ', r.ano),
    'total_acidentes', r.total_acidentes,
    'total_acidentes_afastamento', r.total_acidentes_afastamento,
    'total_acidentes_sem_afastamento', r.total_acidentes_sem_afastamento,
    'dias_perdidos', r.dias_perdidos,
    'hht_total', r.hht_total,
    'taxa_frequencia',
      case
        when r.hht_total > 0 then round((r.total_acidentes::numeric * 1000000) / r.hht_total, 2)
        else 0
      end,
    'taxa_frequencia_afastamento',
      case
        when r.hht_total > 0 then round((r.total_acidentes_afastamento::numeric * 1000000) / r.hht_total, 2)
        else 0
      end,
    'taxa_frequencia_sem_afastamento',
      case
        when r.hht_total > 0 then round((r.total_acidentes_sem_afastamento::numeric * 1000000) / r.hht_total, 2)
        else 0
      end,
    'taxa_gravidade',
      case
        when r.hht_total > 0 then round((r.dias_perdidos * 1000000) / r.hht_total, 2)
        else 0
      end
  ) as resumo,
  coalesce(t.tendencia, '[]'::jsonb) as tendencia,
  coalesce(tp.tipos, '[]'::jsonb) as tipos,
  coalesce(pa.partes_lesionadas, '[]'::jsonb) as partes_lesionadas,
  coalesce(ls.lesoes, '[]'::jsonb) as lesoes,
  coalesce(cg.cargos, '[]'::jsonb) as cargos,
  coalesce(ag.agentes, '[]'::jsonb) as agentes,
  coalesce(pc.pessoas_por_centro, '[]'::jsonb) as pessoas_por_centro
from resumo r
left join tendencia t on t.ano = r.ano
left join tipos tp on tp.ano = r.ano
left join partes pa on pa.ano = r.ano
left join lesoes ls on ls.ano = r.ano
left join cargos cg on cg.ano = r.ano
left join agentes ag on ag.ano = r.ano
left join pessoas_centro pc on pc.ano = r.ano
order by r.ano desc;

grant select on public.vw_indicadores_acidentes to anon, authenticated, service_role;
