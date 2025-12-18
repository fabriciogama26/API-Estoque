-- Retorna a quantidade de pessoas ativas por centro de servico (mesma regra do resumo da tela Pessoas).

drop function if exists public.rpc_pessoas_count_centro(uuid);

create or replace function public.rpc_pessoas_count_centro(p_centro_servico_id uuid)
returns table (total integer)
language sql
security definer
set search_path = public as $$
  select count(*)::integer as total
  from public.pessoas_view pv
  where coalesce(pv.ativo, true) = true
    and pv.centro_servico_id = p_centro_servico_id;
$$;

grant execute on function public.rpc_pessoas_count_centro(uuid) to authenticated, anon, service_role;

