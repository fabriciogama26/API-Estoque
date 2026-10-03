-- =====================================================================
-- DIAGNOSTICO: qual versao do orcamento anual (aba Previsao de Orcamento)
-- esta aplicada no banco. Somente leitura.
--
-- Existem 6 migrations com o mesmo prefixo 20260801 que recriam as mesmas
-- funcoes, cada uma com as correcoes da anterior:
--   1 20260801_purchase_budget_12m
--   2 20260801_fix_purchase_budget_uuid_empty
--   3 20260801_fix_purchase_budget_rpc_text_params
--   4 20260801_fix_purchase_budget_status_cancelado_safe
--   5 20260801_fix_purchase_budget_material_uuid_text
--   6 20260801_purchase_budget_validation_audit   (versao final; o front le
--     `validacao_orcamento`, que so existe nela)
--
-- versao_exata compara o codigo da funcao com cada arquivo (md5, ignorando
-- quebras de linha do Windows). versao_por_marcas usa trechos que so existem
-- a partir de cada versao; serve quando a funcao foi colada com alguma
-- diferenca de espacos. Mais de uma linha para a mesma funcao = sobrecargas
-- com assinaturas diferentes convivendo (a antiga uuid, uuid, jsonb e a nova
-- text, text, jsonb).
-- =====================================================================
with funcoes as (
  select p.proname::text as funcao,
         p.oid::regprocedure::text as assinatura,
         p.prosrc,
         md5(replace(p.prosrc, chr(13), '')) as hash
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'rpc_orcamento_compra_12m_calcular',
       'rpc_refresh_consumo_material_mensal',
       'stock_status_is_cancelado',
       'safe_uuid_or_null'
     )
),
versoes(funcao, hash, versao) as (
  values
    ('rpc_orcamento_compra_12m_calcular', 'c7d088711aa211bdc41ba5baa9ee43fb', '1 - purchase_budget_12m'),
    ('rpc_orcamento_compra_12m_calcular', '2d1ee8fd0b493cb6bd116a58f7382fec', '2 - fix_purchase_budget_uuid_empty'),
    ('rpc_orcamento_compra_12m_calcular', 'd86c66213f5292441c5867bbd7926e5b', '3 - fix_purchase_budget_rpc_text_params'),
    ('rpc_orcamento_compra_12m_calcular', 'c26fb76ed677ece4bff67d84a7dba89b', '4 - fix_purchase_budget_status_cancelado_safe'),
    ('rpc_orcamento_compra_12m_calcular', '4ead5afb2bbf723e6241862932fe32a0', '5 - fix_purchase_budget_material_uuid_text'),
    ('rpc_orcamento_compra_12m_calcular', 'e7100116ac83a2514ef58ad06f07c129', '6 - purchase_budget_validation_audit (final)'),
    ('rpc_refresh_consumo_material_mensal', '47d1cc3cbaac11d1c8015bb60f072598', '1'),
    ('rpc_refresh_consumo_material_mensal', '2184e7e576952ae935d9f8540ba53acf', '2 ou 3'),
    ('rpc_refresh_consumo_material_mensal', 'e88d3477be50e4589294afe65b5935b8', '4, 5 ou 6 (final)'),
    ('stock_status_is_cancelado', '32117c4345858b87f2336b5befe6289b', '4, 5 ou 6 (final)'),
    ('safe_uuid_or_null', '58a2ffcc2eeb2d0622dc258d6dc9c43d', '2 a 6 (final)')
)
select f.funcao,
       f.assinatura,
       coalesce(v.versao, 'nenhum arquivo do repositorio (alterada fora das migrations?)') as versao_exata,
       case
         when f.funcao <> 'rpc_orcamento_compra_12m_calcular' then null
         when f.prosrc like '%validacao_orcamento%' then '6 - purchase_budget_validation_audit (final)'
         when f.prosrc like '%m.fabricante::text%' then '5 - fix_purchase_budget_material_uuid_text'
         when f.prosrc like '%stock_status_is_cancelado%' then '4 - fix_purchase_budget_status_cancelado_safe'
         when replace(f.assinatura, ' ', '') like '%(text,text,jsonb)' then '3 - fix_purchase_budget_rpc_text_params'
         when f.prosrc like '%safe_uuid_or_null%' then '2 - fix_purchase_budget_uuid_empty'
         else '1 - purchase_budget_12m'
       end as versao_por_marcas,
       f.prosrc like '%stock_adjustments%' or f.prosrc like '%_estoque_saldos_posicoes%' as considera_correcoes,
       f.hash
  from funcoes f
  left join versoes v on v.funcao = f.funcao and v.hash = f.hash
 order by f.funcao, f.assinatura;
