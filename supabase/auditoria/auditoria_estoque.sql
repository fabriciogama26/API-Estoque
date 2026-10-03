-- =====================================================================
-- AUDITORIA DE ESTOQUE (somente leitura: nenhuma consulta altera dados)
--
-- COMO RODAR: o SQL Editor do Supabase mostra o resultado de UMA consulta
-- por execucao. Selecione um bloco inteiro (do "with" ate o ";") e rode
-- com Ctrl+Enter. Rodando o arquivo todo, voce ve so uma das tabelas.
--
-- Filtro de tenant (opcional): troque  NULL::uuid /*OWNER*/  pelo
-- account_owner_id. NULL = todos os tenants.
--
-- Regra de saldo usada aqui = a mesma de public.calcular_saldo_estoque
-- (Saida, modal de correcao e trigger validar_saldo_saida):
--   entradas nao canceladas - saidas nao canceladas + correcoes aprovadas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) PRINCIPAL: todas as entradas - todas as saidas x o que a tela mostra
-- Uma linha por material. Compare "saldo_auditoria" com o card da tela
-- Estoque atual.
--   saldo_auditoria  = entradas - saidas + correcoes (todos os centros):
--                      e o numero que o card DEVERIA mostrar.
--   saldo_tela_hoje  = simulacao do card ANTES de 20261003_estoque_saldo_unico,
--                      que so recebia as 1000 entradas e as 1000 saidas mais
--                      recentes do tenant.
--   saldo_por_centro = o que o modal de correcao e a Saida enxergam,
--                      centro a centro.
-- Os materiais com diferenca aparecem primeiro.
-- Depois da migration aplicada, o card mostra saldo_auditoria e
-- saldo_por_centro (mesma regra); saldo_tela_hoje so serve de historico.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
ent as (
  select e.account_owner_id, e."materialId" as material_id, e.centro_estoque as centro_id,
         e.quantidade, e."dataEntrada" as data
    from public.entradas e
    left join public.status_entrada st on st.id = e.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
),
sai as (
  select s.account_owner_id, s."materialId" as material_id, s.centro_estoque as centro_id,
         s.quantidade, s."dataEntrega" as data
    from public.saidas s
    left join public.status_saida st on st.id = s.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
),
aj as (
  select a.account_owner_id, a.material_id, a.stock_center_id as centro_id,
         a.adjustment_quantity as quantidade
    from public.stock_adjustments a
),
-- A tela pega as 1000 linhas mais recentes ANTES de tirar as canceladas.
ent_tela as (
  select x.account_owner_id, x."materialId" as material_id, x.quantidade
    from (
      select e.*, row_number() over (partition by e.account_owner_id order by e."dataEntrada" desc) as rn
        from public.entradas e
    ) x
    left join public.status_entrada st on st.id = x.status
   where x.rn <= 1000
     and lower(coalesce(st.status, '')) <> 'cancelado'
),
sai_tela as (
  select x.account_owner_id, x."materialId" as material_id, x.quantidade
    from (
      select s.*, row_number() over (partition by s.account_owner_id order by s."dataEntrega" desc) as rn
        from public.saidas s
    ) x
    left join public.status_saida st on st.id = x.status
   where x.rn <= 1000
     and lower(coalesce(st.status, '')) <> 'cancelado'
),
por_material as (
  select account_owner_id, material_id,
         sum(qtd_ent) as total_entradas,
         sum(qtd_sai) as total_saidas,
         sum(qtd_aj) as total_correcoes,
         sum(qtd_tela) as saldo_tela_hoje
    from (
      select account_owner_id, material_id, quantidade as qtd_ent, 0 as qtd_sai, 0 as qtd_aj, 0 as qtd_tela from ent
      union all
      select account_owner_id, material_id, 0, quantidade, 0, 0 from sai
      union all
      select account_owner_id, material_id, 0, 0, quantidade, quantidade from aj
      union all
      select account_owner_id, material_id, 0, 0, 0, quantidade from ent_tela
      union all
      select account_owner_id, material_id, 0, 0, 0, -quantidade from sai_tela
    ) m
   group by account_owner_id, material_id
),
por_centro as (
  select account_owner_id, material_id, centro_id, sum(qtd) as saldo
    from (
      select account_owner_id, material_id, centro_id, quantidade as qtd from ent
      union all
      select account_owner_id, material_id, centro_id, -quantidade from sai
      union all
      select account_owner_id, material_id, centro_id, quantidade from aj
    ) c
   group by account_owner_id, material_id, centro_id
),
centros_texto as (
  select pc.account_owner_id, pc.material_id,
         string_agg(
           coalesce(c.almox, '(sem centro)')
             || case when c.id is not null and coalesce(c.ativo, true) = false then ' (inativo)' else '' end
             || ': ' || trim_scale(pc.saldo)::text,
           ' | ' order by c.almox
         ) as saldo_por_centro
    from por_centro pc
    left join public.centros_estoque c on c.id = pc.centro_id
   where pc.saldo <> 0
   group by pc.account_owner_id, pc.material_id
)
select pm.account_owner_id,
       coalesce(v."materialItemNome", v.descricao, pm.material_id::text) as material,
       v.ca,
       pm.total_entradas,
       pm.total_saidas,
       pm.total_correcoes,
       pm.total_entradas - pm.total_saidas + pm.total_correcoes as saldo_auditoria,
       pm.saldo_tela_hoje,
       pm.saldo_tela_hoje - (pm.total_entradas - pm.total_saidas + pm.total_correcoes) as diferenca_tela,
       pm.saldo_tela_hoje = (pm.total_entradas - pm.total_saidas + pm.total_correcoes) as confere,
       ct.saldo_por_centro
  from por_material pm
  cross join params p
  left join centros_texto ct on ct.account_owner_id = pm.account_owner_id and ct.material_id = pm.material_id
  left join public.materiais_view v on v.id = pm.material_id
 where p.owner_id is null or pm.account_owner_id = p.owner_id
 order by abs(pm.saldo_tela_hoje - (pm.total_entradas - pm.total_saidas + pm.total_correcoes)) desc,
          material;


