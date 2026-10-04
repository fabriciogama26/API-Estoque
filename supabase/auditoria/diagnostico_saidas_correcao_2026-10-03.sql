-- =====================================================================
-- DIAGNOSTICO: saidas lancadas para "corrigir estoque" pela tela de Saida
-- (arquivo saidas-2026-10-03.csv: 38 saidas, 92 unidades, 28 materiais do
-- ALMOX - SEGURANCA DO TRABALHO). Somente leitura: nao altera nada.
-- Rodar no SQL Editor do Supabase.
--
-- Regra do saldo (calcular_saldo_estoque):
--   entradas nao canceladas - saidas nao canceladas + correcoes aprovadas.
-- Excluir ou cancelar uma saida DEVOLVE a quantidade ao saldo: ele so sobe.
-- O risco nao e ficar negativo, e o saldo voltar para o valor errado que
-- essas saidas tentaram corrigir.
--
-- Uma linha por material x centro. Colunas:
--   qtd_a_devolver      soma das saidas do arquivo que ainda nao estao canceladas
--   saldo_atual         saldo de hoje, ja com as saidas do arquivo descontadas
--   saldo_se_excluir    saldo depois de excluir ou cancelar as saidas do arquivo
--   fica_negativo       saldo_se_excluir < 0
--   saldo_se_converter  saldo depois de trocar as saidas por uma correcao
--                       aprovada de mesma quantidade (igual ao atual)
--   correcao_depois     data da ultima correcao aprovada depois da primeira saida
--                       do arquivo: ela ja foi calculada com essas saidas descontadas
--   correcao_pendente   correcao PENDENTE no material x centro: o banco bloqueia
--                       qualquer alteracao das saidas ate aprovar/rejeitar/cancelar
--   trocas_dependentes  saidas fora do arquivo cujo trocaDeSaida aponta para uma
--                       saida do arquivo: impedem o DELETE (chave estrangeira)
-- IDs do arquivo que nao existem no banco aparecem como "ID nao encontrado".
-- =====================================================================
with ids(id) as (
  values
    ('13096112-989a-4b17-a5be-48600287954e'::uuid),
    ('e8d92304-8115-4de1-bb53-b8cac16ea940'::uuid),
    ('59de0694-a943-4199-9468-15367bff3a45'::uuid),
    ('1159e6bf-fb57-4ead-a4af-486d759b394c'::uuid),
    ('a005da66-2ff4-43c8-9b38-a025ed9950e8'::uuid),
    ('1ec9362a-d810-4120-b3a8-c48fab75fbf1'::uuid),
    ('4382fc3b-b3be-4969-9df9-564f4eefb275'::uuid),
    ('1d77d1d4-1fb8-47fa-869b-e16845b6fc31'::uuid),
    ('69d966a0-77a2-41a6-ba89-394941b5e57a'::uuid),
    ('f2878b76-e339-4d56-9ab3-bd2c9d32e2d2'::uuid),
    ('bd612c3a-3685-466d-a841-93627a965a60'::uuid),
    ('2d6d8df8-22af-429e-9c44-28160e674283'::uuid),
    ('72d62b61-e2e1-4e91-a07c-0c0e2c1f2a2e'::uuid),
    ('f2d1e095-d00e-4a5d-91b8-9d81e9cd4d52'::uuid),
    ('82aeb7e3-7e17-4962-bfa3-03fc390fa288'::uuid),
    ('5947664d-179f-480a-8c62-91963343d303'::uuid),
    ('6ea1ae03-2d03-44bb-bc3e-a88225e927aa'::uuid),
    ('1d890b8b-213c-4244-9f63-416fcf380fb8'::uuid),
    ('d9e4ee32-fc4c-444d-ab65-b4a03cb68a15'::uuid),
    ('1dc9ed26-e032-4738-99a9-d18b089e0b9c'::uuid),
    ('c86adae6-624c-4dc2-af81-ee11038a550f'::uuid),
    ('747e2bb6-406b-497f-93e6-75aee36ff378'::uuid),
    ('3077806f-8e11-4e1d-b568-7bebd9ca3db7'::uuid),
    ('42b138d5-e287-463d-8471-1e7cb0b08114'::uuid),
    ('c70bab72-93a8-4d9d-8a38-23fe69669fc9'::uuid),
    ('b3cfdb0e-0e64-4a0b-bfcf-dd8af03b35b4'::uuid),
    ('9c8a362d-8e69-403b-b23f-ef43e7e72dec'::uuid),
    ('da39d506-d9b0-407b-937e-08141a185706'::uuid),
    ('bc965fa3-f66c-4230-b2d8-262eb37d01ba'::uuid),
    ('ab0d3248-0ee6-4c68-a83b-03a95f9b7ab3'::uuid),
    ('3842bb23-b012-4484-88d4-71ef3d96c3b7'::uuid),
    ('09d12e27-fe40-4883-a6ac-df4c4cac9fa5'::uuid),
    ('482b30bf-a16c-4a85-b59e-d4bf0ecc339a'::uuid),
    ('9fd869df-f422-4f71-b449-45f8c130ded0'::uuid),
    ('668657ac-7571-4389-a977-09ae106ac75b'::uuid),
    ('80df708f-8630-4c00-9cc4-e36a25643793'::uuid),
    ('1ff046ec-7139-4bed-aeb3-5618e790893d'::uuid),
    ('790ab4bd-0af5-46fe-8b7c-fc5fbe235fc2'::uuid)
),
alvo as (
  select s.id,
         s.account_owner_id,
         s."materialId" as material_id,
         s.centro_estoque as centro_id,
         s.quantidade,
         s."dataEntrega" as data_entrega,
         lower(coalesce(st.status, '')) = 'cancelado' as cancelada
    from ids
    join public.saidas s on s.id = ids.id
    left join public.status_saida st on st.id = s.status
),
posicoes as (
  select account_owner_id,
         material_id,
         centro_id,
         count(*) as saidas_no_arquivo,
         count(*) filter (where cancelada) as ja_canceladas,
         coalesce(sum(quantidade) filter (where not cancelada), 0) as qtd_a_devolver,
         min(data_entrega) as primeira_saida
    from alvo
   group by account_owner_id, material_id, centro_id
),
trocas as (
  select a.account_owner_id, a.material_id, a.centro_id, count(*) as qtd
    from public.saidas s2
    join alvo a on a.id = s2."trocaDeSaida"
   where s2.id not in (select id from ids)
   group by a.account_owner_id, a.material_id, a.centro_id
),
calculo as (
  select p.*,
         public.calcular_saldo_estoque(p.account_owner_id, p.material_id, p.centro_id) as saldo_atual,
         (select max(r.approved_at)
            from public.stock_correction_requests r
           where r.account_owner_id = p.account_owner_id
             and r.material_id = p.material_id
             and r.stock_center_id = p.centro_id
             and r.status = 'APROVADO'
             and r.approved_at >= p.primeira_saida) as correcao_depois,
         exists (select 1
                   from public.stock_correction_requests r
                  where r.account_owner_id = p.account_owner_id
                    and r.material_id = p.material_id
                    and r.stock_center_id = p.centro_id
                    and r.status = 'PENDENTE') as correcao_pendente,
         coalesce(t.qtd, 0) as trocas_dependentes
    from posicoes p
    left join trocas t
      on t.account_owner_id = p.account_owner_id
     and t.material_id = p.material_id
     and t.centro_id is not distinct from p.centro_id
)
select concat_ws(' | ', mv."materialItemNome", mv."grupoMaterialNome",
                 coalesce(mv."numeroCalcadoNome", mv."numeroVestimentaNome", mv."numeroEspecifico"),
                 mv."fabricanteNome") as material,
       coalesce(ce.almox, '(sem centro)') as centro,
       c.saidas_no_arquivo,
       c.ja_canceladas,
       c.qtd_a_devolver,
       c.saldo_atual,
       c.saldo_atual + c.qtd_a_devolver as saldo_se_excluir,
       c.saldo_atual + c.qtd_a_devolver < 0 as fica_negativo,
       c.saldo_atual as saldo_se_converter,
       c.correcao_depois,
       c.correcao_pendente,
       c.trocas_dependentes,
       nullif(concat_ws('; ',
         case when c.centro_id is null then 'SEM CENTRO: saldo fora das posicoes' end,
         case when c.correcao_pendente then 'BLOQUEADO: correcao pendente' end,
         case when c.trocas_dependentes > 0 then 'DELETE falha: outra saida aponta como troca' end,
         case when c.saldo_atual < 0 then 'saldo atual ja negativo' end,
         case when c.correcao_depois is not null then 'correcao aprovada depois: excluir deixa acima do fisico' end,
         case when c.ja_canceladas = c.saidas_no_arquivo then 'todas ja canceladas' end
       ), '') as alertas
  from calculo c
  left join public.materiais_view mv on mv.id = c.material_id
  left join public.centros_estoque ce on ce.id = c.centro_id
union all
select 'ID nao encontrado: ' || ids.id::text,
       null, 0, 0, 0, null, null, null, null, null, null, 0,
       'saida do arquivo nao existe no banco'
  from ids
 where not exists (select 1 from public.saidas s where s.id = ids.id)
 order by alertas nulls last, material;
