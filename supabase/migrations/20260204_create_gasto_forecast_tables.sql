-- Cria tabelas de agregado mensal e previsao mensal de gasto.

create table if not exists public.agg_gasto_mensal (
  id uuid not null default gen_random_uuid(),
  account_owner_id uuid not null default public.my_owner_id(),
  ano_mes date not null,
  valor_saida numeric(14, 2) not null default 0,
  valor_entrada numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agg_gasto_mensal_pkey primary key (id),
  constraint agg_gasto_mensal_owner_mes_unique unique (account_owner_id, ano_mes)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agg_gasto_mensal_owner_fkey'
  ) then
    alter table public.agg_gasto_mensal
      add constraint agg_gasto_mensal_owner_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;
end
$$;

create index if not exists agg_gasto_mensal_owner_mes_idx
  on public.agg_gasto_mensal (account_owner_id, ano_mes);

alter table if exists public.agg_gasto_mensal enable row level security;
alter table if exists public.agg_gasto_mensal force row level security;

drop policy if exists agg_gasto_mensal_select_owner on public.agg_gasto_mensal;
create policy agg_gasto_mensal_select_owner
  on public.agg_gasto_mensal
  for select
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists agg_gasto_mensal_insert_owner on public.agg_gasto_mensal;
create policy agg_gasto_mensal_insert_owner
  on public.agg_gasto_mensal
  for insert
  to authenticated
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists agg_gasto_mensal_update_owner on public.agg_gasto_mensal;
create policy agg_gasto_mensal_update_owner
  on public.agg_gasto_mensal
  for update
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  )
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

create table if not exists public.f_previsao_gasto_mensal (
  id uuid not null default gen_random_uuid(),
  account_owner_id uuid not null default public.my_owner_id(),
  ano_mes date not null,
  valor_previsto numeric(14, 2) not null default 0,
  metodo text not null default 'media_movel_12',
  cenario text not null default 'base',
  fator_tendencia numeric(10, 4) not null default 1,
  created_at timestamptz not null default now(),
  constraint f_previsao_gasto_mensal_pkey primary key (id),
  constraint f_previsao_gasto_mensal_owner_mes_unique unique (account_owner_id, ano_mes, cenario)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'f_previsao_gasto_mensal_owner_fkey'
  ) then
    alter table public.f_previsao_gasto_mensal
      add constraint f_previsao_gasto_mensal_owner_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;
end
$$;

create index if not exists f_previsao_gasto_mensal_owner_mes_idx
  on public.f_previsao_gasto_mensal (account_owner_id, ano_mes, cenario);

alter table if exists public.f_previsao_gasto_mensal enable row level security;
alter table if exists public.f_previsao_gasto_mensal force row level security;

drop policy if exists f_previsao_gasto_mensal_select_owner on public.f_previsao_gasto_mensal;
create policy f_previsao_gasto_mensal_select_owner
  on public.f_previsao_gasto_mensal
  for select
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists f_previsao_gasto_mensal_insert_owner on public.f_previsao_gasto_mensal;
create policy f_previsao_gasto_mensal_insert_owner
  on public.f_previsao_gasto_mensal
  for insert
  to authenticated
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

drop policy if exists f_previsao_gasto_mensal_update_owner on public.f_previsao_gasto_mensal;
create policy f_previsao_gasto_mensal_update_owner
  on public.f_previsao_gasto_mensal
  for update
  to authenticated
  using (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  )
  with check (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (
      public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.dashboard'::text)
    )
  );

create or replace function public.rpc_refresh_gasto_mensal(p_owner_id uuid)
returns void
language plpgsql
as $$
declare
  v_min_date date;
  v_max_date date;
