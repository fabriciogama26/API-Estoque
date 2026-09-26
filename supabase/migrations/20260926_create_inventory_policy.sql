-- Politica de reposicao por cobertura (entrega 2 do plano 2026-09).
--
-- Cria a politica por tenant, os overrides por material e o historico auditado.
-- Nada aqui altera `materiais.estoqueMinimo`: o minimo cadastrado continua sendo o valor manual.
--
-- Decisoes aplicadas (TASKS.md, 2026-09-26):
--   - modo inicial `monitorar`; o modo `automatico` fica bloqueado nas RPCs ate a entrega 5;
--   - cobertura minima 1 mes, alvo/maximo operacional 2 meses, excesso acima de 6 meses;
--   - override por material com validade padrao de 90 dias, motivo obrigatorio e historico;
--   - quantidades de minimo/maximo sempre inteiras.

-- ---------------------------------------------------------------------------
-- Permissao de gestao da politica
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description)
values ('estoque.politica.manage', 'Gerenciar politica de reposicao de estoque')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'estoque.politica.manage'
where lower(r.name) in ('master', 'admin', 'owner')
on conflict do nothing;

create or replace function public.expand_permission_dependencies(p_permissions text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  with recursive deps(permission_key) as (
    select distinct nullif(btrim(value), '')
    from unnest(coalesce(p_permissions, '{}'::text[])) as value

    union

    select mapping.depends_on
    from deps
    join (
      values
        ('estoque.dashboard', 'estoque.read'),
        ('dashboard_analise_estoque', 'estoque.read'),
        ('estoque.atual', 'estoque.read'),
        ('estoque.entradas', 'estoque.read'),
        ('estoque.saidas', 'estoque.read'),
        ('estoque.saidas', 'pessoas.read'),
        ('estoque.materiais', 'estoque.read'),
        ('estoque.termo', 'estoque.read'),
        ('estoque.termo', 'pessoas.read'),
        ('estoque.relatorio', 'estoque.read'),
        ('estoque.reprocessar', 'estoque.read'),
        ('estoque.politica.manage', 'estoque.read'),
        ('cadastros.pessoas', 'pessoas.read'),
        ('cadastros.pessoas', 'pessoas.write'),
        ('pcsmo.controle_aso', 'pessoas.read'),
        ('pcsmo.controle_aso', 'pessoas.write'),
        ('acidentes.dashboard', 'acidentes.read')
    ) as mapping(permission_key, depends_on)
      on mapping.permission_key = deps.permission_key
    where nullif(btrim(mapping.depends_on), '') is not null
  )
  select coalesce(
    array(
      select distinct permission_key
      from deps
      where permission_key is not null
      order by permission_key
    ),
    '{}'::text[]
  );
$$;

comment on function public.expand_permission_dependencies(text[]) is
  'Expande permissoes de pagina em permissoes base exigidas pela RLS.';

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_policy (
  account_owner_id uuid primary key references public.app_users(id) on delete cascade,
  modo text not null default 'monitorar',
  cobertura_minima_meses numeric(6,2) not null default 1,
  cobertura_alvo_meses numeric(6,2) not null default 2,
  cobertura_excesso_meses numeric(6,2) not null default 6,
  override_validade_dias integer not null default 90,
  divergencia_tolerancia_pct numeric(6,2) not null default 50,
  versao integer not null default 1,
  motivo_alteracao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint inventory_policy_modo_check check (modo in ('monitorar', 'automatico')),
  constraint inventory_policy_cobertura_minima_check check (cobertura_minima_meses > 0),
  constraint inventory_policy_cobertura_alvo_check check (cobertura_alvo_meses >= cobertura_minima_meses),
  constraint inventory_policy_cobertura_excesso_check check (cobertura_excesso_meses >= cobertura_alvo_meses),
  constraint inventory_policy_validade_check check (override_validade_dias between 1 and 3650),
  constraint inventory_policy_divergencia_check check (divergencia_tolerancia_pct > 0)
);

comment on table public.inventory_policy is
  'Politica de reposicao por tenant. Ausencia de linha equivale aos valores padrao.';

create table if not exists public.inventory_material_override (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id) on delete cascade,
  material_id uuid not null references public.materiais(id) on delete cascade,
  minimo integer,
  maximo integer,
  motivo text not null,
  inicio_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  revogado_por uuid,
  motivo_revogacao text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  constraint inventory_material_override_valor_check check (minimo is not null or maximo is not null),
  constraint inventory_material_override_minimo_check check (minimo is null or minimo >= 0),
  constraint inventory_material_override_maximo_check check (maximo is null or maximo >= 0),
  constraint inventory_material_override_faixa_check check (minimo is null or maximo is null or maximo >= minimo),
  constraint inventory_material_override_motivo_check check (length(btrim(motivo)) >= 3),
  constraint inventory_material_override_periodo_check check (expira_em > inicio_em)
);

