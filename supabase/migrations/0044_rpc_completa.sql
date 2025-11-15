drop function if exists public.rpc_pessoas_completa();

create or replace function public.rpc_pessoas_completa()
returns table (
  id uuid,
  nome text,
  matricula text,
  centro_servico_id uuid,
  setor_id uuid,
  cargo_id uuid,
  centro_custo_id uuid,
  tipo_execucao_id uuid,
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
    pv.centro_servico_id,
    pv.setor_id,
    pv.cargo_id,
    pv.centro_custo_id,
    pv.tipo_execucao_id,
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
