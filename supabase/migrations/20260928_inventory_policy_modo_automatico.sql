-- Politica de reposicao - entrega 5: liberacao do modo automatico com simulacao de impacto.
-- Depende de: 20260927_inventory_policy_sem_consumo_recente.sql.
--
-- Antes: `rpc_inventory_policy_update` recusava o modo `automatico` e nao havia como medir o impacto
-- da troca de modo antes de ativar.
-- Depois:
--   - `_inventory_reposicao_calcular_modo(owner, modo)` calcula a reposicao em qualquer modo sem gravar;
--     `_inventory_reposicao_calcular(owner)` passa a delegar para ela com o modo gravado (sem mudar resultado);
--   - `rpc_inventory_policy_simular_modo(owner, modo)` compara o modo atual com o modo informado:
--     resumos lado a lado e a lista de materiais cujo limite, situacao ou compra muda;
--   - `rpc_inventory_policy_update` aceita o modo `automatico` (motivo continua obrigatorio e auditado);
--   - `rpc_inventory_policy_get` informa `modo_automatico_liberado = true`.
-- Regra do modo automatico (ja implementada no calculo): override > minimo automatico quando calculavel >
-- minimo cadastrado como fallback sem historico (`fallback_manual`) > sem_politica.

create or replace function public._inventory_reposicao_calcular_modo(p_owner_id uuid, p_modo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_politica jsonb := public.inventory_policy_effective(p_owner_id);
  v_modo text := coalesce(nullif(btrim(p_modo), ''), v_politica->>'modo');
  v_cob_min numeric := (v_politica->>'cobertura_minima_meses')::numeric;
  v_cob_alvo numeric := (v_politica->>'cobertura_alvo_meses')::numeric;
  v_cob_excesso numeric := (v_politica->>'cobertura_excesso_meses')::numeric;
  v_divergencia numeric := (v_politica->>'divergencia_tolerancia_pct')::numeric;
  v_janela_sem_consumo integer := (v_politica->>'janela_sem_consumo_dias')::integer;
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
        coalesce(sum(s.quantidade) filter (where s."dataEntrega" >= v_agora - interval '180 days'), 0)::numeric as quantidade_180d,
        coalesce(sum(s.quantidade) filter (where s."dataEntrega" >= v_agora - make_interval(days => v_janela_sem_consumo)), 0)::numeric as quantidade_janela
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
        coalesce(sm.quantidade_180d, 0) as consumo_180d,
        coalesce(sm.quantidade_janela, 0) as consumo_janela
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
          when e.fonte_regra in ('manual', 'fallback_manual')
            and e.consumo_janela <= 0
            and e.estoque_atual < e.minimo_efetivo
            then 'sem_consumo_recente'
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
          when e.fonte_regra in ('manual', 'fallback_manual')
            and e.consumo_janela <= 0
            and e.estoque_atual < e.minimo_efetivo
            then 'minimo_manual_sem_consumo_na_janela'
          when e.estoque_atual <= 0
            and (coalesce(e.minimo_efetivo, 0) > 0 or coalesce(e.consumo_medio_mensal, 0) > 0)
            then 'estoque_zerado'
          when e.minimo_efetivo is null then 'sem_limite_definido'
          when e.estoque_atual < e.minimo_efetivo then 'abaixo_do_minimo_efetivo'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses < v_cob_min then 'cobertura_abaixo_da_minima'
          when e.estoque_atual < e.maximo_efetivo then 'abaixo_do_maximo_efetivo'
          when e.cobertura_atual_meses is not null and e.cobertura_atual_meses > v_cob_excesso then 'cobertura_acima_do_excesso'
          when e.consumo_medio_mensal is null and e.estoque_atual > greatest(e.maximo_efetivo * 2, 1) then 'sem_consumo_e_acima_do_dobro_do_maximo'
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
        case
          when s.situacao = 'sem_consumo_recente' then greatest(ceil(s.minimo_manual - s.estoque_atual), 0)
          else 0
        end as compra_referencia_manual_qtd,
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
        round(c.compra_referencia_manual_qtd * c.preco_unitario, 2) as valor_referencia_manual,
        array_remove(array[
          case when c.divergencia_manual is not null then 'manual_divergente' end,
          case when c.situacao = 'sem_consumo_recente' then 'revisar_minimo_sem_consumo' end,
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
        count(*) filter (where situacao = 'sem_consumo_recente') as sem_consumo_recente,
        coalesce(sum(compra_referencia_manual_qtd), 0) as quantidade_referencia_manual,
        round(coalesce(sum(valor_referencia_manual), 0), 2) as valor_referencia_manual,
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
      'modo_calculado', v_modo,
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
            'consumo_janela_sem_consumo', f.consumo_janela,
            'janela_sem_consumo_dias', v_janela_sem_consumo,
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
            'compra_referencia_manual_qtd', f.compra_referencia_manual_qtd,
            'valor_referencia_manual', f.valor_referencia_manual,
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

create or replace function public._inventory_reposicao_calcular(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public._inventory_reposicao_calcular_modo(p_owner_id, null);
end;
$$;

create or replace function public.rpc_inventory_policy_simular_modo(
  p_owner_id uuid,
  p_modo text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual jsonb;
  v_simulado jsonb;
begin
  perform public.forecast_assert_owner_access(p_owner_id);

  if p_modo is null or p_modo not in ('monitorar', 'automatico') then
    raise exception 'Modo invalido. Use monitorar ou automatico.' using errcode = '22023';
  end if;

  v_atual := public._inventory_reposicao_calcular_modo(p_owner_id, null);
  v_simulado := public._inventory_reposicao_calcular_modo(p_owner_id, p_modo);

  return jsonb_build_object(
    'modo_atual', v_atual->>'modo_calculado',
    'modo_simulado', p_modo,
    'calculado_em', v_simulado->'calculado_em',
    'resumo_atual', v_atual->'resumo_reposicao',
    'resumo_simulado', v_simulado->'resumo_reposicao',
    'mudancas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'material_id', s.item->>'material_id',
          'nome', s.item->>'nome',
          'fabricante', s.item->>'fabricante',
          'estoque_atual', s.item->'estoque_atual',
          'minimo_manual', s.item->'minimo_manual',
          'minimo_automatico', s.item->'minimo_automatico',
          'base_calculo', s.item->>'base_calculo',
          'preco_unitario', s.item->'preco_unitario',
          'antes', jsonb_build_object(
            'fonte_regra', a.item->>'fonte_regra',
            'minimo_efetivo', a.item->'minimo_efetivo',
            'maximo_efetivo', a.item->'maximo_efetivo',
            'situacao', a.item->>'situacao',
            'prioridade', a.item->>'prioridade',
            'compra_sugerida_qtd', a.item->'compra_sugerida_qtd',
            'valor_compra_sugerida', a.item->'valor_compra_sugerida'
          ),
          'depois', jsonb_build_object(
            'fonte_regra', s.item->>'fonte_regra',
            'minimo_efetivo', s.item->'minimo_efetivo',
            'maximo_efetivo', s.item->'maximo_efetivo',
            'situacao', s.item->>'situacao',
            'prioridade', s.item->>'prioridade',
            'compra_sugerida_qtd', s.item->'compra_sugerida_qtd',
            'valor_compra_sugerida', s.item->'valor_compra_sugerida'
          ),
          'diferenca_valor', round(
            coalesce((s.item->>'valor_compra_sugerida')::numeric, 0)
            - coalesce((a.item->>'valor_compra_sugerida')::numeric, 0), 2)
        )
        order by abs(
          coalesce((s.item->>'valor_compra_sugerida')::numeric, 0)
          - coalesce((a.item->>'valor_compra_sugerida')::numeric, 0)
        ) desc, s.item->>'nome'
      )
      from jsonb_array_elements(v_simulado->'itens') as s(item)
      join jsonb_array_elements(v_atual->'itens') as a(item)
        on a.item->>'material_id' = s.item->>'material_id'
      where (a.item->'minimo_efetivo') is distinct from (s.item->'minimo_efetivo')
         or (a.item->'maximo_efetivo') is distinct from (s.item->'maximo_efetivo')
         or (a.item->>'situacao') is distinct from (s.item->>'situacao')
         or (a.item->'compra_sugerida_qtd') is distinct from (s.item->'compra_sugerida_qtd')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.rpc_inventory_policy_update(
  p_owner_id uuid,
  p_payload jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_atual jsonb;
  v_modo text;
  v_cob_min numeric;
  v_cob_alvo numeric;
  v_cob_excesso numeric;
  v_validade integer;
  v_divergencia numeric;
  v_janela integer;
begin
  perform public.inventory_policy_assert_manage(p_owner_id);

  if nullif(btrim(coalesce(p_motivo, '')), '') is null or length(btrim(p_motivo)) < 3 then
    raise exception 'Informe o motivo da alteracao da politica.' using errcode = '22023';
  end if;

  v_atual := public.inventory_policy_effective(p_owner_id);
  p_payload := coalesce(p_payload, '{}'::jsonb);

  v_modo := coalesce(nullif(btrim(p_payload->>'modo'), ''), v_atual->>'modo');
  v_cob_min := coalesce((p_payload->>'cobertura_minima_meses')::numeric, (v_atual->>'cobertura_minima_meses')::numeric);
  v_cob_alvo := coalesce((p_payload->>'cobertura_alvo_meses')::numeric, (v_atual->>'cobertura_alvo_meses')::numeric);
  v_cob_excesso := coalesce((p_payload->>'cobertura_excesso_meses')::numeric, (v_atual->>'cobertura_excesso_meses')::numeric);
  v_validade := coalesce((p_payload->>'override_validade_dias')::integer, (v_atual->>'override_validade_dias')::integer);
  v_divergencia := coalesce((p_payload->>'divergencia_tolerancia_pct')::numeric, (v_atual->>'divergencia_tolerancia_pct')::numeric);
  v_janela := coalesce((p_payload->>'janela_sem_consumo_dias')::integer, (v_atual->>'janela_sem_consumo_dias')::integer);

  if v_modo not in ('monitorar', 'automatico') then
    raise exception 'Modo invalido. Use monitorar ou automatico.' using errcode = '22023';
  end if;

  insert into public.inventory_policy as p (
    account_owner_id, modo, cobertura_minima_meses, cobertura_alvo_meses, cobertura_excesso_meses,
    override_validade_dias, divergencia_tolerancia_pct, janela_sem_consumo_dias, versao, motivo_alteracao, updated_at, updated_by
  ) values (
    p_owner_id, v_modo, v_cob_min, v_cob_alvo, v_cob_excesso,
    v_validade, v_divergencia, v_janela, 1, btrim(p_motivo), now(), auth.uid()
  )
  on conflict (account_owner_id) do update
  set modo = excluded.modo,
      cobertura_minima_meses = excluded.cobertura_minima_meses,
      cobertura_alvo_meses = excluded.cobertura_alvo_meses,
      cobertura_excesso_meses = excluded.cobertura_excesso_meses,
      override_validade_dias = excluded.override_validade_dias,
      divergencia_tolerancia_pct = excluded.divergencia_tolerancia_pct,
      janela_sem_consumo_dias = excluded.janela_sem_consumo_dias,
      versao = p.versao + 1,
      motivo_alteracao = excluded.motivo_alteracao,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return public.rpc_inventory_policy_get(p_owner_id);
end;
$$;

create or replace function public.rpc_inventory_policy_get(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pode_editar boolean;
begin
  perform public.forecast_assert_owner_access(p_owner_id);

  v_pode_editar := coalesce(auth.role(), '') = 'service_role'
    or public.is_master()
    or public.has_permission('estoque.politica.manage'::text);

  return public.inventory_policy_effective(p_owner_id)
    || jsonb_build_object(
      'pode_editar', v_pode_editar,
      'modo_automatico_liberado', true
    );
end;
$$;

revoke all on function public._inventory_reposicao_calcular_modo(uuid, text) from public, anon, authenticated;
grant execute on function public._inventory_reposicao_calcular_modo(uuid, text) to service_role;
revoke all on function public._inventory_reposicao_calcular(uuid) from public, anon, authenticated;
grant execute on function public._inventory_reposicao_calcular(uuid) to service_role;
revoke all on function public.rpc_inventory_policy_simular_modo(uuid, text) from public, anon;
grant execute on function public.rpc_inventory_policy_simular_modo(uuid, text) to authenticated, service_role;
revoke all on function public.rpc_inventory_policy_update(uuid, jsonb, text) from public, anon;
grant execute on function public.rpc_inventory_policy_update(uuid, jsonb, text) to authenticated, service_role;
revoke all on function public.rpc_inventory_policy_get(uuid) from public, anon;
grant execute on function public.rpc_inventory_policy_get(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
