create or replace function public.diagnosticar_estatisticas_mensais(p_owner_id uuid)
returns table (
  mes_ref int,
  mes_nome text,
  registros bigint,
  valores text,
  mediana_calc numeric,
  p75_calc numeric,
  p90_calc numeric,
  recomendacao text
)
language plpgsql
as $$
begin
  return query
  with meses as (
    select generate_series(1, 12) as mes_ref
  ),
  historico as (
    select
      extract(month from ano_mes)::int as mes_ref,
      valor_saida,
      to_char(ano_mes, 'MM/YYYY') as periodo
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and valor_saida > 0
  ),
  agrupado as (
    select
      m.mes_ref,
      to_char(make_date(2024, m.mes_ref, 1), 'TMMonth') as mes_nome,
      count(h.valor_saida) as registros,
      string_agg(h.periodo || ': R$ ' || round(h.valor_saida, 2), ', ' order by h.periodo) as valores,
      array_agg(h.valor_saida order by h.valor_saida) as valores_array
    from meses m
    left join historico h on h.mes_ref = m.mes_ref
    group by m.mes_ref
  ),
  calculado as (
    select
      agrupado.mes_ref,
      agrupado.mes_nome,
      agrupado.registros,
      agrupado.valores,
      case
        when agrupado.registros >= 1 then
          (select percentile_cont(0.5) within group (order by unnest) from unnest(valores_array))
        else 0
      end as mediana_calc,
      case
        when agrupado.registros >= 2 then
          (select percentile_cont(0.75) within group (order by unnest) from unnest(valores_array))
        else 0
      end as p75_calc,
      case
        when agrupado.registros >= 3 then
          (select percentile_cont(0.9) within group (order by unnest) from unnest(valores_array))
        else 0
      end as p90_calc
    from agrupado
  )
  select
    calculado.mes_ref,
    calculado.mes_nome,
    calculado.registros,
    calculado.valores,
    round(calculado.mediana_calc::numeric, 2),
    round(calculado.p75_calc::numeric, 2),
    round(calculado.p90_calc::numeric, 2),
    case
      when calculado.registros = 0 then '❌ Sem dados historicos'
      when calculado.registros = 1 then '⚠️ Apenas 1 registro - usar media'
      when calculado.registros = 2 then '⚠️ Apenas 2 registros - estimar estatisticas'
      when calculado.registros >= 3 then '✅ Dados suficientes'
    end as recomendacao
  from calculado
  order by calculado.mes_ref;
end;
$$;
