-- Garante colunas esperadas nas tabelas de grupo de acidentes (para triggers).
alter table if exists public.accident_group_agents add column if not exists accident_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_agents_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_injuries_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_type_id uuid;
alter table if exists public.accident_group_agents add column if not exists created_at timestamptz default now();
alter table if exists public.accident_group_agents add column if not exists account_owner_id uuid;

alter table if exists public.accident_group_parts add column if not exists accident_parts_id uuid;
alter table if exists public.accident_group_parts add column if not exists accident_parts_group_id uuid;
alter table if exists public.accident_group_parts add column if not exists accident_parts_subgroup_id uuid;
alter table if exists public.accident_group_parts add column if not exists created_at timestamptz default now();
alter table if exists public.accident_group_parts add column if not exists accident_id uuid;
alter table if exists public.accident_group_parts add column if not exists account_owner_id uuid;

-- Ajusta a pessoas_view para expor usuario_cadastro_nome/usuario_edicao_nome (snake_case).
create or replace view public.pessoas_view as
select
  p.id,
  p.nome,
  p.matricula,
  p.centro_servico_id,
  cs.nome as centro_servico,
  cs.nome as "centroServico",
  p.centro_custo_id,
  cc.nome as centro_custo,
  cc.nome as "centroCusto",
  coalesce(cs.nome, cc.nome) as local,
  p.setor_id,
  st.nome as setor,
  p.cargo_id,
  cg.nome as cargo,
  p.tipo_execucao_id,
  te.nome as tipo_execucao,
  te.nome as "tipoExecucao",
  p."dataAdmissao" as "dataAdmissao",
  p."dataDemissao" as "dataDemissao",
  p.ativo,
  p."usuarioCadastro",
  coalesce(uc.username, uc.display_name, uc.email, p."usuarioCadastro"::text) as "usuarioCadastroNome",
  uc.username as "usuarioCadastroUsername",
  p."usuarioEdicao",
  coalesce(ue.username, ue.display_name, ue.email, p."usuarioEdicao"::text) as "usuarioEdicaoNome",
  ue.username as "usuarioEdicaoUsername",
  p."criadoEm",
  p."atualizadoEm",
  coalesce(uc.username, uc.display_name, uc.email, p."usuarioCadastro"::text) as usuario_cadastro_nome,
  coalesce(ue.username, ue.display_name, ue.email, p."usuarioEdicao"::text) as usuario_edicao_nome
from public.pessoas p
left join public.centros_servico cs on cs.id = p.centro_servico_id
left join public.centros_custo cc on cc.id = p.centro_custo_id
left join public.setores st on st.id = p.setor_id
left join public.cargos cg on cg.id = p.cargo_id
left join public.tipo_execucao te on te.id = p.tipo_execucao_id
left join public.app_users uc on uc.id = p."usuarioCadastro"
left join public.app_users ue on ue.id = p."usuarioEdicao";

grant select on public.pessoas_view to authenticated, anon, service_role;
select pg_notify('pgrst', 'reload schema');
