-- Evolui a reposicao atual para a politica por cobertura (entrega 2 do plano 2026-09).
-- Depende de: 20260926_secure_forecast_purchase_rpcs.sql e 20260926_create_inventory_policy.sql.
--
-- Antes: `rpc_previsao_compra_sugerida` devolvia apenas o calculo legado (minimo cadastrado,
-- listas top 5 e resumo) com quantidades decimais.
-- Depois: a mesma RPC devolve, alem das chaves legadas inalteradas, as chaves novas
-- `politica`, `calculado_em`, `resumo_reposicao` e `itens` (todos os materiais ativos do tenant).
-- O calculo novo tambem fica disponivel em `rpc_reposicao_itens(p_owner_id)`, sem snapshot,
-- para ser reutilizado pela tela Estoque atual.
--
-- Regras do calculo novo:
--   - saldo = entradas - saidas nao canceladas, ignorando movimentos futuros;
--   - consumo medio mensal = saidas 90d / 3; sem saida em 90d usa 180d / 6; sem saida em 180d = null;
--   - minimo automatico = ceil(consumo x cobertura minima); maximo automatico = ceil(consumo x cobertura alvo);
--   - minimo cadastrado (`materiais.estoqueMinimo`) so vale quando > 0;
--   - precedencia: override ativo > modo automatico (automatico ou fallback_manual) > modo monitorar
--     (manual quando cadastrado; sem manual, o automatico);
--   - null nunca vira zero: sem limite resolvido a situacao e `sem_base_para_calculo`;
--   - compra sugerida sempre inteira (ceil) ate o maximo efetivo.

