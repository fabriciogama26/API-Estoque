-- Adiciona coluna de data de demissão em pessoas e refaz objetos dependentes.

alter table if exists public.pessoas
  add column if not exists "dataDemissao" date;

-- Recria a view principal expondo a nova coluna.
do $$
begin
  execute 'drop view if exists public.pessoas_view cascade';

  execute $sql$
    create view public.pessoas_view as
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
      p."atualizadoEm"
    from public.pessoas p
    left join public.centros_servico cs on cs.id = p.centro_servico_id
    left join public.centros_custo cc on cc.id = p.centro_custo_id
    left join public.setores st on st.id = p.setor_id
    left join public.cargos cg on cg.id = p.cargo_id
    left join public.tipo_execucao te on te.id = p.tipo_execucao_id
    left join public.app_users uc on uc.id = p."usuarioCadastro"
    left join public.app_users ue on ue.id = p."usuarioEdicao";
  $sql$;

  execute 'grant select on public.pessoas_view to authenticated, anon, service_role';
  perform pg_notify('pgrst', 'reload schema');
end
$$;

-- Atualiza rpc_pessoas_completa para expor data_demissao.
drop function if exists public.rpc_pessoas_completa();

create or replace function public.rpc_pessoas_completa()
returns table (
  id uuid,
  nome text,
  matricula text,
  data_admissao timestamptz,
  data_demissao date,
  usuario_cadastro uuid,
  usuario_cadastro_nome text,
  usuario_edicao uuid,
  usuario_edicao_nome text,
  criado_em timestamptz,
  atualizado_em timestamptz,
  centro_servico_id uuid,
  setor_id uuid,
  cargo_id uuid,
  centro_custo_id uuid,
  tipo_execucao_id uuid,
  ativo boolean,
  centro_servico text,
  setor text,
  cargo text,
  centro_custo text,
  tipo_execucao text,
  local text
)
language sql
security definer
set search_path = public as $$
  select
    pv.id,
    pv.nome,
    pv.matricula,
    pv."dataAdmissao" as data_admissao,
    pv."dataDemissao" as data_demissao,
    pv."usuarioCadastro" as usuario_cadastro,
    pv."usuarioCadastroNome" as usuario_cadastro_nome,
    pv."usuarioEdicao" as usuario_edicao,
    pv."usuarioEdicaoNome" as usuario_edicao_nome,
    pv."criadoEm" as criado_em,
    pv."atualizadoEm" as atualizado_em,
    pv.centro_servico_id,
    pv.setor_id,
    pv.cargo_id,
    pv.centro_custo_id,
    pv.tipo_execucao_id,
    pv.ativo,
    pv.centro_servico,
    pv.setor,
    pv.cargo,
    pv.centro_custo,
    pv.tipo_execucao,
    coalesce(al.nome, pv.centro_servico) as local
  from public.pessoas_view pv
  left join public.acidente_locais al on al.id = pv.centro_servico_id;
$$;

grant execute on function public.rpc_pessoas_completa() to authenticated, anon, service_role;
