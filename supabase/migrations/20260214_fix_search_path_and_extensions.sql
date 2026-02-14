-- Fix function search_path warnings (immutable/trigger/RPC helpers).
-- Use to_regprocedure() to avoid failures when a signature does not exist.

do $$
declare
  v_sig text;
  v_sigs text[] := array[
    'public.pessoas_force_inativo_on_demissao()',
    'public.pessoas_preflight_check(uuid, text, text, uuid)',
    'public.evitar_duplicidade_pessoa()',
    'public.basic_registration_audit_fabricantes()',
    'public.basic_registration_audit_centros_estoque()',
    'public.basic_registration_audit_cargos()',
    'public.basic_registration_audit_centros_custo()',
    'public.basic_registration_audit_centros_servico()',
    'public.basic_registration_audit_setores()',
    'public.set_current_timestamp_updated_at()',
    'public.hht_mensal_log_update_delete()',
    'public.hht_mensal_prevent_inactivation()',
    'public.hht_mensal_apply_calcs()',
    'public.diagnosticar_estatisticas_mensais(uuid)',
    'public.set_saida_troca_meta()',
    'public.set_owner_saidas()',
    'public.trg_recalc_troca()',
    'public.recalcular_trocas(uuid, uuid)',
    'public.saidas_preflight_check(uuid, uuid)',
    'public.saidas_preflight_check(uuid, uuid, uuid, uuid)',
    'public.evitar_duplicidade_material_update()',
    'public.material_resolve_item_nome(uuid)',
    'public.fn_normalize_any(anyelement)',
    'public.fn_normalize_text(text)',
    'public.mask_email(text)',
    'public.debug_whoami_invoker()',
    'public.is_master()',
    'public.is_admin()',
    'public.rpc_refresh_gasto_mensal(uuid)',
    'public.rpc_previsao_gasto_mensal_consultar(uuid)',
    'public.rpc_previsao_gasto_mensal_calcular(uuid, numeric)',
    'public.rpc_previsao_gasto_mensal_calcular_periodo(uuid, date, date, numeric)'
  ];
begin
  foreach v_sig in array v_sigs loop
    if to_regprocedure(v_sig) is not null then
      execute format('alter function %s set search_path = pg_catalog, public', v_sig);
    end if;
  end loop;
end $$;

-- Move pg_net extension out of public schema (if present).
create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net'
      and n.nspname = 'public'
  ) then
    execute 'drop extension pg_net';
    execute 'create extension pg_net with schema extensions';
  end if;
end $$;
