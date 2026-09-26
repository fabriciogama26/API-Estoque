-- Corrige o isolamento de tenant das RPCs de auditoria e compra do forecast.
--
-- Antes: `rpc_previsao_gasto_mensal_auditar` e `rpc_previsao_compra_sugerida` rodavam como
-- SECURITY DEFINER (ignorando RLS) e confiavam no `p_owner_id` enviado pelo chamador,
-- permitindo que qualquer usuario autenticado lesse dados de outro tenant.
--
-- Depois: o corpo original passa para funcoes internas sem acesso direto, e as funcoes
-- publicas (mesma assinatura) validam o owner da sessao antes de delegar:
--   - owner da sessao ausente -> 42501
--   - p_owner_id diferente do owner da sessao -> 42501 (exceto master e service_role)

do $$
begin
  if to_regprocedure('public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid)') is null then
    alter function public.rpc_previsao_gasto_mensal_auditar(uuid, uuid)
      rename to _rpc_previsao_gasto_mensal_auditar_impl;
  end if;

  if to_regprocedure('public._rpc_previsao_compra_sugerida_impl(uuid, uuid)') is null then
    alter function public.rpc_previsao_compra_sugerida(uuid, uuid)
      rename to _rpc_previsao_compra_sugerida_impl;
  end if;
end;
$$;

revoke all on function public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid) from public, anon, authenticated;
revoke all on function public._rpc_previsao_compra_sugerida_impl(uuid, uuid) from public, anon, authenticated;
grant execute on function public._rpc_previsao_gasto_mensal_auditar_impl(uuid, uuid) to service_role;
grant execute on function public._rpc_previsao_compra_sugerida_impl(uuid, uuid) to service_role;

create or replace function public.forecast_assert_owner_access(p_owner_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  if p_owner_id is null then
    raise exception 'p_owner_id obrigatorio.' using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') = 'service_role' or public.is_master() then
    return;
  end if;

  v_owner := public.my_owner_id();

  if v_owner is null then
    raise exception 'Owner da sessao nao resolvido.' using errcode = '42501';
  end if;

  if p_owner_id <> v_owner then
    raise exception 'Acesso negado ao owner informado.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.forecast_assert_owner_access(uuid) from public, anon;
grant execute on function public.forecast_assert_owner_access(uuid) to authenticated, service_role;

create or replace function public.rpc_previsao_gasto_mensal_auditar(
  p_owner_id uuid,
  p_forecast_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.forecast_assert_owner_access(p_owner_id);
  return public._rpc_previsao_gasto_mensal_auditar_impl(p_owner_id, p_forecast_id);
end;
$$;

create or replace function public.rpc_previsao_compra_sugerida(
  p_owner_id uuid,
  p_forecast_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.forecast_assert_owner_access(p_owner_id);
  return public._rpc_previsao_compra_sugerida_impl(p_owner_id, p_forecast_id);
end;
$$;

revoke all on function public.rpc_previsao_gasto_mensal_auditar(uuid, uuid) from public, anon;
revoke all on function public.rpc_previsao_compra_sugerida(uuid, uuid) from public, anon;
grant execute on function public.rpc_previsao_gasto_mensal_auditar(uuid, uuid) to authenticated, service_role;
grant execute on function public.rpc_previsao_compra_sugerida(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
