create or replace function public.rpc_refresh_gasto_mensal(p_owner_id uuid)
returns void
language plpgsql
as $$
declare
  v_min_date date;
  v_max_date date;
begin
  select max(data) into v_max_date
  from (
    select max("dataEntrada")::date as data
    from public.entradas
    where account_owner_id = p_owner_id
    union all
    select max("dataEntrega")::date
    from public.saidas
    where account_owner_id = p_owner_id
  ) datas;

  if v_max_date is null then
    return;
  end if;

  v_max_date := date_trunc('month', v_max_date)::date;
  v_min_date := (date_trunc('month', v_max_date) - interval '11 months')::date;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(
      date_trunc('month', v_min_date)::date,
      date_trunc('month', v_max_date)::date,
      interval '1 month'
    ) gs
  ),
  saidas as (
    select date_trunc('month', s."dataEntrega")::date as ano_mes,
           sum(s.quantidade * m."valorUnitario") as valor_saida
    from public.saidas s
    left join public.status_saida ss on ss.id = s.status
    join public.materiais m on m.id = s."materialId"
    where s.account_owner_id = p_owner_id
      and coalesce(lower(ss.status), '') <> 'cancelado'
      and s."dataEntrega"::date between v_min_date and v_max_date
    group by 1
  ),
  entradas as (
    select date_trunc('month', e."dataEntrada")::date as ano_mes,
           sum(e.quantidade * m."valorUnitario") as valor_entrada
    from public.entradas e
    join public.materiais m on m.id = e."materialId"
    where e.account_owner_id = p_owner_id
      and e."dataEntrada"::date between v_min_date and v_max_date
    group by 1
  )
  insert into public.agg_gasto_mensal (
    account_owner_id,
    ano_mes,
    valor_saida,
    valor_entrada,
    created_at,
    updated_at
  )
  select p_owner_id,
         meses.ano_mes,
         coalesce(saidas.valor_saida, 0),
         coalesce(entradas.valor_entrada, 0),
         now(),
         now()
  from meses
  left join saidas on saidas.ano_mes = meses.ano_mes
  left join entradas on entradas.ano_mes = meses.ano_mes
  on conflict (account_owner_id, ano_mes) do update
    set valor_saida = excluded.valor_saida,
        valor_entrada = excluded.valor_entrada,
        updated_at = now();
end;
$$;