-- ---------------------------------------------------------------------
-- 2) Volume de lancamentos por tenant
-- Acima de 1000, a tela Estoque atual e as listas de Entradas e Saidas
-- passam a ignorar os lancamentos mais antigos.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
owners as (
  select account_owner_id from public.entradas
  union
  select account_owner_id from public.saidas
),
volume as (
  select o.account_owner_id,
         (select count(*) from public.entradas e where e.account_owner_id = o.account_owner_id) as total_entradas,
         (select count(*) from public.saidas s where s.account_owner_id = o.account_owner_id) as total_saidas
    from owners o
)
select v.*,
       v.total_entradas > 1000 as entradas_cortadas_na_tela,
       v.total_saidas > 1000 as saidas_cortadas_na_tela
  from volume v, params p
 where p.owner_id is null or v.account_owner_id = p.owner_id
 order by v.total_saidas desc;


-- ---------------------------------------------------------------------
-- 3) Detalhe por material x centro, com alertas
-- Mostra os lancamentos que a tela soma mas a Saida nao enxerga (sem
-- centro, centro inativo, centro de outro tenant) e saldos negativos.
-- Para ver so as linhas com alerta, descomente o filtro no final.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
mov as (
  select e.account_owner_id, e."materialId" as material_id, e.centro_estoque as centro_id,
         e.quantidade as ent, 0 as sai, 0 as aj
    from public.entradas e
    left join public.status_entrada st on st.id = e.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
  union all
  select s.account_owner_id, s."materialId", s.centro_estoque, 0, s.quantidade, 0
    from public.saidas s
    left join public.status_saida st on st.id = s.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
  union all
  select a.account_owner_id, a.material_id, a.stock_center_id, 0, 0, a.adjustment_quantity
    from public.stock_adjustments a
),
saldo as (
  select account_owner_id, material_id, centro_id,
         sum(ent) as entradas, sum(sai) as saidas, sum(aj) as correcoes,
         sum(ent) - sum(sai) + sum(aj) as saldo
    from mov
   group by account_owner_id, material_id, centro_id
),
detalhe as (
  select s.*,
         coalesce(v."materialItemNome", v.descricao, s.material_id::text) as material,
         v.ca,
         coalesce(c.almox, '(sem centro)') as centro,
         case
           when s.centro_id is null then 'sem centro: a tela soma, a Saida nao enxerga'
           when c.id is null then 'centro inexistente'
           when c.account_owner_id <> s.account_owner_id then 'centro de outro tenant'
           when s.saldo < 0 then 'saldo negativo'
           when coalesce(c.ativo, true) = false and s.saldo <> 0 then 'saldo em centro inativo: nao aparece na Saida'
         end as alerta
    from saldo s
    left join public.materiais_view v on v.id = s.material_id
    left join public.centros_estoque c on c.id = s.centro_id
)
select d.account_owner_id, d.material, d.ca, d.centro, d.centro_id,
       d.entradas, d.saidas, d.correcoes, d.saldo, d.alerta
  from detalhe d, params p
 where (p.owner_id is null or d.account_owner_id = p.owner_id)
 -- and d.alerta is not null
 order by d.alerta nulls last, d.material, d.centro;


