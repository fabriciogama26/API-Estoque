-- Corrige o Dashboard de Acidentes para somar HHT mensal ativo do periodo,
-- mesmo quando nao ha acidente no mesmo centro/mes.

drop view if exists public.vw_indicadores_acidentes;

create view public.vw_indicadores_acidentes
with (security_invoker = on) as
with acidentes_base as (
  select
    a.account_owner_id,
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
    ab.account_owner_id,
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
    hm.account_owner_id,
    date_part('year', hm.mes_ref)::int as ano,
    to_char(date_trunc('month', hm.mes_ref), 'YYYY-MM') as periodo,
    hm.centro_servico_id,
    lower(trim(cs.nome)) as unidade_key,
    sum(coalesce(hm.hht_final, 0)) as hht_total
  from public.hht_mensal hm
  join public.centros_servico cs on cs.id = hm.centro_servico_id
  left join public.status_hht sh on sh.id = hm.status_hht_id
  where coalesce(lower(trim(sh.status)), 'ativo') <> 'cancelado'
  group by hm.account_owner_id, ano, periodo, hm.centro_servico_id, unidade_key
),
hht_periodo as (
  select
    account_owner_id,
    ano,
    periodo,
    sum(hht_total)::numeric as hht_total
  from hht_norm
  group by account_owner_id, ano, periodo
),
hht_ano as (
  select
    account_owner_id,
    ano,
    sum(hht_total)::numeric as hht_total
  from hht_periodo
  group by account_owner_id, ano
),
anos as (
  select distinct account_owner_id, ano from acidentes_norm
  union
  select distinct account_owner_id, ano from hht_periodo
),
acidentes_ano as (
  select
    account_owner_id,
    ano,
    count(*) as total_acidentes,
    count(*) filter (where dias_perdidos > 0) as total_acidentes_afastamento,
    count(*) filter (where coalesce(dias_perdidos, 0) = 0) as total_acidentes_sem_afastamento,
    coalesce(sum(dias_perdidos), 0)::numeric as dias_perdidos,
    coalesce(sum(dias_debitados), 0)::numeric as dias_debitados
  from acidentes_norm
  group by account_owner_id, ano
),
resumo as (
  select
    y.account_owner_id,
    y.ano,
    coalesce(aa.total_acidentes, 0) as total_acidentes,
    coalesce(aa.total_acidentes_afastamento, 0) as total_acidentes_afastamento,
    coalesce(aa.total_acidentes_sem_afastamento, 0) as total_acidentes_sem_afastamento,
    coalesce(aa.dias_perdidos, 0)::numeric as dias_perdidos,
    coalesce(aa.dias_debitados, 0)::numeric as dias_debitados,
    coalesce(ha.hht_total, 0)::numeric as hht_total
  from anos y
  left join acidentes_ano aa on aa.account_owner_id = y.account_owner_id and aa.ano = y.ano
  left join hht_ano ha on ha.account_owner_id = y.account_owner_id and ha.ano = y.ano
),
pessoas_totais as (
  select
    account_owner_id,
    count(*)::numeric as total_trabalhadores
  from public.pessoas
  where ativo is true
  group by account_owner_id
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
      when r.hht_total > 0 then round(((r.dias_perdidos + r.dias_debitados)::numeric * 1000000) / r.hht_total, 2)
      else 0
    end as taxa_gravidade_total
  from resumo r
),
acidentes_por_periodo as (
  select
    account_owner_id,
    ano,
    periodo,
    count(*) as total_acidentes,
    sum(dias_perdidos) as dias_perdidos,
    sum(dias_debitados) as dias_debitados
  from acidentes_norm
  group by account_owner_id, ano, periodo
),
periodos as (
  select distinct account_owner_id, ano, periodo from acidentes_por_periodo
  union
  select distinct account_owner_id, ano, periodo from hht_periodo
),
tendencia_detalhe as (
  select
    p.account_owner_id,
    p.ano,
    p.periodo,
    coalesce(ap.total_acidentes, 0) as total_acidentes,
    coalesce(ap.dias_perdidos, 0)::numeric as dias_perdidos,
    coalesce(ap.dias_debitados, 0)::numeric as dias_debitados,
    coalesce(hp.hht_total, 0)::numeric as hht_total
  from periodos p
  left join acidentes_por_periodo ap
    on ap.account_owner_id = p.account_owner_id and ap.ano = p.ano and ap.periodo = p.periodo
  left join hht_periodo hp
    on hp.account_owner_id = p.account_owner_id and hp.ano = p.ano and hp.periodo = p.periodo
),
tendencia as (
  select
    td.account_owner_id,
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
  group by td.account_owner_id, td.ano
),
tipos as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('tipo', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as tipos
  from (
    select
      an.account_owner_id,
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.tipos_array) as valor
    group by an.account_owner_id, an.ano, label
  ) item
  group by item.account_owner_id, item.ano
),
agentes as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('agente', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as agentes
  from (
    select
      an.account_owner_id,
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.agentes_array) as valor
    group by an.account_owner_id, an.ano, label
  ) item
  group by item.account_owner_id, item.ano
),
partes as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('parte_lesionada', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as partes_lesionadas
  from (
    select
      an.account_owner_id,
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.partes_array) as valor
    group by an.account_owner_id, an.ano, label
  ) item
  group by item.account_owner_id, item.ano
),
lesoes as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('lesao', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as lesoes
  from (
    select
      an.account_owner_id,
      an.ano,
      coalesce(nullif(trim(valor), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm an
    cross join lateral unnest(an.lesoes_array) as valor
    group by an.account_owner_id, an.ano, label
  ) item
  group by item.account_owner_id, item.ano
),
cargos as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('cargo', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as cargos
  from (
    select
      account_owner_id,
      ano,
      coalesce(nullif(trim(cargo), ''), 'Nao informado') as label,
      count(*) as total
    from acidentes_norm
    group by account_owner_id, ano, label
  ) item
  group by item.account_owner_id, item.ano
),
pessoas_centro as (
  select
    item.account_owner_id,
    item.ano,
    jsonb_agg(
      jsonb_build_object('centro_servico', item.label, 'total', item.total)
      order by item.total desc, item.label asc
    ) as pessoas_por_centro
  from (
    select
      account_owner_id,
      ano,
      coalesce(nullif(trim(unidade), ''), 'Nao informado') as label,
      count(distinct pessoa_chave) as total
    from acidentes_norm
    where pessoa_chave is not null
    group by account_owner_id, ano, label
  ) item
  group by item.account_owner_id, item.ano
)
select
  rm.account_owner_id,
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
        when rm.total_acidentes_afastamento > 0
          then round(((rm.dias_perdidos + rm.dias_debitados) / rm.total_acidentes_afastamento), 2)
        else 0
      end,
    'total_trabalhadores', coalesce(pt.total_trabalhadores, 0),
    'indice_relativo_acidentes',
      case
        when coalesce(pt.total_trabalhadores, 0) > 0
          then round((rm.total_acidentes_afastamento::numeric * 1000) / pt.total_trabalhadores, 2)
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
left join pessoas_totais pt on pt.account_owner_id = rm.account_owner_id
left join tendencia t on t.account_owner_id = rm.account_owner_id and t.ano = rm.ano
left join tipos tp on tp.account_owner_id = rm.account_owner_id and tp.ano = rm.ano
left join partes pa on pa.account_owner_id = rm.account_owner_id and pa.ano = rm.ano
left join lesoes ls on ls.account_owner_id = rm.account_owner_id and ls.ano = rm.ano
left join cargos cg on cg.account_owner_id = rm.account_owner_id and cg.ano = rm.ano
left join agentes ag on ag.account_owner_id = rm.account_owner_id and ag.ano = rm.ano
left join pessoas_centro pc on pc.account_owner_id = rm.account_owner_id and pc.ano = rm.ano
order by rm.ano desc;

grant select on public.vw_indicadores_acidentes to authenticated, service_role;
