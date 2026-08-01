alter table if exists public.f_previsao_gasto_mensal
  add column if not exists amostras_mes integer not null default 0,
  add column if not exists p75_estatistico numeric(14, 2),
  add column if not exists p90_estatistico numeric(14, 2),
  add column if not exists contingencia_25 numeric(14, 2) not null default 0;

create or replace function public.set_previsao_gasto_stats_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes_ref int;
  v_valores numeric[];
  v_qtd int := 0;
  v_media numeric := 0;
  v_mediana numeric;
  v_p75 numeric;
  v_p90 numeric;
  v_contingencia_base numeric;
begin
  if new.account_owner_id is null or new.ano_mes is null then
    return new;
  end if;

  v_mes_ref := extract(month from new.ano_mes)::int;

  select
    coalesce(array_agg(valor_saida order by valor_saida), array[]::numeric[]),
    count(valor_saida)::int,
    coalesce(avg(valor_saida), 0)
  into v_valores, v_qtd, v_media
  from public.agg_gasto_mensal
  where account_owner_id = new.account_owner_id
    and extract(month from ano_mes)::int = v_mes_ref
    and valor_saida > 0;

  if v_qtd >= 1 then
    select percentile_cont(0.5) within group (order by valor)
      into v_mediana
    from unnest(v_valores) as t(valor);
  end if;

  if v_qtd >= 4 then
    select percentile_cont(0.75) within group (order by valor)
      into v_p75
    from unnest(v_valores) as t(valor);
  end if;

  if v_qtd >= 5 then
    select percentile_cont(0.9) within group (order by valor)
      into v_p90
    from unnest(v_valores) as t(valor);
  end if;

  v_contingencia_base := coalesce(v_mediana, v_media, new.valor_previsto, 0);

  new.amostras_mes := v_qtd;
  new.p75_estatistico := case when v_p75 is null then null else round(v_p75, 2) end;
  new.p90_estatistico := case when v_p90 is null then null else round(v_p90, 2) end;
  new.contingencia_25 := round(v_contingencia_base * 1.25, 2);

  return new;
end;
$$;

drop trigger if exists trg_set_previsao_gasto_stats_metadata on public.f_previsao_gasto_mensal;

create trigger trg_set_previsao_gasto_stats_metadata
before insert or update of account_owner_id, ano_mes, valor_previsto, mediana, contingencia_p75, p90
on public.f_previsao_gasto_mensal
for each row
execute function public.set_previsao_gasto_stats_metadata();

update public.f_previsao_gasto_mensal
set valor_previsto = valor_previsto;

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
security definer
set search_path = public
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
      coalesce(array_agg(h.valor_saida order by h.valor_saida) filter (where h.valor_saida is not null), array[]::numeric[]) as valores_array
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
          (select percentile_cont(0.5) within group (order by valor) from unnest(valores_array) as t(valor))
        else null
      end as mediana_calc,
      case
        when agrupado.registros >= 4 then
          (select percentile_cont(0.75) within group (order by valor) from unnest(valores_array) as t(valor))
        else null
      end as p75_calc,
      case
        when agrupado.registros >= 5 then
          (select percentile_cont(0.9) within group (order by valor) from unnest(valores_array) as t(valor))
        else null
      end as p90_calc
    from agrupado
  )
  select
    calculado.mes_ref,
    calculado.mes_nome,
    calculado.registros,
    calculado.valores,
    case when calculado.mediana_calc is null then null else round(calculado.mediana_calc::numeric, 2) end,
    case when calculado.p75_calc is null then null else round(calculado.p75_calc::numeric, 2) end,
    case when calculado.p90_calc is null then null else round(calculado.p90_calc::numeric, 2) end,
    case
      when calculado.registros = 0 then 'Sem dados historicos'
      when calculado.registros = 1 then 'Amostra insuficiente para volatilidade e percentis'
      when calculado.registros between 2 and 3 then 'Amostra insuficiente para P75/P90'
      when calculado.registros = 4 then 'P75 calculavel; P90 ainda insuficiente'
      when calculado.registros >= 5 then 'Percentis calculaveis'
    end as recomendacao
  from calculado
  order by calculado.mes_ref;
end;
$$;
