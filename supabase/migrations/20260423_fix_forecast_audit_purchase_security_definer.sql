-- Corrige as RPCs de auditoria/compra do forecast para seguirem o padrao
-- do projeto e nao quebrarem por RLS no banco.

alter function public.rpc_previsao_gasto_mensal_auditar(uuid, uuid)
  security definer
  set search_path = public;

alter function public.rpc_previsao_compra_sugerida(uuid, uuid)
  security definer
  set search_path = public;
