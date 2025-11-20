-- Cria função de resumo de pessoas por centro de serviço e setor, considerando apenas ativos.

drop function if exists public.rpc_pessoas_resumo();

create or replace function public.rpc_pessoas_resumo()
returns table (
  total_geral integer,
  por_centro jsonb,
  por_setor jsonb
)
language sql
security definer
set search_path = public as $$
  with base as (
    select
      coalesce(nullif(trim(pv.centro_servico), ''), 'Nao informado') as centro_servico,
      coalesce(nullif(trim(pv.setor), ''), 'Nao informado') as setor
    from public.pessoas_view pv
    where coalesce(pv.ativo, true) = true
  ),
  resumo_centro as (
    select
      centro_servico,
      count(*) as total
    from base
    group by centro_servico
    order by total desc, centro_servico asc
  ),
  resumo_setor as (
    select
      setor,
      count(*) as total
    from base
    group by setor
    order by total desc, setor asc
  )
  select
    (select count(*) from base) as total_geral,
    (select jsonb_agg(jsonb_build_object('centro_servico', centro_servico, 'total', total)) from resumo_centro) as por_centro,
    (select jsonb_agg(jsonb_build_object('setor', setor, 'total', total)) from resumo_setor) as por_setor;
$$;

grant execute on function public.rpc_pessoas_resumo() to authenticated, anon, service_role;