begin
  select min(data) into v_min_date
  from (
    select min(data_entrada)::date as data from public.entradas where account_owner_id = p_owner_id
    union all
    select min(data_entrega)::date from public.saidas where account_owner_id = p_owner_id
  ) datas;

  if v_min_date is null then
    return;
  end if;

  v_max_date := (date_trunc('month', now()) - interval '1 day')::date;

  with meses as (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(date_trunc('month', v_min_date)::date, date_trunc('month', v_max_date)::date, interval '1 month') gs
  ),
  saidas as (
    select date_trunc('month', s.data_entrega)::date as ano_mes,
           sum(s.quantidade * m.valor_unitario) as valor_saida
    from public.saidas s
    join public.materiais m on m.id = s.material_id
    where s.account_owner_id = p_owner_id
      and coalesce(s.status, '') <> 'cancelado'
    group by 1
  ),
  entradas as (
    select date_trunc('month', e.data_entrada)::date as ano_mes,
           sum(e.quantidade * m.valor_unitario) as valor_entrada
    from public.entradas e
    join public.materiais m on m.id = e.material_id
    where e.account_owner_id = p_owner_id
    group by 1
  )
  insert into public.agg_gasto_mensal (account_owner_id, ano_mes, valor_saida, valor_entrada, created_at, updated_at)
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

create or replace function public.rpc_previsao_gasto_mensal_consultar(p_owner_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_base_fim date := (date_trunc('month', now()) - interval '1 day')::date;
  v_base_inicio date := (date_trunc('month', v_base_fim) - interval '11 months')::date;
  v_prev_inicio date := (date_trunc('month', v_base_fim) + interval '1 month')::date;
  v_prev_fim date := (date_trunc('month', v_prev_inicio) + interval '11 months')::date;
  v_meses int := 0;
  v_total numeric := 0;
  v_media numeric := 0;
  v_prev_year_total numeric := 0;
  v_variacao numeric := null;
  v_prev_total numeric := 0;
  v_fator numeric := null;
  v_metodo text := null;
begin
  perform public.rpc_refresh_gasto_mensal(p_owner_id);

  select count(*) into v_meses
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim
    and (valor_saida > 0 or valor_entrada > 0);

  if v_meses < 12 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsAvailable', v_meses,
      'requiredMonths', 12,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim
    );
  end if;

  select coalesce(sum(valor_saida), 0), coalesce(avg(valor_saida), 0)
    into v_total, v_media
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim;

  select coalesce(sum(valor_saida), 0)
    into v_prev_year_total
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between (v_base_inicio - interval '12 months')::date and (v_base_fim - interval '12 months')::date;

  if v_prev_year_total > 0 then
    v_variacao := round(((v_total - v_prev_year_total) / v_prev_year_total) * 100, 2);
  end if;

  select coalesce(sum(valor_previsto), 0),
         avg(fator_tendencia),
         max(metodo)
    into v_prev_total, v_fator, v_metodo
  from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and cenario = 'base'
    and ano_mes between v_prev_inicio and v_prev_fim;

  if v_prev_total = 0 then
    return jsonb_build_object(
      'status', 'missing',
      'resumo', jsonb_build_object(
        'periodo_base_inicio', v_base_inicio,
        'periodo_base_fim', v_base_fim,
        'qtd_meses_base', 12,
        'gasto_total_periodo', v_total,
        'media_mensal', round(v_media, 2),
        'variacao_percentual', v_variacao,
        'gasto_ano_anterior', v_prev_year_total
      ),
      'historico', (
        select jsonb_agg(
          jsonb_build_object(
            'ano_mes', ano_mes,
            'label', to_char(ano_mes, 'MM/YYYY'),
            'valor_saida', valor_saida,
            'valor_entrada', valor_entrada,
            'media_movel', media_movel
          ) order by ano_mes
        )
        from (
          select ano_mes,
                 valor_saida,
                 valor_entrada,
                 round(avg(valor_saida) over (order by ano_mes rows between 2 preceding and current row), 2) as media_movel
          from public.agg_gasto_mensal
          where account_owner_id = p_owner_id
            and ano_mes between v_base_inicio and v_base_fim
        ) serie
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'resumo', jsonb_build_object(
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim,
      'qtd_meses_base', 12,
      'gasto_total_periodo', v_total,
      'media_mensal', round(v_media, 2),
      'fator_tendencia', v_fator,
      'variacao_percentual', v_variacao,
      'previsao_anual', v_prev_total,
      'gasto_ano_anterior', v_prev_year_total,
      'metodo_previsao', v_metodo
    ),
    'historico', (
      select jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'label', to_char(ano_mes, 'MM/YYYY'),
          'valor_saida', valor_saida,
          'valor_entrada', valor_entrada,
          'media_movel', media_movel
        ) order by ano_mes
      )
      from (
        select ano_mes,
               valor_saida,
               valor_entrada,
               round(avg(valor_saida) over (order by ano_mes rows between 2 preceding and current row), 2) as media_movel
        from public.agg_gasto_mensal
        where account_owner_id = p_owner_id
          and ano_mes between v_base_inicio and v_base_fim
      ) serie
    ),
    'previsao', (
      select jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'label', to_char(ano_mes, 'MM/YYYY'),
          'valor_previsto', valor_previsto,
          'metodo', metodo,
          'cenario', cenario
        ) order by ano_mes
      )
      from public.f_previsao_gasto_mensal
      where account_owner_id = p_owner_id
        and cenario = 'base'
        and ano_mes between v_prev_inicio and v_prev_fim
    )
  );
