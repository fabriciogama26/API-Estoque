-- Atualiza a view de indicadores de acidentes para usar a tabela accidents e tabelas de grupo.

drop view if exists public.vw_indicadores_acidentes;

create view public.vw_indicadores_acidentes as
with acidentes_base as (
  select
    a.id,
    a.accident_date,
    a.lost_days,
    a.debited_days,
    p.matricula,
    p.nome as pessoa_nome,
    cg.nome as cargo,
    cs.nome as centro_servico_nome,
    lower(trim(cs.nome)) as unidade_key
  from public.accidents a
  left join public.pessoas p on p.id = a.people_id
  left join public.cargos cg on cg.id = p.cargo_id
  left join public.centros_servico cs on cs.id = a.service_center
  where a.accident_date is not null
    and coalesce(a.is_active, true) = true
    and coalesce(a.cancel_reason, '') is distinct from '__cancel_placeholder__'
),
agentes_agg as (
  select
    aga.accident_id,
    array_remove(
      array_agg(distinct coalesce(nullif(trim(aa.nome), ''), 'Nao informado')),
      ''
    ) as agentes_array
  from public.accident_group_agents aga
  left join public.acidente_agentes aa on aa.id = aga.accident_agents_id
  group by aga.accident_id
),
tipos_agg as (
  select
    aga.accident_id,
    array_remove(
      array_agg(distinct coalesce(nullif(trim(at.nome), ''), 'Nao informado')),
      ''
    ) as tipos_array
  from public.accident_group_agents aga
  left join public.acidente_tipos at on at.id = aga.accident_type_id
  group by aga.accident_id
),
lesoes_agg as (
  select
    aga.accident_id,
    array_remove(
      array_agg(distinct coalesce(nullif(trim(al.nome), ''), 'Nao informado')),
      ''
    ) as lesoes_array
  from public.accident_group_agents aga
  left join public.acidente_lesoes al on al.id = aga.accident_injuries_id
  group by aga.accident_id
),
partes_agg as (
  select
    agp.accident_id,
    array_remove(
      array_agg(
        distinct coalesce(
          nullif(trim(concat_ws(' / ', pg.nome, sg.nome, ap.nome)), ''),
          'Nao informado'
        )
      ),
      ''
    ) as partes_array
  from public.accident_group_parts agp
  join public.acidente_partes ap on ap.id = agp.accident_parts_id
  left join public.acidente_partes_grupo pg on pg.id = ap.grupo
  left join public.acidente_partes_sub_grupo sg on sg.id = ap.subgrupo
  group by agp.accident_id
),
acidentes_norm as (
  select
    ab.id,
    date_part('year', ab.accident_date)::int as ano,
    to_char(date_trunc('month', ab.accident_date), 'YYYY-MM') as periodo,
    coalesce(nullif(trim(ab.centro_servico_nome), ''), 'Nao informado') as unidade,
    coalesce(nullif(trim(ab.unidade_key), ''), 'nao informado') as unidade_key,
    coalesce(nullif(trim(ab.cargo), ''), 'Nao informado') as cargo,
    coalesce(nullif(tp.tipos_array, '{}'::text[]), array['Nao informado']) as tipos_array,
    coalesce(nullif(ag.agentes_array, '{}'::text[]), array['Nao informado']) as agentes_array,
    coalesce(nullif(pa.partes_array, '{}'::text[]), array['Nao informado']) as partes_array,
    coalesce(nullif(le.lesoes_array, '{}'::text[]), array['Nao informado']) as lesoes_array,
    coalesce(
      nullif(lower(trim(ab.matricula)), ''),
      nullif(lower(trim(ab.pessoa_nome)), ''),
      ab.id::text
    ) as pessoa_chave,
    greatest(coalesce(ab.lost_days, 0)::numeric, 0)::numeric as dias_perdidos,
    greatest(coalesce(ab.debited_days, 0)::numeric, 0)::numeric as dias_debitados
  from acidentes_base ab
  left join agentes_agg ag on ag.accident_id = ab.id
  left join tipos_agg tp on tp.accident_id = ab.id
  left join lesoes_agg le on le.accident_id = ab.id
  left join partes_agg pa on pa.accident_id = ab.id
),
hht_norm as (
  select
    to_char(date_trunc('month', hm.mes_ref), 'YYYY-MM') as periodo,
    lower(trim(cs.nome)) as unidade_key,
    sum(coalesce(hm.hht_final, 0)) as hht_total
  from public.hht_mensal hm
  join public.centros_servico cs on cs.id = hm.centro_servico_id
  left join public.status_hht sh on sh.id = hm.status_hht_id
  where coalesce(lower(trim(sh.status)), 'ativo') <> 'cancelado'
  group by periodo, unidade_key
),
acidentes_por_periodo as (
  select
    ano,
    periodo,
    unidade,
    unidade_key,
    count(*) as total_acidentes,
    sum(dias_perdidos) as dias_perdidos,
    sum(dias_debitados) as dias_debitados
  from acidentes_norm
  group by ano, periodo, unidade, unidade_key
),
resumo as (
  select
    ap.ano,
    count(*) as total_acidentes,
    count(*) filter (where ap.dias_perdidos > 0) as total_acidentes_afastamento,
    count(*) filter (where coalesce(ap.dias_perdidos, 0) = 0) as total_acidentes_sem_afastamento,
    coalesce(sum(ap.dias_perdidos), 0)::numeric as dias_perdidos,
    coalesce(sum(ap.dias_debitados), 0)::numeric as dias_debitados,
    coalesce(sum(hp.hht_total), 0)::numeric as hht_total
  from acidentes_por_periodo ap
  left join hht_norm hp on hp.periodo = ap.periodo and hp.unidade_key = ap.unidade_key
  group by ap.ano
),
pessoas_totais as (
  select count(*)::numeric as total_trabalhadores
  from public.pessoas
  where ativo is true
),
resumo_metricas as (
  select
    r.*,
    case
      when r.hht_total > 0 then round((r.total_acidentes::numeric * 1000000) / r.hht_total, 2)
      else 0
    end as taxa_frequencia_total,
    case
      when r.hht_total > 0 then round((r.total_acidentes_afastamento::numeric * 1000000) / r.hht_total, 2)
      else 0
    end as taxa_frequencia_afastamento,
    case
      when r.hht_total > 0 then round((r.total_acidentes_sem_afastamento::numeric * 1000000) / r.hht_total, 2)
      else 0
    end as taxa_frequencia_sem_afastamento,
    case
      when r.hht_total > 0 then round((r.dias_perdidos::numeric * 1000000) / r.hht_total, 2)
      else 0
    end as taxa_gravidade_total
  from resumo r
),
tendencia_detalhe as (
  select
    ap.ano,
    ap.periodo,
    sum(ap.total_acidentes) as total_acidentes,
    sum(ap.dias_perdidos) as dias_perdidos,
    sum(ap.dias_debitados) as dias_debitados,
    coalesce(sum(hp.hht_total), 0)::numeric as hht_total
  from acidentes_por_periodo ap
  left join hht_norm hp on hp.periodo = ap.periodo and hp.unidade_key = ap.unidade_key
  group by ap.ano, ap.periodo
),
tendencia as (
  select
    td.ano,
    jsonb_agg(
      jsonb_build_object(
        'periodo', td.periodo,
        'total_acidentes', td.total_acidentes,
        'dias_perdidos', td.dias_perdidos,
        'dias_debitados', td.dias_debitados,
        'hht_total', td.hht_total,
        'taxa_frequencia',
          case
            when td.hht_total > 0 then round((td.total_acidentes::numeric * 1000000) / td.hht_total, 2)
            else 0
          end,
        'taxa_gravidade',
          case
            when td.hht_total > 0 then round(((td.dias_perdidos + td.dias_debitados)::numeric * 1000000) / td.hht_total, 2)
            else 0
          end
      )
      order by td.periodo asc
    ) as tendencia
  from tendencia_detalhe td
  group by td.ano
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
  rm.ano,
  'todas'::text as unidade,
  jsonb_build_object(
    'ano', rm.ano,
    'periodo', rm.ano::text,
    'periodo_label', concat('Ano ', rm.ano),
    'total_acidentes', rm.total_acidentes,
    'total_acidentes_afastamento', rm.total_acidentes_afastamento,
    'total_acidentes_sem_afastamento', rm.total_acidentes_sem_afastamento,
    'dias_perdidos', rm.dias_perdidos,
    'dias_debitados', rm.dias_debitados,
    'hht_total', rm.hht_total,
    'taxa_frequencia', rm.taxa_frequencia_total,
    'taxa_frequencia_afastamento', rm.taxa_frequencia_afastamento,
    'taxa_frequencia_sem_afastamento', rm.taxa_frequencia_sem_afastamento,
    'taxa_gravidade', rm.taxa_gravidade_total,
    'indice_acidentados',
      round(((rm.taxa_frequencia_total + rm.taxa_gravidade_total) / 100)::numeric, 2),
    'indice_avaliacao_gravidade',
      case
        when rm.total_acidentes_afastamento > 0 then round(((rm.dias_perdidos + rm.dias_debitados) / rm.total_acidentes_afastamento), 2)
        else 0
      end,
    'total_trabalhadores', coalesce(pt.total_trabalhadores, 0),
    'indice_relativo_acidentes',
      case
        when coalesce(pt.total_trabalhadores, 0) > 0 then round((rm.total_acidentes_afastamento::numeric * 1000) / pt.total_trabalhadores, 2)
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
from resumo_metricas rm
cross join pessoas_totais pt
left join tendencia t on t.ano = rm.ano
left join tipos tp on tp.ano = rm.ano
left join partes pa on pa.ano = rm.ano
left join lesoes ls on ls.ano = rm.ano
left join cargos cg on cg.ano = rm.ano
left join agentes ag on ag.ano = rm.ano
left join pessoas_centro pc on pc.ano = rm.ano
order by rm.ano desc;

grant select on public.vw_indicadores_acidentes to anon, authenticated, service_role;
