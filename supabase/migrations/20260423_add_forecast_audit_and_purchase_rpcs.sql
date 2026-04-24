-- Etapas 2 e 3 do forecast:
-- 1) Auditoria real do snapshot selecionado (previsto x realizado).
-- 2) Planejamento de compra com regra de estoque/minimo/cobertura.

create or replace function public.rpc_previsao_gasto_mensal_auditar(
  p_owner_id uuid,
  p_forecast_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forecast_id uuid;
  v_base_inicio date;
  v_base_fim date;
  v_created_at timestamptz;
begin
  select
    id,
    periodo_base_inicio,
    periodo_base_fim,
    created_at
  into
    v_forecast_id,
    v_base_inicio,
    v_base_fim,
    v_created_at
  from public.inventory_forecast
  where account_owner_id = p_owner_id
    and (p_forecast_id is null or id = p_forecast_id)
  order by
    case when id = p_forecast_id then 0 else 1 end,
    created_at desc
  limit 1;

  if v_forecast_id is null then
    return jsonb_build_object(
      'status', 'missing',
      'forecast_id', null,
      'resumo', jsonb_build_object(
        'meses_total', 0,
        'meses_realizados', 0,
        'meses_pendentes', 0
      ),
      'serie', '[]'::jsonb
    );
  end if;

  return (
    with ultimo_realizado as (
      select max(ano_mes) as ano_mes
      from public.agg_gasto_mensal
      where account_owner_id = p_owner_id
    ),
    comparativo as (
      select
        p.ano_mes,
        to_char(p.ano_mes, 'MM/YYYY') as label,
        round(coalesce(p.valor_previsto, 0)::numeric, 2) as valor_previsto,
        round(coalesce(p.valor_previsto_entrada, 0)::numeric, 2) as valor_previsto_entrada,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round(coalesce(a.valor_saida, 0)::numeric, 2)
          else null
        end as valor_realizado,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round((coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0))::numeric, 2)
          else null
        end as vies,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then round(abs(coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0))::numeric, 2)
          else null
        end as erro_absoluto,
        case
          when ur.ano_mes is not null
            and p.ano_mes <= ur.ano_mes
            and coalesce(a.valor_saida, 0) > 0
            then round((((coalesce(p.valor_previsto, 0) - coalesce(a.valor_saida, 0)) / a.valor_saida) * 100)::numeric, 2)
          else null
        end as erro_percentual,
        case
          when ur.ano_mes is not null and p.ano_mes <= ur.ano_mes then 'realizado'
          else 'pendente'
        end as status
      from public.f_previsao_gasto_mensal p
      cross join ultimo_realizado ur
      left join public.agg_gasto_mensal a
        on a.account_owner_id = p_owner_id
       and a.ano_mes = p.ano_mes
      where p.account_owner_id = p_owner_id
        and p.inventory_forecast_id = v_forecast_id
        and p.cenario = 'base'
      order by p.ano_mes
    ),
    resumo as (
      select
        count(*) as meses_total,
        count(*) filter (where status = 'realizado') as meses_realizados,
        count(*) filter (where status = 'pendente') as meses_pendentes,
        round(coalesce(sum(valor_previsto) filter (where status = 'realizado'), 0)::numeric, 2) as total_previsto_realizado,
        round(coalesce(sum(valor_realizado), 0)::numeric, 2) as total_realizado,
        round(coalesce(sum(vies), 0)::numeric, 2) as vies_total,
        round(coalesce(sum(erro_absoluto), 0)::numeric, 2) as erro_absoluto_total,
        case
          when coalesce(sum(valor_realizado), 0) > 0
            then round(((sum(vies) / sum(valor_realizado)) * 100)::numeric, 2)
          else null
        end as vies_percentual,
        case
          when coalesce(sum(valor_realizado), 0) > 0
            then round(((sum(erro_absoluto) / sum(valor_realizado)) * 100)::numeric, 2)
          else null
        end as wape_percentual,
        case
          when count(*) filter (where status = 'realizado' and coalesce(valor_realizado, 0) > 0) > 0
            then round(
              coalesce(avg(abs(erro_percentual)) filter (where status = 'realizado' and coalesce(valor_realizado, 0) > 0), 0)::numeric,
              2
            )
          else null
        end as mape_percentual
      from comparativo
    )
    select jsonb_build_object(
      'status', 'ok',
      'forecast_id', v_forecast_id,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim,
      'created_at', v_created_at,
      'resumo', jsonb_build_object(
        'meses_total', r.meses_total,
        'meses_realizados', r.meses_realizados,
        'meses_pendentes', r.meses_pendentes,
        'total_previsto_realizado', r.total_previsto_realizado,
        'total_realizado', r.total_realizado,
        'vies_total', r.vies_total,
        'erro_absoluto_total', r.erro_absoluto_total,
        'vies_percentual', r.vies_percentual,
        'wape_percentual', r.wape_percentual,
        'mape_percentual', r.mape_percentual,
        'acuracia_wape', greatest(0, round((100 - coalesce(r.wape_percentual, 100))::numeric, 2)),
        'acuracia_mape', greatest(0, round((100 - coalesce(r.mape_percentual, 100))::numeric, 2))
      ),
      'serie', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'ano_mes', c.ano_mes,
            'label', c.label,
            'valor_previsto', c.valor_previsto,
            'valor_previsto_entrada', c.valor_previsto_entrada,
            'valor_realizado', c.valor_realizado,
            'vies', c.vies,
            'erro_absoluto', c.erro_absoluto,
            'erro_percentual', c.erro_percentual,
            'status', c.status
          ) order by c.ano_mes
        )
        from comparativo c
      ), '[]'::jsonb)
    )
    from resumo r
  );