create or replace function public._inventory_reposicao_calcular(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_politica jsonb := public.inventory_policy_effective(p_owner_id);
  v_modo text := v_politica->>'modo';
  v_cob_min numeric := (v_politica->>'cobertura_minima_meses')::numeric;
  v_cob_alvo numeric := (v_politica->>'cobertura_alvo_meses')::numeric;
  v_cob_excesso numeric := (v_politica->>'cobertura_excesso_meses')::numeric;
  v_divergencia numeric := (v_politica->>'divergencia_tolerancia_pct')::numeric;
  v_agora timestamptz := now();
begin
  return (
    with status_entrada_cancelado as (
      select se.id::text as id
      from public.status_entrada se
      where lower(btrim(se.status)) = 'cancelado'
    ),
    status_saida_cancelado as (
      select ss.id::text as id
      from public.status_saida ss
      where lower(btrim(ss.status)) = 'cancelado'
    ),
    entradas_mov as (
      select
        e."materialId"::text as material_id,
        sum(e.quantidade)::numeric as quantidade
      from public.entradas e
      where e.account_owner_id = p_owner_id
        and e."dataEntrada" <= v_agora
        and lower(btrim(coalesce(e.status::text, ''))) <> 'cancelado'
        and coalesce(e.status::text, '') not in (select id from status_entrada_cancelado)
      group by e."materialId"
    ),
    saidas_mov as (
      select
        s."materialId"::text as material_id,
        sum(s.quantidade)::numeric as quantidade_total,
        coalesce(sum(s.quantidade) filter (where s."dataEntrega" >= v_agora - interval '90 days'), 0)::numeric as quantidade_90d,
        coalesce(sum(s.quantidade) filter (where s."dataEntrega" >= v_agora - interval '180 days'), 0)::numeric as quantidade_180d
      from public.saidas s
      where s.account_owner_id = p_owner_id
        and s."dataEntrega" <= v_agora
        and lower(btrim(coalesce(s.status::text, ''))) <> 'cancelado'
        and coalesce(s.status::text, '') not in (select id from status_saida_cancelado)
      group by s."materialId"
    ),
    base as (
      select
        m.id as material_id,
        coalesce(nullif(btrim(gmi.nome), ''), m.nome::text) as nome,
        coalesce(nullif(btrim(fab.fabricante), ''), nullif(btrim(m.fabricante::text), '')) as fabricante,
        round(coalesce(m."valorUnitario", 0)::numeric, 2) as preco_unitario,
        case when m."estoqueMinimo" > 0 then m."estoqueMinimo"::numeric end as minimo_manual,
        coalesce(em.quantidade, 0) - coalesce(sm.quantidade_total, 0) as estoque_atual,
        coalesce(sm.quantidade_90d, 0) as consumo_90d,
        coalesce(sm.quantidade_180d, 0) as consumo_180d
      from public.materiais m
      left join public.grupos_material_itens gmi on gmi.id::text = m.nome::text
      left join public.fabricantes fab on fab.id::text = m.fabricante::text
      left join entradas_mov em on em.material_id = m.id::text
      left join saidas_mov sm on sm.material_id = m.id::text
      where m.account_owner_id = p_owner_id
        and coalesce(m.ativo, true) = true
    ),
    consumo as (
      select
        b.*,
        case
          when b.consumo_90d > 0 then '90d'
          when b.consumo_180d > 0 then '180d'
          else 'sem_historico'
        end as base_calculo,
        case
          when b.consumo_90d > 0 then round(b.consumo_90d / 3.0, 2)
          when b.consumo_180d > 0 then round(b.consumo_180d / 6.0, 2)
        end as consumo_medio_mensal
      from base b
    ),
    automatico as (
      select
        c.*,
        case when c.consumo_medio_mensal is not null then ceil(c.consumo_medio_mensal * v_cob_min) end as minimo_automatico,
        case when c.consumo_medio_mensal is not null then ceil(c.consumo_medio_mensal * v_cob_alvo) end as maximo_automatico,
        case when c.consumo_medio_mensal > 0 then round(c.estoque_atual / c.consumo_medio_mensal, 2) end as cobertura_atual_meses
      from consumo c
    ),
    overrides_ativos as (
      select distinct on (o.material_id)
        o.material_id,
        o.id,
        o.minimo,
        o.maximo,
        o.motivo,
        o.expira_em
      from public.inventory_material_override o
      where o.account_owner_id = p_owner_id
        and o.revogado_em is null
        and o.inicio_em <= v_agora
        and o.expira_em > v_agora
      order by o.material_id, o.inicio_em desc
    ),
    regra_base as (
      select
        a.*,
        ov.id as override_id,
        ov.minimo::numeric as override_minimo,
        ov.maximo::numeric as override_maximo,
        ov.motivo as override_motivo,
        ov.expira_em as override_expira_em,
        case
          when v_modo = 'automatico' and a.minimo_automatico is not null then 'automatico'
          when v_modo = 'automatico' and a.minimo_manual is not null then 'fallback_manual'
          when v_modo = 'monitorar' and a.minimo_manual is not null then 'manual'
          -- Monitorar sem minimo cadastrado: usa o automatico (o legado ja usava consumo como alvo).
          when v_modo = 'monitorar' and a.minimo_automatico is not null then 'automatico'
          else 'sem_politica'
        end as fonte_base
      from automatico a
      left join overrides_ativos ov on ov.material_id = a.material_id
    ),
    limites_base as (
      select
        r.*,
        case r.fonte_base
          when 'automatico' then r.minimo_automatico
          when 'fallback_manual' then r.minimo_manual
          when 'manual' then r.minimo_manual
        end as minimo_base,
        case r.fonte_base
          when 'automatico' then r.maximo_automatico
          when 'fallback_manual' then r.minimo_manual
          -- Modo monitorar preserva o alvo legado: maior entre minimo cadastrado e consumo x cobertura alvo.
          when 'manual' then greatest(r.minimo_manual, coalesce(r.maximo_automatico, 0))
        end as maximo_base
      from regra_base r
    ),
    limites as (
      select
        l.*,
        case when l.override_id is not null then 'override' else l.fonte_base end as fonte_regra,
        case when l.override_id is not null then coalesce(l.override_minimo, l.minimo_base) else l.minimo_base end as minimo_efetivo_raw,
        case when l.override_id is not null then coalesce(l.override_maximo, l.maximo_base) else l.maximo_base end as maximo_efetivo_raw
      from limites_base l
    ),
    efetivo as (
      select
        l.*,
        l.minimo_efetivo_raw as minimo_efetivo,
        case
          when l.maximo_efetivo_raw is null then l.minimo_efetivo_raw
          when l.minimo_efetivo_raw is null then l.maximo_efetivo_raw
          else greatest(l.maximo_efetivo_raw, l.minimo_efetivo_raw)
        end as maximo_efetivo
      from limites l
    ),
    situacao as (
      select
        e.*,
        case
          when e.estoque_atual <= 0
            and (coalesce(e.minimo_efetivo, 0) > 0 or coalesce(e.consumo_medio_mensal, 0) > 0)
            then 'ruptura_atual'
          when e.minimo_efetivo is null then 'sem_base_para_calculo'
          when e.estoque_atual < e.minimo_efetivo then 'reposicao_necessaria'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses < v_cob_min then 'reposicao_necessaria'
          when e.estoque_atual < e.maximo_efetivo then 'reposicao_programada'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses > v_cob_excesso then 'acima_do_alvo'
          when e.consumo_medio_mensal is null and e.estoque_atual > greatest(e.maximo_efetivo * 2, 1) then 'acima_do_alvo'
          else 'manter'
        end as situacao,
        case
          when e.estoque_atual <= 0
            and (coalesce(e.minimo_efetivo, 0) > 0 or coalesce(e.consumo_medio_mensal, 0) > 0)
            then 'estoque_zerado'
          when e.minimo_efetivo is null then 'sem_limite_definido'
          when e.estoque_atual < e.minimo_efetivo then 'abaixo_do_minimo_efetivo'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses < v_cob_min then 'cobertura_abaixo_da_minima'
          when e.estoque_atual < e.maximo_efetivo then 'abaixo_do_maximo_efetivo'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses > v_cob_excesso then 'cobertura_acima_do_excesso'
          when e.consumo_medio_mensal is null and e.estoque_atual > greatest(e.maximo_efetivo * 2, 1) then 'estoque_sem_consumo_recente'
          else 'dentro_dos_limites'
        end as motivo_situacao
      from efetivo e
    ),
    compra as (
      select
        s.*,
        case
          when s.situacao in ('ruptura_atual', 'reposicao_necessaria', 'reposicao_programada')
            then greatest(ceil(coalesce(s.maximo_efetivo, s.maximo_automatico, 0) - s.estoque_atual), 0)
          else 0
        end as compra_sugerida_qtd,
        case s.situacao
          when 'ruptura_atual' then 'P0'
          when 'reposicao_necessaria' then 'P1'
          when 'reposicao_programada' then 'P2'
          when 'manter' then 'P3'
        end as prioridade,
        case
          when s.minimo_manual is not null
            and s.minimo_automatico is not null
            and s.minimo_automatico > 0
            and abs(s.minimo_manual - s.minimo_automatico) / s.minimo_automatico * 100 > v_divergencia
            then case when s.minimo_manual > s.minimo_automatico then 'manual_acima' else 'manual_abaixo' end
        end as divergencia_manual,
        case
          when s.minimo_manual is not null and s.minimo_automatico is not null and s.minimo_automatico > 0
            then round((s.minimo_manual - s.minimo_automatico) / s.minimo_automatico * 100, 1)
        end as divergencia_pct
      from situacao s
    ),
    final as (
      select
        c.*,
        case
          when c.compra_sugerida_qtd <= 0 then 'sem_compra'
          when c.maximo_efetivo is null then 'ate_maximo_automatico'
          when c.fonte_regra in ('manual', 'fallback_manual') and c.maximo_efetivo = c.minimo_manual then 'ate_minimo_manual'
          else 'ate_maximo_efetivo'
        end as criterio_compra,
        round(c.compra_sugerida_qtd * c.preco_unitario, 2) as valor_compra_sugerida,
        array_remove(array[
          case when c.divergencia_manual is not null then 'manual_divergente' end,
          case when c.base_calculo = 'sem_historico' then 'sem_historico' end,
          case when c.fonte_regra = 'sem_politica' then 'sem_politica' end,
          case when c.preco_unitario <= 0 then 'sem_preco' end,
          case when c.override_expira_em is not null and c.override_expira_em < v_agora + interval '15 days' then 'override_expirando' end
        ], null) as avisos
      from compra c
    ),
    resumo as (
      select
        count(*) as materiais_monitorados,
        count(*) filter (where situacao = 'ruptura_atual') as ruptura_atual,
        count(*) filter (where situacao = 'reposicao_necessaria') as reposicao_necessaria,
        count(*) filter (where situacao = 'reposicao_programada') as reposicao_programada,
        count(*) filter (where situacao = 'manter') as manter,
        count(*) filter (where situacao = 'acima_do_alvo') as acima_do_alvo,
        count(*) filter (where situacao = 'sem_base_para_calculo') as sem_base_para_calculo,
        count(*) filter (where fonte_regra = 'manual') as fonte_manual,
        count(*) filter (where fonte_regra = 'automatico') as fonte_automatico,
        count(*) filter (where fonte_regra = 'fallback_manual') as fonte_fallback_manual,
        count(*) filter (where fonte_regra = 'override') as fonte_override,
        count(*) filter (where fonte_regra = 'sem_politica') as fonte_sem_politica,
        count(*) filter (where divergencia_manual = 'manual_acima') as divergencia_manual_acima,
        count(*) filter (where divergencia_manual = 'manual_abaixo') as divergencia_manual_abaixo,
        count(*) filter (where base_calculo = 'sem_historico') as sem_historico,
        count(*) filter (where preco_unitario <= 0) as sem_preco,
        count(*) filter (where compra_sugerida_qtd > 0) as itens_com_compra,
        coalesce(sum(compra_sugerida_qtd), 0) as quantidade_compra_sugerida,
        round(coalesce(sum(valor_compra_sugerida), 0), 2) as valor_compra_sugerida,
        round(coalesce(sum(valor_compra_sugerida) filter (where situacao in ('ruptura_atual', 'reposicao_necessaria')), 0), 2) as valor_compra_urgente,
        round(coalesce(sum(valor_compra_sugerida) filter (where situacao = 'reposicao_programada'), 0), 2) as valor_compra_programada,
        round((percentile_cont(0.5) within group (order by cobertura_atual_meses))::numeric, 2) as cobertura_mediana_meses
      from final
    )
    select jsonb_build_object(
      'politica', v_politica,
      'calculado_em', v_agora,
      'resumo_reposicao', (select to_jsonb(r) from resumo r),
      'itens', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'material_id', f.material_id,
            'nome', f.nome,
            'fabricante', f.fabricante,
            'estoque_atual', f.estoque_atual,
            'minimo_manual', f.minimo_manual,
            'minimo_automatico', f.minimo_automatico,
            'maximo_automatico', f.maximo_automatico,
            'minimo_efetivo', f.minimo_efetivo,
            'maximo_efetivo', f.maximo_efetivo,
            'fonte_regra', f.fonte_regra,
            'override', case when f.override_id is null then null else jsonb_build_object(
              'id', f.override_id,
              'minimo', f.override_minimo,
              'maximo', f.override_maximo,
              'motivo', f.override_motivo,
              'expira_em', f.override_expira_em
            ) end,
            'consumo_90d', f.consumo_90d,
            'consumo_180d', f.consumo_180d,
            'base_calculo', f.base_calculo,
            'consumo_medio_mensal', f.consumo_medio_mensal,
            'cobertura_atual_meses', f.cobertura_atual_meses,
            'cobertura_minima_meses', v_cob_min,
            'cobertura_alvo_meses', v_cob_alvo,
            'situacao', f.situacao,
            'motivo_situacao', f.motivo_situacao,
            'prioridade', f.prioridade,
            'compra_sugerida_qtd', f.compra_sugerida_qtd,
            'criterio_compra', f.criterio_compra,
            'preco_unitario', f.preco_unitario,
            'valor_compra_sugerida', f.valor_compra_sugerida,
            'divergencia_manual', f.divergencia_manual,
            'divergencia_pct', f.divergencia_pct,
            'avisos', to_jsonb(f.avisos)
          )
          order by f.prioridade nulls last, f.valor_compra_sugerida desc, f.nome
        )
        from final f
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public._inventory_reposicao_calcular(uuid) from public, anon, authenticated;
grant execute on function public._inventory_reposicao_calcular(uuid) to service_role;

-- Reposicao atual sem snapshot, para a aba Compra e a tela Estoque atual.
create or replace function public.rpc_reposicao_itens(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.forecast_assert_owner_access(p_owner_id);
  return public._inventory_reposicao_calcular(p_owner_id);
end;
$$;

revoke all on function public.rpc_reposicao_itens(uuid) from public, anon;
grant execute on function public.rpc_reposicao_itens(uuid) to authenticated, service_role;

-- Mesma assinatura: chaves legadas inalteradas + chaves novas da politica.
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
  return coalesce(public._rpc_previsao_compra_sugerida_impl(p_owner_id, p_forecast_id), '{}'::jsonb)
    || public._inventory_reposicao_calcular(p_owner_id);
end;
$$;

revoke all on function public.rpc_previsao_compra_sugerida(uuid, uuid) from public, anon;
grant execute on function public.rpc_previsao_compra_sugerida(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
