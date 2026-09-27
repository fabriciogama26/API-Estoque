-- Controle de Validades (parte 3/3): funcoes de alerta usadas pela Edge Function `validades-alertas`.
--
-- Regras (TASKS.md, 2026-09-27):
--   - job diario; envio apenas em marcos:
--       janela_critica -> status `proximo_vencimento` (1..janela dias), uma unica vez por vencimento;
--       vencimento     -> status `vence_hoje`; se o job falhar no dia, recupera ate N dias depois
--                         (`alerta_vencimento_tolerancia_dias`, padrao 7) e o e-mail informa "Venceu em";
--   - idempotencia persistente: unique (realizacao_id, tipo_alerta, data_vencimento) em requisitos_alertas_envios;
--   - renovacao cria nova realizacao -> novo ciclo; correcao de data muda o vencimento -> novo ciclo;
--   - somente requisitos exigidos, com realizacao vigente e validade (pendentes nao geram alerta);
--   - todas as funcoes sao restritas ao service_role (nenhum acesso para authenticated/anon).

create or replace function public._validades_alertas_candidatos(p_owner_id uuid)
returns table (
  realizacao_id uuid,
  tipo_alerta text,
  data_vencimento date,
  dias_restantes integer,
  pessoa_nome text,
  matricula text,
  requisito_nome text,
  requisito_codigo text,
  categoria text,
  centro_servico text,
  setor text,
  cargo text,
  janela integer
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  with cfg as (
    select
      coalesce(c.alertas_ativos, true) as alertas_ativos,
      coalesce(c.alerta_janela_ativo, true) as janela_ativo,
      coalesce(c.alerta_vencimento_ativo, true) as vencimento_ativo,
      coalesce(c.alerta_vencimento_tolerancia_dias, 7) as tolerancia
    from (select 1) as unico
    left join public.requisitos_config c on c.account_owner_id = p_owner_id
  )
  select
    b.realizacao_id,
    case when b.status = 'proximo_vencimento' then 'janela_critica' else 'vencimento' end,
    b.data_vencimento,
    b.dias_restantes,
    b.pessoa_nome,
    b.matricula,
    b.requisito_nome,
    b.requisito_codigo,
    b.categoria,
    b.centro_servico,
    b.setor,
    b.cargo,
    b.janela
  from public._validades_base(p_owner_id) b
  cross join cfg
  where cfg.alertas_ativos
    and b.exigencia = 'exigido'
    and b.realizacao_id is not null
    and b.possui_validade
    and (
      (b.status = 'proximo_vencimento' and cfg.janela_ativo)
      or (
        b.status in ('vence_hoje', 'vencido')
        and cfg.vencimento_ativo
        and b.dias_restantes >= -cfg.tolerancia
      )
    );
$$;

comment on function public._validades_alertas_candidatos(uuid) is
  'Eventos de alerta do dia para o tenant, derivados do status unico (validade_status). Nao aplica idempotencia.';

create or replace function public.rpc_validades_alertas_owners()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao restrita a rotina de backend.' using errcode = '42501';
  end if;

  return coalesce((
    select array_agg(distinct r.account_owner_id)
    from public.requisitos_controle r
    join public.app_users u on u.id = r.account_owner_id
    where r.ativo
      and coalesce(u.ativo, true) = true
  ), '{}'::uuid[]);
end;
$$;

-- Reserva (claim) os eventos do dia: novos eventos via insert on conflict do nothing
-- e retentativas de eventos com erro (ate p_max_tentativas) ou presos em processamento ha mais de 1 hora.
-- Duas execucoes concorrentes nunca reservam o mesmo evento.
create or replace function public.rpc_validades_alertas_reservar(
  p_owner_id uuid,
  p_max_tentativas integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_ids uuid[];
  v_max integer := least(greatest(coalesce(p_max_tentativas, 3), 1), 10);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao restrita a rotina de backend.' using errcode = '42501';
  end if;

  with candidatos as materialized (
    select * from public._validades_alertas_candidatos(p_owner_id)
  ),
  novos as (
    insert into public.requisitos_alertas_envios (
      account_owner_id, realizacao_id, tipo_alerta, data_vencimento, dias_restantes, status, tentativas, reservado_em
    )
    select p_owner_id, c.realizacao_id, c.tipo_alerta, c.data_vencimento, c.dias_restantes, 'processando', 0, now()
    from candidatos c
    on conflict (realizacao_id, tipo_alerta, data_vencimento) do nothing
    returning id
  ),
  retentativas as (
    update public.requisitos_alertas_envios e
    set status = 'processando',
        reservado_em = now(),
        dias_restantes = c.dias_restantes,
        erro = null
    from candidatos c
    where e.account_owner_id = p_owner_id
      and e.realizacao_id = c.realizacao_id
      and e.tipo_alerta = c.tipo_alerta
      and e.data_vencimento = c.data_vencimento
      and (
        (e.status = 'erro' and e.tentativas < v_max)
        or (e.status = 'processando' and e.reservado_em < now() - interval '1 hour')
      )
    returning e.id
  )
  select coalesce(array_agg(t.id), '{}'::uuid[])
  into v_ids
  from (
    select id from novos
    union all
    select id from retentativas
  ) t;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'envio_id', e.id,
        'realizacao_id', e.realizacao_id,
        'tipo_alerta', e.tipo_alerta,
        'data_vencimento', e.data_vencimento,
        'dias_restantes', c.dias_restantes,
        'tentativas', e.tentativas,
        'pessoa_nome', c.pessoa_nome,
        'matricula', c.matricula,
        'requisito_nome', c.requisito_nome,
        'requisito_codigo', c.requisito_codigo,
        'categoria', c.categoria,
        'centro_servico', c.centro_servico,
        'setor', c.setor,
        'cargo', c.cargo,
        'janela', c.janela
      )
      order by e.tipo_alerta, abs(c.dias_restantes), lower(c.pessoa_nome), lower(c.requisito_nome)
    )
    from public.requisitos_alertas_envios e
    join public._validades_alertas_candidatos(p_owner_id) c
      on c.realizacao_id = e.realizacao_id
     and c.tipo_alerta = e.tipo_alerta
     and c.data_vencimento = e.data_vencimento
    where e.id = any (v_ids)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.rpc_validades_alertas_finalizar(
  p_owner_id uuid,
  p_envio_ids uuid[],
  p_sucesso boolean,
  p_erro text default null,
  p_lote_id uuid default null,
  p_destinatarios integer default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_total integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao restrita a rotina de backend.' using errcode = '42501';
  end if;

  update public.requisitos_alertas_envios
  set status = case when p_sucesso then 'enviado' else 'erro' end,
      tentativas = tentativas + 1,
      enviado_em = case when p_sucesso then now() else null end,
      erro = case when p_sucesso then null else left(coalesce(p_erro, 'Falha no envio.'), 2000) end,
      lote_id = coalesce(p_lote_id, lote_id),
      destinatarios_total = coalesce(p_destinatarios, destinatarios_total)
  where account_owner_id = p_owner_id
    and id = any (coalesce(p_envio_ids, '{}'::uuid[]))
    and status = 'processando';

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public._validades_alertas_candidatos(uuid) from public, anon, authenticated;
revoke all on function public.rpc_validades_alertas_owners() from public, anon, authenticated;
revoke all on function public.rpc_validades_alertas_reservar(uuid, integer) from public, anon, authenticated;
revoke all on function public.rpc_validades_alertas_finalizar(uuid, uuid[], boolean, text, uuid, integer) from public, anon, authenticated;

grant execute on function public._validades_alertas_candidatos(uuid) to service_role;
grant execute on function public.rpc_validades_alertas_owners() to service_role;
grant execute on function public.rpc_validades_alertas_reservar(uuid, integer) to service_role;
grant execute on function public.rpc_validades_alertas_finalizar(uuid, uuid[], boolean, text, uuid, integer) to service_role;

notify pgrst, 'reload schema';