end;
$$;

create or replace function public.rpc_previsao_gasto_mensal_calcular(p_owner_id uuid, p_fator_tendencia numeric default null)
returns jsonb
language plpgsql
as $$
declare
  v_base_fim date := (date_trunc('month', now()) - interval '1 day')::date;
  v_base_inicio date := (date_trunc('month', v_base_fim) - interval '11 months')::date;
  v_prev_inicio date := (date_trunc('month', v_base_fim) + interval '1 month')::date;
  v_prev_fim date := (date_trunc('month', v_prev_inicio) + interval '11 months')::date;
  v_meses int := 0;
  v_media numeric := 0;
  v_fator numeric := 1;
  v_media_ultimos3 numeric := 0;
  v_media_prev3 numeric := 0;
  v_delta numeric := 0;
  v_tipo_tendencia text := 'estavel';
  v_metodo text := 'media_simples';
  v_forecast_existente int := 0;
begin
  perform public.rpc_refresh_gasto_mensal(p_owner_id);

  select count(*) into v_meses
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim
    and (valor_saida > 0 or valor_entrada > 0);

  if v_meses < 12 then
    return jsonb_build_object(
      'status', 'insufficient',
      'monthsAvailable', v_meses,
      'requiredMonths', 12,
      'periodo_base_inicio', v_base_inicio,
      'periodo_base_fim', v_base_fim
    );
  end if;

  select count(*) into v_forecast_existente
  from public.f_previsao_gasto_mensal
  where account_owner_id = p_owner_id
    and cenario = 'base'
    and ano_mes between v_prev_inicio and v_prev_fim;

  if v_forecast_existente = 12 then
    return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
  end if;

  select coalesce(avg(valor_saida), 0) into v_media
  from public.agg_gasto_mensal
  where account_owner_id = p_owner_id
    and ano_mes between v_base_inicio and v_base_fim;

  select coalesce(avg(valor_saida), 0) into v_media_ultimos3
  from (
    select valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_base_inicio and v_base_fim
    order by ano_mes desc
    limit 3
  ) serie;

  select coalesce(avg(valor_saida), 0) into v_media_prev3
  from (
    select valor_saida
    from public.agg_gasto_mensal
    where account_owner_id = p_owner_id
      and ano_mes between v_base_inicio and v_base_fim
    order by ano_mes desc
    offset 3
    limit 3
  ) serie;

  if v_media_prev3 > 0 then
    v_delta := (v_media_ultimos3 - v_media_prev3) / v_media_prev3;
  end if;

  if v_delta > 0.05 then
    v_tipo_tendencia := 'subida';
    v_fator := 1.05;
  elsif v_delta < -0.05 then
    v_tipo_tendencia := 'queda';
    v_fator := 0.95;
  end if;

  if p_fator_tendencia is not null and p_fator_tendencia > 0 then
    v_fator := p_fator_tendencia;
  end if;

  if v_fator <> 1 then
    v_metodo := 'ajustada';
  end if;

  insert into public.f_previsao_gasto_mensal
    (account_owner_id, ano_mes, valor_previsto, metodo, cenario, fator_tendencia, created_at)
  select
    p_owner_id,
    meses.ano_mes,
    round(v_media * v_fator, 2),
    v_metodo,
    'base',
    round(v_fator, 4),
    now()
  from (
    select date_trunc('month', gs)::date as ano_mes
    from generate_series(v_prev_inicio, v_prev_fim, interval '1 month') gs
  ) meses
  on conflict (account_owner_id, ano_mes, cenario) do nothing;

  return public.rpc_previsao_gasto_mensal_consultar(p_owner_id);
end;
$$;