end;
$$;

create or replace function public.rpc_previsao_compra_sugerida(
  p_owner_id uuid,
  p_forecast_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forecast_id uuid;
  v_prev_entrada numeric := 0;
  v_prev_saida numeric := 0;
  v_prev_saldo numeric := 0;
begin
  select
    id,
    coalesce(previsao_anual_entrada, 0),
    coalesce(previsao_anual_saida, 0),
    coalesce(previsao_anual_saldo, 0)
  into
    v_forecast_id,
    v_prev_entrada,
    v_prev_saida,
    v_prev_saldo
  from public.inventory_forecast
  where account_owner_id = p_owner_id
    and (p_forecast_id is null or id = p_forecast_id)
  order by
    case when id = p_forecast_id then 0 else 1 end,
    created_at desc
  limit 1;

  return (
    with entradas_saldo as (
      select
        e."materialId"::text as material_id,
        sum(e.quantidade)::numeric as quantidade
      from public.entradas e
      left join public.status_entrada se on se.id = e.status
      where e.account_owner_id = p_owner_id
        and coalesce(lower(se.status), lower(coalesce(e.status::text, ''))) <> 'cancelado'
      group by e."materialId"
    ),
    saidas_saldo as (
      select
        s."materialId"::text as material_id,
        sum(s.quantidade)::numeric as quantidade
      from public.saidas s
      left join public.status_saida ss on ss.id = s.status
      where s.account_owner_id = p_owner_id
        and coalesce(lower(ss.status), lower(coalesce(s.status::text, ''))) <> 'cancelado'
      group by s."materialId"
    ),
    saidas_90d as (
      select
        s."materialId"::text as material_id,
        sum(s.quantidade)::numeric as quantidade
      from public.saidas s
      left join public.status_saida ss on ss.id = s.status
      where s.account_owner_id = p_owner_id
        and coalesce(lower(ss.status), lower(coalesce(s.status::text, ''))) <> 'cancelado'
        and s."dataEntrega" >= (current_date - interval '90 days')
      group by s."materialId"
    ),
    saidas_180d as (
      select
        s."materialId"::text as material_id,
        sum(s.quantidade)::numeric as quantidade
      from public.saidas s
      left join public.status_saida ss on ss.id = s.status
      where s.account_owner_id = p_owner_id
        and coalesce(lower(ss.status), lower(coalesce(s.status::text, ''))) <> 'cancelado'
        and s."dataEntrega" >= (current_date - interval '180 days')
      group by s."materialId"
    ),
    base as (
      select
        m.id as material_id,
        m.nome,
        round(coalesce(m."valorUnitario", 0)::numeric, 2) as valor_unitario,
        coalesce(m."estoqueMinimo", 0)::numeric as estoque_minimo,
        coalesce(es.quantidade, 0) - coalesce(ss.quantidade, 0) as estoque_atual,
        coalesce(s90.quantidade, 0) as qtd_saida_90d,
        coalesce(s180.quantidade, 0) as qtd_saida_180d,
        case
          when coalesce(s90.quantidade, 0) > 0 then round((s90.quantidade / 3.0)::numeric, 2)
          when coalesce(s180.quantidade, 0) > 0 then round((s180.quantidade / 6.0)::numeric, 2)
          else 0
        end as consumo_medio_mensal
      from public.materiais m
      left join entradas_saldo es on es.material_id = m.id::text
      left join saidas_saldo ss on ss.material_id = m.id::text
      left join saidas_90d s90 on s90.material_id = m.id::text
      left join saidas_180d s180 on s180.material_id = m.id::text
      where m.account_owner_id = p_owner_id
        and coalesce(m.ativo, true) = true
    ),
    enriquecido as (
      select
        b.*,
        case
          when b.consumo_medio_mensal > 0 then round((b.estoque_atual / b.consumo_medio_mensal)::numeric, 2)
          else null
        end as cobertura_meses,
        greatest(
          b.estoque_minimo,
          ceil(greatest(b.consumo_medio_mensal, 0) * 2.0)
        )::numeric as estoque_alvo,
        greatest(b.estoque_minimo - b.estoque_atual, 0)::numeric as compra_minima_qtd
      from base b
    ),
    classificado as (
      select
        e.*,
        greatest(e.estoque_alvo - e.estoque_atual, 0)::numeric as compra_sugerida_qtd,
        round((e.compra_minima_qtd * e.valor_unitario)::numeric, 2) as valor_compra_minima,
        round((greatest(e.estoque_alvo - e.estoque_atual, 0) * e.valor_unitario)::numeric, 2) as valor_compra_sugerida,
        case
          when e.estoque_atual < e.estoque_minimo or (e.cobertura_meses is not null and e.cobertura_meses < 1) then 'imediata'
          when greatest(e.estoque_alvo - e.estoque_atual, 0) > 0 or (e.cobertura_meses is not null and e.cobertura_meses < 2) then 'planejada'
          else 'ok'
        end as prioridade,
        case
          when (e.consumo_medio_mensal = 0 and e.estoque_atual > greatest(e.estoque_minimo * 2, 1))
            or (e.cobertura_meses is not null and e.cobertura_meses > 6 and e.estoque_atual > e.estoque_minimo)
            then true
          else false
        end as excesso_flag
      from enriquecido e
    ),
    resumo as (
      select
        count(*) as materiais_monitorados,
        count(*) filter (where estoque_atual < estoque_minimo) as itens_abaixo_minimo,
        count(*) filter (where prioridade = 'imediata') as itens_compra_imediata,
        count(*) filter (where prioridade = 'planejada') as itens_reposicao_planejada,
        count(*) filter (where cobertura_meses is not null and cobertura_meses < 1) as itens_cobertura_curta,
        count(*) filter (where excesso_flag) as itens_excesso,
        round(coalesce(sum(compra_minima_qtd), 0)::numeric, 2) as quantidade_compra_minima,
        round(coalesce(sum(valor_compra_minima), 0)::numeric, 2) as valor_compra_minima,
        round(coalesce(sum(compra_sugerida_qtd), 0)::numeric, 2) as quantidade_compra_sugerida,
        round(coalesce(sum(valor_compra_sugerida), 0)::numeric, 2) as valor_compra_sugerida,
        round(coalesce(avg(cobertura_meses), 0)::numeric, 2) as cobertura_media_meses
      from classificado
    )
    select jsonb_build_object(
      'status', 'ok',
      'forecast_id', v_forecast_id,
      'resumo', jsonb_build_object(
        'materiais_monitorados', r.materiais_monitorados,
        'itens_abaixo_minimo', r.itens_abaixo_minimo,
        'itens_compra_imediata', r.itens_compra_imediata,
        'itens_reposicao_planejada', r.itens_reposicao_planejada,
        'itens_cobertura_curta', r.itens_cobertura_curta,
        'itens_excesso', r.itens_excesso,
        'quantidade_compra_minima', r.quantidade_compra_minima,
        'valor_compra_minima', r.valor_compra_minima,
        'quantidade_compra_sugerida', r.quantidade_compra_sugerida,
        'valor_compra_sugerida', r.valor_compra_sugerida,
        'cobertura_media_meses', r.cobertura_media_meses,
        'saida_media_mensal_prevista', round((coalesce(v_prev_saida, 0) / 12.0)::numeric, 2),
        'entrada_media_mensal_prevista', round((coalesce(v_prev_entrada, 0) / 12.0)::numeric, 2),
        'saldo_anual_previsto', round(coalesce(v_prev_saldo, 0)::numeric, 2)
      ),
      'compra_imediata', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'material_id', q.material_id,
            'nome', q.nome,
            'estoque_atual', q.estoque_atual,
            'estoque_minimo', q.estoque_minimo,
            'estoque_alvo', q.estoque_alvo,
            'consumo_medio_mensal', q.consumo_medio_mensal,
            'cobertura_meses', q.cobertura_meses,
            'compra_minima_qtd', q.compra_minima_qtd,
            'compra_sugerida_qtd', q.compra_sugerida_qtd,
            'valor_compra_minima', q.valor_compra_minima,
            'valor_compra_sugerida', q.valor_compra_sugerida,
            'valor_unitario', q.valor_unitario
          )
        )
        from (
          select *
          from classificado
          where prioridade = 'imediata'
          order by valor_compra_sugerida desc, cobertura_meses asc nulls first, nome
          limit 5
        ) q
      ), '[]'::jsonb),
      'reposicao_planejada', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'material_id', q.material_id,
            'nome', q.nome,
            'estoque_atual', q.estoque_atual,
            'estoque_minimo', q.estoque_minimo,
            'estoque_alvo', q.estoque_alvo,
            'consumo_medio_mensal', q.consumo_medio_mensal,
            'cobertura_meses', q.cobertura_meses,
            'compra_sugerida_qtd', q.compra_sugerida_qtd,
            'valor_compra_sugerida', q.valor_compra_sugerida,
            'valor_unitario', q.valor_unitario
          )
        )
        from (
          select *
          from classificado
          where prioridade = 'planejada'
          order by valor_compra_sugerida desc, cobertura_meses asc nulls first, nome
          limit 5
        ) q
      ), '[]'::jsonb),
      'cobertura_curta', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'material_id', q.material_id,
            'nome', q.nome,
            'estoque_atual', q.estoque_atual,
            'estoque_minimo', q.estoque_minimo,
            'consumo_medio_mensal', q.consumo_medio_mensal,
            'cobertura_meses', q.cobertura_meses,
            'compra_sugerida_qtd', q.compra_sugerida_qtd,
            'valor_compra_sugerida', q.valor_compra_sugerida
          )
        )
        from (
          select *
          from classificado
          where cobertura_meses is not null
            and cobertura_meses < 1
          order by cobertura_meses asc, valor_compra_sugerida desc, nome
          limit 5
        ) q
      ), '[]'::jsonb),
      'excesso_ou_baixo_giro', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'material_id', q.material_id,
            'nome', q.nome,
            'estoque_atual', q.estoque_atual,
            'estoque_minimo', q.estoque_minimo,
            'estoque_alvo', q.estoque_alvo,
            'consumo_medio_mensal', q.consumo_medio_mensal,
            'cobertura_meses', q.cobertura_meses,
            'valor_unitario', q.valor_unitario
          )
        )
        from (
          select *
          from classificado
          where excesso_flag
          order by cobertura_meses desc nulls last, estoque_atual desc, nome
          limit 5
        ) q
      ), '[]'::jsonb)
    )
    from resumo r
  );
end;
$$;