-- ---------------------------------------------------------------------
-- 4) Centros de estoque com nome repetido no mesmo tenant
-- As telas de Entradas e Saidas escondem centros de nome repetido (so o
-- primeiro aparece). O estoque do outro aparece na tela Estoque atual,
-- mas nao pode ser baixado pela Saida.
-- (O sistema tambem ignora acentos ao comparar; aqui so caixa e espacos.)
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id)
select c.account_owner_id,
       lower(regexp_replace(btrim(c.almox), '\s+', ' ', 'g')) as nome_normalizado,
       count(*) as quantidade_de_centros,
       string_agg(
         c.id::text || ' = ' || coalesce(c.almox, '')
           || case when coalesce(c.ativo, true) then '' else ' (inativo)' end,
         ' | ' order by c.created_at
       ) as centros
  from public.centros_estoque c, params p
 where p.owner_id is null or c.account_owner_id = p.owner_id
 group by 1, 2
having count(*) > 1
 order by 1, 2;


-- ---------------------------------------------------------------------
-- 5) Lancamentos ativos com dados inconsistentes
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
lancamentos as (
  select 'entrada' as tipo, e.id, e.account_owner_id, e."materialId" as material_id,
         e.centro_estoque as centro_id, e.quantidade, e."dataEntrada" as data,
         st.id as status_ok, st.status as status_nome
    from public.entradas e
    left join public.status_entrada st on st.id = e.status
  union all
  select 'saida', s.id, s.account_owner_id, s."materialId",
         s.centro_estoque, s.quantidade, s."dataEntrega",
         st.id, st.status
    from public.saidas s
    left join public.status_saida st on st.id = s.status
),
analise as (
  select l.*,
         case
           when l.centro_id is null then 'sem centro de estoque'
           when c.id is null then 'centro de estoque inexistente'
           when m.id is null then 'material inexistente'
           when c.account_owner_id <> l.account_owner_id then 'centro de outro tenant'
           when m.account_owner_id <> l.account_owner_id then 'material de outro tenant'
           when l.status_ok is null then 'status desconhecido (conta como ativo)'
         end as problema
    from lancamentos l
    left join public.centros_estoque c on c.id = l.centro_id
    left join public.materiais m on m.id = l.material_id
   where lower(coalesce(l.status_nome, '')) <> 'cancelado'
)
select a.tipo, a.id, a.account_owner_id, a.material_id, a.centro_id, a.quantidade, a.data, a.problema
  from analise a, params p
 where a.problema is not null
   and (p.owner_id is null or a.account_owner_id = p.owner_id)
 order by a.problema, a.data desc;


