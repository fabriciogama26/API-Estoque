-- Atualiza vw_acidentes para suportar classificacoes com multiplos agentes.
drop view if exists public.vw_acidentes;

create view public.vw_acidentes as
with agentes_agg as (
  select
    aga.accident_id,
    array_agg(aga.accident_agents_id order by aga.created_at, aga.id) as agentes_ids,
    array_agg(aa.nome order by aga.created_at, aga.id) as agentes_nomes,
    array_agg(aga.accident_type_id order by aga.created_at, aga.id) as tipos_ids,
    array_agg(at.nome order by aga.created_at, aga.id) as tipos_nomes,
    array_agg(aga.accident_injuries_id order by aga.created_at, aga.id) as lesoes_ids,
    array_agg(al.nome order by aga.created_at, aga.id) as lesoes_nomes,
    (array_agg(aga.accident_agents_id order by aga.created_at, aga.id))[1] as agente_id,
    (array_agg(aa.nome order by aga.created_at, aga.id))[1] as agente_nome
  from public.accident_group_agents aga
  left join public.acidente_agentes aa on aa.id = aga.accident_agents_id
  left join public.acidente_tipos at on at.id = aga.accident_type_id
  left join public.acidente_lesoes al on al.id = aga.accident_injuries_id
  group by aga.accident_id
),
partes_agg as (
  select
    agp.accident_id,
    array_agg(ap.id order by agp.created_at, agp.id) as partes_ids,
    array_agg(
      concat_ws(' / ', pg.nome, sg.nome, ap.nome)
      order by agp.created_at, agp.id
    ) as partes_nomes
  from public.accident_group_parts agp
  join public.acidente_partes ap on ap.id = agp.accident_parts_id
  left join public.acidente_partes_grupo pg on pg.id = ap.grupo
  left join public.acidente_partes_sub_grupo sg on sg.id = ap.subgrupo
  group by agp.accident_id
)
select
  a.id,
  a.people_id,
  p.matricula,
  p.nome,
  cg.nome as cargo,
  a.accident_date as data,
  a.lost_days as dias_perdidos,
  a.debited_days as dias_debitados,
  a.cid_code as cid,
  a.cat_number as cat,
  a.notes as observacao,
  a.created_at as criado_em,
  a.updated_at as atualizado_em,
  a.created_by_username as registrado_por,
  coalesce(uc.username, uc.display_name, uc.email, a.created_by_username::text) as registrado_por_nome,
  a.updated_by_username as atualizado_por,
  coalesce(uu.username, uu.display_name, uu.email, a.updated_by_username::text) as atualizado_por_nome,
  a.esocial_date as data_esocial,
  a.esocial_involved as esocial,
  a.sesmt_involved as sesmt,
  a.sesmt_date as data_sesmt,
  a.is_active as ativo,
  a.cancel_reason as cancel_motivo,
  a.service_center as centro_servico_id,
  cs.nome as centro_servico,
  a.location_name as local_id,
  al.nome as local,
  ag.agente_id,
  ag.agente_nome,
  ag.agentes_ids,
  ag.agentes_nomes,
  ag.tipos_ids,
  ag.tipos_nomes,
  ag.lesoes_ids,
  ag.lesoes_nomes,
  pa.partes_ids,
  pa.partes_nomes,
  a.account_owner_id
from public.accidents a
left join public.pessoas p on p.id = a.people_id
left join public.cargos cg on cg.id = p.cargo_id
left join public.centros_servico cs on cs.id = a.service_center
left join public.acidente_locais al on al.id = a.location_name
left join public.app_users uc on uc.id = a.created_by_username
left join public.app_users uu on uu.id = a.updated_by_username
left join agentes_agg ag on ag.accident_id = a.id
left join partes_agg pa on pa.accident_id = a.id;

grant select on public.vw_acidentes to anon, authenticated, service_role;
