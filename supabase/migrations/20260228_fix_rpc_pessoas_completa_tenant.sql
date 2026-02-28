-- Corrige rpc_pessoas_completa para aplicar escopo de tenant.
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
  join public.pessoas p on p.id = pv.id
  left join public.acidente_locais al on al.id = pv.centro_servico_id
  where public.is_master() or p.account_owner_id = public.current_account_owner_id();
$$;

grant execute on function public.rpc_pessoas_completa() to authenticated, anon, service_role;