-- ---------------------------------------------------------------------
-- 6a) Possiveis entradas lancadas em dobro
-- Mesmo material, centro e quantidade com DATA DE ENTRADA a menos de
-- 10 minutos uma da outra. Usa a data do lancamento (e nao a data de
-- criacao) para nao confundir com importacoes em lote, em que todas as
-- linhas recebem o mesmo horario de criacao.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
base as (
  select e.id, e.account_owner_id, e."materialId" as material_id, e.centro_estoque,
         e.quantidade, e."dataEntrada", e.create_at, e."usuarioResponsavel",
         lag(e.id) over w as id_anterior,
         lag(e."dataEntrada") over w as entrada_anterior,
         lag(e.create_at) over w as criado_anterior
    from public.entradas e
    left join public.status_entrada st on st.id = e.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
  window w as (partition by e.account_owner_id, e."materialId", e.centro_estoque, e.quantidade
               order by e."dataEntrada", e.id)
)
select b.account_owner_id,
       coalesce(v."materialItemNome", v.descricao, b.material_id::text) as material,
       c.almox as centro,
       b.quantidade,
       b.id_anterior,
       b.entrada_anterior,
       b.id as id_suspeito,
       b."dataEntrada" as entrada_suspeita,
       case when b.create_at = b.criado_anterior then 'mesma importacao em lote' else 'lancamentos separados' end as origem,
       b."usuarioResponsavel"
  from base b
  cross join params p
  left join public.materiais_view v on v.id = b.material_id
  left join public.centros_estoque c on c.id = b.centro_estoque
 where b.entrada_anterior is not null
   and b."dataEntrada" - b.entrada_anterior < interval '10 minutes'
   and (p.owner_id is null or b.account_owner_id = p.owner_id)
 order by b."dataEntrada" desc;


-- ---------------------------------------------------------------------
-- 6b) Possiveis saidas lancadas em dobro
-- Mesma pessoa e material com DATA DE ENTREGA a menos de 10 minutos.
-- "troca" = true indica que o usuario confirmou a troca na tela; troca
-- segundos depois da primeira entrega costuma ser clique repetido.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id),
base as (
  select s.id, s.account_owner_id, s."materialId" as material_id, s."pessoaId",
         s.quantidade, s."dataEntrega", s."criadoEm", s."isTroca",
         lag(s.id) over w as id_anterior,
         lag(s."dataEntrega") over w as entrega_anterior,
         lag(s."criadoEm") over w as criado_anterior
    from public.saidas s
    left join public.status_saida st on st.id = s.status
   where lower(coalesce(st.status, '')) <> 'cancelado'
  window w as (partition by s.account_owner_id, s."pessoaId", s."materialId"
               order by s."dataEntrega", s.id)
)
select b.account_owner_id,
       coalesce(v."materialItemNome", v.descricao, b.material_id::text) as material,
       b."pessoaId",
       b.quantidade,
       b.id_anterior,
       b.entrega_anterior,
       b.id as id_suspeito,
       b."dataEntrega" as entrega_suspeita,
       b."isTroca" as troca,
       case when b."criadoEm" = b.criado_anterior then 'mesma importacao em lote' else 'lancamentos separados' end as origem
  from base b
  cross join params p
  left join public.materiais_view v on v.id = b.material_id
 where b.entrega_anterior is not null
   and b."dataEntrega" - b.entrega_anterior < interval '10 minutes'
   and (p.owner_id is null or b.account_owner_id = p.owner_id)
 order by b."dataEntrega" desc;


-- ---------------------------------------------------------------------
-- 7) Correcoes fisicas pendentes (material + centro bloqueados)
-- saldo_mudou = true: a aprovacao vai falhar ("saldo atual diverge");
-- rejeite e refaca a contagem.
-- ---------------------------------------------------------------------
with params as (select NULL::uuid /*OWNER*/ as owner_id)
select r.id,
       r.account_owner_id,
       coalesce(v."materialItemNome", v.descricao, r.material_id::text) as material,
       c.almox as centro,
       r.system_balance as saldo_na_solicitacao,
       public.calcular_saldo_estoque(r.account_owner_id, r.material_id, r.stock_center_id) as saldo_agora,
       r.physical_quantity as contagem_fisica,
       r.difference,
       r.requested_at,
       r.system_balance <> public.calcular_saldo_estoque(r.account_owner_id, r.material_id, r.stock_center_id) as saldo_mudou
  from public.stock_correction_requests r
  cross join params p
  left join public.materiais_view v on v.id = r.material_id
  left join public.centros_estoque c on c.id = r.stock_center_id
 where r.status = 'PENDENTE'
   and (p.owner_id is null or r.account_owner_id = p.owner_id)
 order by r.requested_at;