comment on table public.inventory_material_override is
  'Override de minimo/maximo por material, com motivo e validade. Um unico override nao revogado por material.';

create unique index if not exists inventory_material_override_ativo_uidx
  on public.inventory_material_override (account_owner_id, material_id)
  where revogado_em is null;

create index if not exists inventory_material_override_owner_idx
  on public.inventory_material_override (account_owner_id, expira_em);

create table if not exists public.inventory_policy_history (
  id bigint generated always as identity primary key,
  account_owner_id uuid not null,
  entidade text not null,
  registro_id text not null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  motivo text,
  ator_user_id uuid,
  criado_em timestamptz not null default now(),
  constraint inventory_policy_history_entidade_check check (entidade in ('politica', 'override')),
  constraint inventory_policy_history_acao_check check (acao in ('criado', 'alterado', 'revogado'))
);

create index if not exists inventory_policy_history_owner_idx
  on public.inventory_policy_history (account_owner_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Historico transacional
-- ---------------------------------------------------------------------------

create or replace function public.inventory_policy_history_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_novo jsonb := to_jsonb(new);
  v_antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_entidade text := case when tg_table_name = 'inventory_policy' then 'politica' else 'override' end;
  v_acao text := 'alterado';
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criado';
  elsif v_entidade = 'override'
    and v_antigo->>'revogado_em' is null
    and v_novo->>'revogado_em' is not null then
    v_acao := 'revogado';
  end if;

  if v_entidade = 'politica' then
    v_motivo := v_novo->>'motivo_alteracao';
  elsif v_acao = 'revogado' then
    v_motivo := v_novo->>'motivo_revogacao';
  else
    v_motivo := v_novo->>'motivo';
  end if;

  insert into public.inventory_policy_history (
    account_owner_id, entidade, registro_id, acao, antes, depois, motivo, ator_user_id
  ) values (
    (v_novo->>'account_owner_id')::uuid,
    v_entidade,
    case when v_entidade = 'politica' then v_novo->>'account_owner_id' else v_novo->>'id' end,
    v_acao,
    v_antigo,
    v_novo,
    v_motivo,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists inventory_policy_history_trg on public.inventory_policy;
create trigger inventory_policy_history_trg
  after insert or update on public.inventory_policy
  for each row execute function public.inventory_policy_history_log();

drop trigger if exists inventory_material_override_history_trg on public.inventory_material_override;
create trigger inventory_material_override_history_trg
  after insert or update on public.inventory_material_override
  for each row execute function public.inventory_policy_history_log();

-- Backfill: uma politica padrao por tenant que ja possui materiais.
-- Tenants novos nao precisam de linha: as RPCs aplicam os valores padrao quando ela nao existe.
insert into public.inventory_policy (account_owner_id, motivo_alteracao)
select distinct m.account_owner_id, 'Politica padrao criada na implantacao (modo monitorar).'
from public.materiais m
where m.account_owner_id is not null
  and exists (select 1 from public.app_users u where u.id = m.account_owner_id)
on conflict (account_owner_id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: leitura pelo proprio tenant; escrita somente por RPC
-- ---------------------------------------------------------------------------

alter table public.inventory_policy enable row level security;
alter table public.inventory_material_override enable row level security;
alter table public.inventory_policy_history enable row level security;

drop policy if exists inventory_policy_select_owner on public.inventory_policy;
create policy inventory_policy_select_owner
  on public.inventory_policy
  for select
  to authenticated
  using (
    public.is_master()
    or (account_owner_id = public.my_owner_id() and public.has_permission('estoque.read'::text))
  );

drop policy if exists inventory_material_override_select_owner on public.inventory_material_override;
create policy inventory_material_override_select_owner
  on public.inventory_material_override
  for select
  to authenticated
  using (
    public.is_master()
    or (account_owner_id = public.my_owner_id() and public.has_permission('estoque.read'::text))
  );

drop policy if exists inventory_policy_history_select_owner on public.inventory_policy_history;
create policy inventory_policy_history_select_owner
  on public.inventory_policy_history
  for select
  to authenticated
  using (
    public.is_master()
    or (account_owner_id = public.my_owner_id() and public.has_permission('estoque.read'::text))
  );

revoke all on public.inventory_policy from public, anon, authenticated;
revoke all on public.inventory_material_override from public, anon, authenticated;
revoke all on public.inventory_policy_history from public, anon, authenticated;
grant select on public.inventory_policy to authenticated;
grant select on public.inventory_material_override to authenticated;
grant select on public.inventory_policy_history to authenticated;
grant all on public.inventory_policy to service_role;
grant all on public.inventory_material_override to service_role;
grant all on public.inventory_policy_history to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Politica efetiva do tenant (linha gravada ou valores padrao).
create or replace function public.inventory_policy_effective(p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.inventory_policy%rowtype;
  v_found boolean;
begin
  select * into v_row from public.inventory_policy where account_owner_id = p_owner_id;
  v_found := found;

  return jsonb_build_object(
    'account_owner_id', p_owner_id,
    'configurada', v_found,
    'modo', coalesce(v_row.modo, 'monitorar'),
    'cobertura_minima_meses', coalesce(v_row.cobertura_minima_meses, 1),
    'cobertura_alvo_meses', coalesce(v_row.cobertura_alvo_meses, 2),
    'cobertura_excesso_meses', coalesce(v_row.cobertura_excesso_meses, 6),
    'override_validade_dias', coalesce(v_row.override_validade_dias, 90),
    'divergencia_tolerancia_pct', coalesce(v_row.divergencia_tolerancia_pct, 50),
    'versao', coalesce(v_row.versao, 0),
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

revoke all on function public.inventory_policy_effective(uuid) from public, anon, authenticated;
grant execute on function public.inventory_policy_effective(uuid) to service_role;

-- Leitura: mesmo tenant da sessao (ou master/service_role).
-- Escrita: alem disso, exige `estoque.politica.manage`.
create or replace function public.inventory_policy_assert_manage(p_owner_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.forecast_assert_owner_access(p_owner_id);

  if coalesce(auth.role(), '') = 'service_role' or public.is_master() then
    return;
  end if;

  if not public.has_permission('estoque.politica.manage'::text) then
    raise exception 'Sem permissao para alterar a politica de reposicao.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.inventory_policy_assert_manage(uuid) from public, anon;
grant execute on function public.inventory_policy_assert_manage(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPCs de leitura e gestao
-- ---------------------------------------------------------------------------

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
      'modo_automatico_liberado', false
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

  if v_modo not in ('monitorar', 'automatico') then
    raise exception 'Modo invalido. Use monitorar ou automatico.' using errcode = '22023';
  end if;

  -- Entrega 5 do plano libera o modo automatico apos validacao com dados reais.
  if v_modo = 'automatico' then
    raise exception 'O modo automatico ainda nao foi liberado. Mantenha o modo monitorar.' using errcode = '22023';
  end if;

  insert into public.inventory_policy as p (
    account_owner_id, modo, cobertura_minima_meses, cobertura_alvo_meses, cobertura_excesso_meses,
    override_validade_dias, divergencia_tolerancia_pct, versao, motivo_alteracao, updated_at, updated_by
  ) values (
    p_owner_id, v_modo, v_cob_min, v_cob_alvo, v_cob_excesso,
    v_validade, v_divergencia, 1, btrim(p_motivo), now(), auth.uid()
  )
  on conflict (account_owner_id) do update
  set modo = excluded.modo,
      cobertura_minima_meses = excluded.cobertura_minima_meses,
      cobertura_alvo_meses = excluded.cobertura_alvo_meses,
      cobertura_excesso_meses = excluded.cobertura_excesso_meses,
      override_validade_dias = excluded.override_validade_dias,
      divergencia_tolerancia_pct = excluded.divergencia_tolerancia_pct,
      versao = p.versao + 1,
      motivo_alteracao = excluded.motivo_alteracao,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return public.rpc_inventory_policy_get(p_owner_id);
end;
$$;

create or replace function public.rpc_inventory_override_set(
  p_owner_id uuid,
  p_material_id uuid,
  p_minimo integer,
  p_maximo integer,
  p_motivo text,
  p_expira_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_validade integer;
  v_expira timestamptz;
  v_id uuid;
begin
  perform public.inventory_policy_assert_manage(p_owner_id);

  if p_material_id is null then
    raise exception 'Material obrigatorio.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.materiais m
    where m.id = p_material_id
      and m.account_owner_id = p_owner_id
  ) then
    raise exception 'Material nao pertence ao tenant informado.' using errcode = '42501';
  end if;

  if p_minimo is null and p_maximo is null then
    raise exception 'Informe minimo e/ou maximo do override.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null or length(btrim(p_motivo)) < 3 then
    raise exception 'Informe o motivo do override.' using errcode = '22023';
  end if;

  v_validade := (public.inventory_policy_effective(p_owner_id)->>'override_validade_dias')::integer;
  v_expira := coalesce(p_expira_em, now() + make_interval(days => v_validade));

  if v_expira <= now() then
    raise exception 'A validade do override deve ser futura.' using errcode = '22023';
  end if;

  -- Um unico override nao revogado por material: o anterior (ativo ou expirado) e encerrado.
  update public.inventory_material_override
  set revogado_em = now(),
      revogado_por = auth.uid(),
      motivo_revogacao = 'Substituido por novo override: ' || btrim(p_motivo)
  where account_owner_id = p_owner_id
    and material_id = p_material_id
    and revogado_em is null;

  insert into public.inventory_material_override (
    account_owner_id, material_id, minimo, maximo, motivo, inicio_em, expira_em, criado_por
  ) values (
    p_owner_id, p_material_id, p_minimo, p_maximo, btrim(p_motivo), now(), v_expira, auth.uid()
  )
  returning id into v_id;

  return (
    select to_jsonb(o)
    from public.inventory_material_override o
    where o.id = v_id
  );
end;
$$;

create or replace function public.rpc_inventory_override_revoke(
  p_owner_id uuid,
  p_override_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.inventory_policy_assert_manage(p_owner_id);

  if nullif(btrim(coalesce(p_motivo, '')), '') is null or length(btrim(p_motivo)) < 3 then
    raise exception 'Informe o motivo da revogacao.' using errcode = '22023';
  end if;

  update public.inventory_material_override
  set revogado_em = now(),
      revogado_por = auth.uid(),
      motivo_revogacao = btrim(p_motivo)
  where id = p_override_id
    and account_owner_id = p_owner_id
    and revogado_em is null;

  if not found then
    raise exception 'Override nao encontrado ou ja revogado.' using errcode = 'P0002';
  end if;

  return (
    select to_jsonb(o)
    from public.inventory_material_override o
    where o.id = p_override_id
  );
end;
$$;

create or replace function public.rpc_inventory_policy_history(
  p_owner_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.forecast_assert_owner_access(p_owner_id);

  return coalesce((
    select jsonb_agg(to_jsonb(h) order by h.criado_em desc, h.id desc)
    from (
      select *
      from public.inventory_policy_history
      where account_owner_id = p_owner_id
      order by criado_em desc, id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) h
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.rpc_inventory_policy_get(uuid) from public, anon;
revoke all on function public.rpc_inventory_policy_update(uuid, jsonb, text) from public, anon;
revoke all on function public.rpc_inventory_override_set(uuid, uuid, integer, integer, text, timestamptz) from public, anon;
revoke all on function public.rpc_inventory_override_revoke(uuid, uuid, text) from public, anon;
revoke all on function public.rpc_inventory_policy_history(uuid, integer) from public, anon;
grant execute on function public.rpc_inventory_policy_get(uuid) to authenticated, service_role;
grant execute on function public.rpc_inventory_policy_update(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.rpc_inventory_override_set(uuid, uuid, integer, integer, text, timestamptz) to authenticated, service_role;
grant execute on function public.rpc_inventory_override_revoke(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rpc_inventory_policy_history(uuid, integer) to authenticated, service_role;

revoke all on function public.inventory_policy_history_log() from public, anon, authenticated;

notify pgrst, 'reload schema';
