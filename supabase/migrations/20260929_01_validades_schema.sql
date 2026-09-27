-- Controle de Validades (parte 1/3): permissoes, tabelas, triggers, RLS e funcoes base.
--
-- Decisoes aplicadas (TASKS.md, 2026-09-27):
--   - requisito esperado vem de regras de aplicabilidade por cargo, setor, centro de servico (unidade),
--     centro de custo ou pessoa; dentro de uma regra as dimensoes combinam com E, regras diferentes com OU;
--   - pendencias NAO sao gravadas: sao calculadas por `_validades_base` a cada consulta;
--   - a realizacao grava snapshot da validade do requisito no momento do registro; o snapshot e imutavel;
--   - vencimento = data de realizacao + N (dias|meses) - 1 dia;
--   - renovacao preserva o registro anterior (status `substituido`) e cria um novo registro vigente;
--   - status centralizado em `validade_status`; janela critica configuravel por tenant (padrao 7 dias);
--   - "hoje" respeita o timezone do tenant (padrao America/Sao_Paulo), nunca `current_date` (UTC);
--   - dispensa individual com motivo obrigatorio e validade opcional;
--   - escrita somente por RPC SECURITY DEFINER; RLS habilitada apenas para SELECT.

-- ---------------------------------------------------------------------------
-- Permissoes
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('validades.read', 'Controle de validades - Ler'),
  ('validades.registrar', 'Controle de validades - Registrar, editar e cancelar realizacao'),
  ('validades.renovar', 'Controle de validades - Renovar realizacao'),
  ('validades.requisitos.manage', 'Requisitos de controle - Gerenciar requisitos, aplicabilidade e dispensas'),
  ('validades.regras.manage', 'Requisitos de controle - Alterar validade, janela critica e alertas'),
  ('pcsmo.controle_validades', 'Controle de Validades'),
  ('pcsmo.requisitos_controle', 'Requisitos de Controle')
on conflict (key) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'validades.read',
  'validades.registrar',
  'validades.renovar',
  'validades.requisitos.manage',
  'validades.regras.manage',
  'pcsmo.controle_validades',
  'pcsmo.requisitos_controle'
)
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
        ('pcsmo.controle_validades', 'validades.read'),
        ('pcsmo.controle_validades', 'pessoas.read'),
        ('pcsmo.requisitos_controle', 'validades.read'),
        ('pcsmo.requisitos_controle', 'validades.requisitos.manage'),
        ('pcsmo.requisitos_controle', 'pessoas.read'),
        ('validades.registrar', 'validades.read'),
        ('validades.renovar', 'validades.read'),
        ('validades.requisitos.manage', 'validades.read'),
        ('validades.regras.manage', 'validades.read'),
        ('validades.regras.manage', 'validades.requisitos.manage'),
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

create table if not exists public.requisitos_controle (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null default public.my_owner_id() references public.app_users(id) on delete cascade,
  nome text not null,
  codigo text,
  categoria text not null default 'treinamento',
  tipo text not null default 'interno',
  descricao text,
  possui_validade boolean not null default true,
  validade_quantidade integer,
  validade_unidade text,
  ativo boolean not null default true,
  observacao text,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  constraint requisitos_controle_owner_id_key unique (account_owner_id, id),
  constraint requisitos_controle_nome_check check (length(btrim(nome)) >= 2),
  constraint requisitos_controle_categoria_check check (
    categoria in ('treinamento', 'certificado', 'documento', 'capacitacao', 'exame', 'outro')
  ),
  constraint requisitos_controle_tipo_check check (tipo in ('legal', 'interno', 'cliente', 'outro')),
  constraint requisitos_controle_validade_check check (
    (
      possui_validade
      and validade_quantidade between 1 and 36500
      and validade_unidade in ('dias', 'meses')
    )
    or (
      not possui_validade
      and validade_quantidade is null
      and validade_unidade is null
    )
  )
);

comment on table public.requisitos_controle is
  'Catalogo de requisitos com validade por tenant (treinamentos, certificados, documentos, capacitacoes, exames).';

create unique index if not exists requisitos_controle_owner_nome_uidx
  on public.requisitos_controle (account_owner_id, lower(btrim(nome)));

create unique index if not exists requisitos_controle_owner_codigo_uidx
  on public.requisitos_controle (account_owner_id, lower(btrim(codigo)))
  where codigo is not null and btrim(codigo) <> '';

create table if not exists public.requisitos_aplicabilidade (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id) on delete cascade,
  requisito_id uuid not null,
  cargo_id uuid references public.cargos(id),
  setor_id uuid references public.setores(id),
  centro_servico_id uuid references public.centros_servico(id),
  centro_custo_id uuid references public.centros_custo(id),
  pessoa_id uuid references public.pessoas(id) on delete cascade,
  ativo boolean not null default true,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  desativado_por uuid,
  desativado_em timestamptz,
  motivo_desativacao text,
  constraint requisitos_aplicabilidade_requisito_fk
    foreign key (account_owner_id, requisito_id)
    references public.requisitos_controle (account_owner_id, id)
    on delete cascade,
  constraint requisitos_aplicabilidade_dimensao_check check (
    num_nonnulls(cargo_id, setor_id, centro_servico_id, centro_custo_id, pessoa_id) >= 1
  ),
  constraint requisitos_aplicabilidade_desativacao_check check (ativo or desativado_em is not null)
);

comment on table public.requisitos_aplicabilidade is
  'Regras de quem precisa de cada requisito. Dimensoes preenchidas combinam com E; regras diferentes com OU.';

create unique index if not exists requisitos_aplicabilidade_regra_uidx
  on public.requisitos_aplicabilidade (requisito_id, cargo_id, setor_id, centro_servico_id, centro_custo_id, pessoa_id)
  nulls not distinct
  where ativo;

create index if not exists requisitos_aplicabilidade_owner_idx
  on public.requisitos_aplicabilidade (account_owner_id, requisito_id)
  where ativo;

create index if not exists requisitos_aplicabilidade_cargo_idx
  on public.requisitos_aplicabilidade (cargo_id) where ativo and cargo_id is not null;
create index if not exists requisitos_aplicabilidade_setor_idx
  on public.requisitos_aplicabilidade (setor_id) where ativo and setor_id is not null;
create index if not exists requisitos_aplicabilidade_centro_servico_idx
  on public.requisitos_aplicabilidade (centro_servico_id) where ativo and centro_servico_id is not null;
create index if not exists requisitos_aplicabilidade_centro_custo_idx
  on public.requisitos_aplicabilidade (centro_custo_id) where ativo and centro_custo_id is not null;
create index if not exists requisitos_aplicabilidade_pessoa_idx
  on public.requisitos_aplicabilidade (pessoa_id) where ativo and pessoa_id is not null;

create table if not exists public.requisitos_realizacoes (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id),
  requisito_id uuid not null,
  data_realizacao date not null,
  data_vencimento date,
  possui_validade_snapshot boolean not null,
  validade_quantidade_snapshot integer,
  validade_unidade_snapshot text,
  numero_documento text,
  entidade_emissora text,
  observacao text,
  status_registro text not null default 'vigente',
  origem_registro text not null default 'registro',
  renovacao_de_id uuid references public.requisitos_realizacoes(id),
  substituido_em timestamptz,
  substituido_por uuid,
  cancelado_em timestamptz,
  cancelado_por uuid,
  motivo_cancelamento text,
  usuario_cadastro uuid,
  usuario_edicao uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  constraint requisitos_realizacoes_requisito_fk
    foreign key (account_owner_id, requisito_id)
    references public.requisitos_controle (account_owner_id, id),
  constraint requisitos_realizacoes_status_check check (status_registro in ('vigente', 'substituido', 'cancelado')),
  constraint requisitos_realizacoes_origem_check check (origem_registro in ('registro', 'renovacao', 'retroativo')),
  constraint requisitos_realizacoes_vencimento_check check (
    data_vencimento is null or data_vencimento >= data_realizacao
  ),
  constraint requisitos_realizacoes_snapshot_check check (
    (
      possui_validade_snapshot
      and validade_quantidade_snapshot >= 1
      and validade_unidade_snapshot in ('dias', 'meses')
      and data_vencimento is not null
    )
    or (
      not possui_validade_snapshot
      and validade_quantidade_snapshot is null
      and validade_unidade_snapshot is null
      and data_vencimento is null
    )
  ),
  constraint requisitos_realizacoes_cancelamento_check check ((status_registro = 'cancelado') = (cancelado_em is not null)),
  constraint requisitos_realizacoes_renovacao_check check (renovacao_de_id is null or renovacao_de_id <> id)
);

comment on table public.requisitos_realizacoes is
  'Realizacoes de requisitos por colaborador. Nunca apagadas; renovacao gera novo registro e substitui o anterior.';
comment on column public.requisitos_realizacoes.validade_quantidade_snapshot is
  'Validade do requisito copiada no momento do registro. Imutavel: alteracoes no requisito valem apenas para novos registros.';

create unique index if not exists requisitos_realizacoes_vigente_uidx
  on public.requisitos_realizacoes (account_owner_id, pessoa_id, requisito_id)
  where status_registro = 'vigente';

create unique index if not exists requisitos_realizacoes_data_uidx
  on public.requisitos_realizacoes (account_owner_id, pessoa_id, requisito_id, data_realizacao)
  where status_registro <> 'cancelado';

create index if not exists requisitos_realizacoes_vencimento_idx
  on public.requisitos_realizacoes (account_owner_id, data_vencimento)
  where status_registro = 'vigente';

create index if not exists requisitos_realizacoes_requisito_idx
  on public.requisitos_realizacoes (account_owner_id, requisito_id)
  where status_registro = 'vigente';

create index if not exists requisitos_realizacoes_pessoa_idx
  on public.requisitos_realizacoes (pessoa_id, requisito_id, data_realizacao desc);

create index if not exists requisitos_realizacoes_renovacao_idx
  on public.requisitos_realizacoes (renovacao_de_id)
  where renovacao_de_id is not null;

create table if not exists public.requisitos_dispensas (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id),
  requisito_id uuid not null,
  motivo text not null,
  valida_ate date,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  revogada_em timestamptz,
  revogada_por uuid,
  motivo_revogacao text,
  constraint requisitos_dispensas_requisito_fk
    foreign key (account_owner_id, requisito_id)
    references public.requisitos_controle (account_owner_id, id),
  constraint requisitos_dispensas_motivo_check check (length(btrim(motivo)) >= 3)
);

comment on table public.requisitos_dispensas is
  'Dispensa individual de um requisito exigido (ex.: restricao medica, funcao sem exposicao). Motivo obrigatorio.';

create unique index if not exists requisitos_dispensas_ativa_uidx
  on public.requisitos_dispensas (account_owner_id, pessoa_id, requisito_id)
  where revogada_em is null;

create table if not exists public.requisitos_config (
  account_owner_id uuid primary key references public.app_users(id) on delete cascade,
  janela_critica_dias integer not null default 7,
  timezone text not null default 'America/Sao_Paulo',
  alertas_ativos boolean not null default true,
  alerta_janela_ativo boolean not null default true,
  alerta_vencimento_ativo boolean not null default true,
  alerta_vencimento_tolerancia_dias integer not null default 7,
  versao integer not null default 1,
  motivo_alteracao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  constraint requisitos_config_janela_check check (janela_critica_dias between 1 and 90),
  constraint requisitos_config_tolerancia_check check (alerta_vencimento_tolerancia_dias between 0 and 30)
);

comment on table public.requisitos_config is
  'Configuracao do controle de validades por tenant. Ausencia de linha equivale aos valores padrao.';

create table if not exists public.requisitos_historico (
  id bigint generated always as identity primary key,
  account_owner_id uuid not null,
  entidade text not null,
  registro_id text not null,
  requisito_id uuid,
  pessoa_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  motivo text,
  ator_user_id uuid,
  criado_em timestamptz not null default now(),
  constraint requisitos_historico_entidade_check check (
    entidade in ('requisito', 'aplicabilidade', 'realizacao', 'dispensa', 'config')
  ),
  constraint requisitos_historico_acao_check check (
    acao in (
      'criado', 'alterado', 'validade_alterada', 'ativado', 'inativado',
      'regra_adicionada', 'regra_removida',
      'registro', 'renovacao', 'retroativo', 'edicao', 'substituicao', 'cancelamento', 'reativacao',
      'dispensa', 'dispensa_revogada',
      'config_alterada'
    )
  )
);

create index if not exists requisitos_historico_requisito_idx
  on public.requisitos_historico (account_owner_id, requisito_id, criado_em desc);

create index if not exists requisitos_historico_pessoa_idx
  on public.requisitos_historico (account_owner_id, pessoa_id, requisito_id, criado_em desc);

create index if not exists requisitos_historico_registro_idx
  on public.requisitos_historico (account_owner_id, entidade, registro_id);

create table if not exists public.requisitos_alertas_envios (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null references public.app_users(id) on delete cascade,
  realizacao_id uuid not null references public.requisitos_realizacoes(id) on delete cascade,
  tipo_alerta text not null,
  data_vencimento date not null,
  dias_restantes integer,
  status text not null default 'processando',
  tentativas integer not null default 0,
  lote_id uuid references public.inventory_report(id) on delete set null,
  destinatarios_total integer,
  erro text,
  reservado_em timestamptz not null default now(),
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint requisitos_alertas_envios_evento_key unique (realizacao_id, tipo_alerta, data_vencimento),
  constraint requisitos_alertas_envios_tipo_check check (tipo_alerta in ('janela_critica', 'vencimento')),
  constraint requisitos_alertas_envios_status_check check (status in ('processando', 'enviado', 'erro'))
);

comment on table public.requisitos_alertas_envios is
  'Idempotencia dos alertas: um evento por realizacao + tipo + vencimento. Renovacao gera nova realizacao e novo ciclo.';

create index if not exists requisitos_alertas_envios_owner_status_idx
  on public.requisitos_alertas_envios (account_owner_id, status);

-- ---------------------------------------------------------------------------
-- Funcoes puras (regra unica de vencimento e status)
-- Sem clausula SET de proposito: usam apenas funcoes nativas e assim podem ser inlined
-- pelo planner na base calculada (evita custo por linha em listas grandes).
-- ---------------------------------------------------------------------------

create or replace function public.validade_calcular_vencimento(
  p_data date,
  p_possui_validade boolean,
  p_quantidade integer,
  p_unidade text
)
returns date
language sql
immutable
as $$
  select case
    when p_data is null or not coalesce(p_possui_validade, false) or p_quantidade is null or p_quantidade < 1 then null
    when p_unidade = 'meses' then ((p_data + make_interval(months => p_quantidade))::date - 1)
    when p_unidade = 'dias' then (p_data + (p_quantidade - 1))
    else null
  end;
$$;

comment on function public.validade_calcular_vencimento(date, boolean, integer, text) is
  'Vencimento = data + N (dias|meses) - 1 dia. Ex.: 10/01/2024 + 24 meses -> 09/01/2026.';

create or replace function public.validade_status(
  p_tem_registro boolean,
  p_possui_validade boolean,
  p_dias_restantes integer,
  p_janela integer,
  p_dispensado boolean default false
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_dispensado, false) then 'dispensado'
    when not coalesce(p_tem_registro, false) then 'pendente'
    when not coalesce(p_possui_validade, false) then 'sem_validade'
    when p_dias_restantes < 0 then 'vencido'
    when p_dias_restantes = 0 then 'vence_hoje'
    when p_dias_restantes <= greatest(coalesce(p_janela, 7), 1) then 'proximo_vencimento'
    else 'valido'
  end;
$$;

comment on function public.validade_status(boolean, boolean, integer, integer, boolean) is
  'Regra unica de status do controle de validades. Usada pela lista, painel, exportacao e alertas.';

-- ---------------------------------------------------------------------------
-- Triggers de consistencia (tenant, snapshot e vencimento)
-- ---------------------------------------------------------------------------

create or replace function public.requisitos_aplicabilidade_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if tg_op = 'UPDATE' then
    if new.account_owner_id <> old.account_owner_id
      or new.requisito_id <> old.requisito_id
      or new.cargo_id is distinct from old.cargo_id
      or new.setor_id is distinct from old.setor_id
      or new.centro_servico_id is distinct from old.centro_servico_id
      or new.centro_custo_id is distinct from old.centro_custo_id
      or new.pessoa_id is distinct from old.pessoa_id then
      raise exception 'A regra de aplicabilidade nao pode ser alterada; remova e crie outra.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.cargo_id is not null and not exists (
    select 1 from public.cargos c where c.id = new.cargo_id and c.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Cargo nao pertence ao tenant.' using errcode = '42501';
  end if;

  if new.setor_id is not null and not exists (
    select 1 from public.setores s where s.id = new.setor_id and s.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Setor nao pertence ao tenant.' using errcode = '42501';
  end if;

  if new.centro_servico_id is not null and not exists (
    select 1 from public.centros_servico cs where cs.id = new.centro_servico_id and cs.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Centro de servico nao pertence ao tenant.' using errcode = '42501';
  end if;

  if new.centro_custo_id is not null and not exists (
    select 1 from public.centros_custo cc where cc.id = new.centro_custo_id and cc.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Centro de custo nao pertence ao tenant.' using errcode = '42501';
  end if;

  if new.pessoa_id is not null and not exists (
    select 1 from public.pessoas p where p.id = new.pessoa_id and p.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Pessoa nao pertence ao tenant.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists requisitos_aplicabilidade_before_write_trg on public.requisitos_aplicabilidade;
create trigger requisitos_aplicabilidade_before_write_trg
  before insert or update on public.requisitos_aplicabilidade
  for each row execute function public.requisitos_aplicabilidade_before_write();

create or replace function public.requisitos_realizacoes_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_possui boolean;
  v_quantidade integer;
  v_unidade text;
begin
  if tg_op = 'INSERT' then
    select r.possui_validade, r.validade_quantidade, r.validade_unidade
      into v_possui, v_quantidade, v_unidade
    from public.requisitos_controle r
    where r.id = new.requisito_id
      and r.account_owner_id = new.account_owner_id;

    if not found then
      raise exception 'Requisito nao encontrado para o tenant.' using errcode = '23503';
    end if;

    if not exists (
      select 1 from public.pessoas p where p.id = new.pessoa_id and p.account_owner_id = new.account_owner_id
    ) then
      raise exception 'Pessoa nao pertence ao tenant.' using errcode = '42501';
    end if;

    -- O snapshot sempre vem da configuracao vigente do requisito no momento do registro.
    new.possui_validade_snapshot := v_possui;
    new.validade_quantidade_snapshot := case when v_possui then v_quantidade else null end;
    new.validade_unidade_snapshot := case when v_possui then v_unidade else null end;
  else
    if new.possui_validade_snapshot is distinct from old.possui_validade_snapshot
      or new.validade_quantidade_snapshot is distinct from old.validade_quantidade_snapshot
      or new.validade_unidade_snapshot is distinct from old.validade_unidade_snapshot then
      raise exception 'O snapshot da validade de uma realizacao nao pode ser alterado.' using errcode = '42501';
    end if;

    if new.account_owner_id <> old.account_owner_id
      or new.pessoa_id <> old.pessoa_id
      or new.requisito_id <> old.requisito_id then
      raise exception 'Colaborador e requisito de uma realizacao nao podem ser alterados.' using errcode = '42501';
    end if;
  end if;

  new.data_vencimento := public.validade_calcular_vencimento(
    new.data_realizacao,
    new.possui_validade_snapshot,
    new.validade_quantidade_snapshot,
    new.validade_unidade_snapshot
  );

  return new;
end;
$$;

drop trigger if exists requisitos_realizacoes_before_write_trg on public.requisitos_realizacoes;
create trigger requisitos_realizacoes_before_write_trg
  before insert or update on public.requisitos_realizacoes
  for each row execute function public.requisitos_realizacoes_before_write();

create or replace function public.requisitos_dispensas_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if tg_op = 'UPDATE' then
    if new.account_owner_id <> old.account_owner_id
      or new.pessoa_id <> old.pessoa_id
      or new.requisito_id <> old.requisito_id then
      raise exception 'Colaborador e requisito de uma dispensa nao podem ser alterados.' using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.pessoas p where p.id = new.pessoa_id and p.account_owner_id = new.account_owner_id
  ) then
    raise exception 'Pessoa nao pertence ao tenant.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists requisitos_dispensas_before_write_trg on public.requisitos_dispensas;
create trigger requisitos_dispensas_before_write_trg
  before insert or update on public.requisitos_dispensas
  for each row execute function public.requisitos_dispensas_before_write();

-- ---------------------------------------------------------------------------
-- Historico transacional (gravado por trigger; nenhum caminho de escrita fica sem registro)
-- O motivo vem de `set_config('requisitos.motivo', ..., true)` feito pelas RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.requisitos_historico_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_novo jsonb := to_jsonb(new);
  v_antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_entidade text;
  v_acao text := 'alterado';
  v_registro_id text;
  v_requisito_id uuid;
  v_pessoa_id uuid;
  v_motivo text := nullif(btrim(coalesce(current_setting('requisitos.motivo', true), '')), '');
begin
  if tg_op = 'UPDATE' and v_novo = v_antigo then
    return new;
  end if;

  v_entidade := case tg_table_name
    when 'requisitos_controle' then 'requisito'
    when 'requisitos_aplicabilidade' then 'aplicabilidade'
    when 'requisitos_realizacoes' then 'realizacao'
    when 'requisitos_dispensas' then 'dispensa'
    else 'config'
  end;

  if v_entidade = 'requisito' then
    v_registro_id := v_novo->>'id';
    v_requisito_id := (v_novo->>'id')::uuid;
    if tg_op = 'INSERT' then
      v_acao := 'criado';
    elsif (v_antigo->>'ativo') is distinct from (v_novo->>'ativo') then
      v_acao := case when (v_novo->>'ativo')::boolean then 'ativado' else 'inativado' end;
    elsif (v_antigo->>'possui_validade') is distinct from (v_novo->>'possui_validade')
      or (v_antigo->>'validade_quantidade') is distinct from (v_novo->>'validade_quantidade')
      or (v_antigo->>'validade_unidade') is distinct from (v_novo->>'validade_unidade') then
      v_acao := 'validade_alterada';
    end if;
  elsif v_entidade = 'aplicabilidade' then
    v_registro_id := v_novo->>'id';
    v_requisito_id := (v_novo->>'requisito_id')::uuid;
    v_pessoa_id := nullif(v_novo->>'pessoa_id', '')::uuid;
    if tg_op = 'INSERT' then
      v_acao := 'regra_adicionada';
    elsif (v_antigo->>'ativo')::boolean and not (v_novo->>'ativo')::boolean then
      v_acao := 'regra_removida';
      v_motivo := coalesce(v_motivo, v_novo->>'motivo_desativacao');
    end if;
  elsif v_entidade = 'realizacao' then
    v_registro_id := v_novo->>'id';
    v_requisito_id := (v_novo->>'requisito_id')::uuid;
    v_pessoa_id := (v_novo->>'pessoa_id')::uuid;
    if tg_op = 'INSERT' then
      v_acao := case v_novo->>'origem_registro'
        when 'renovacao' then 'renovacao'
        when 'retroativo' then 'retroativo'
        else 'registro'
      end;
    elsif v_novo->>'status_registro' = 'cancelado' and v_antigo->>'status_registro' <> 'cancelado' then
      v_acao := 'cancelamento';
      v_motivo := coalesce(v_motivo, v_novo->>'motivo_cancelamento');
    elsif v_antigo->>'status_registro' = 'vigente' and v_novo->>'status_registro' = 'substituido' then
      v_acao := 'substituicao';
    elsif v_antigo->>'status_registro' = 'substituido' and v_novo->>'status_registro' = 'vigente' then
      v_acao := 'reativacao';
    else
      v_acao := 'edicao';
    end if;
  elsif v_entidade = 'dispensa' then
    v_registro_id := v_novo->>'id';
    v_requisito_id := (v_novo->>'requisito_id')::uuid;
    v_pessoa_id := (v_novo->>'pessoa_id')::uuid;
    if tg_op = 'INSERT' then
      v_acao := 'dispensa';
      v_motivo := coalesce(v_motivo, v_novo->>'motivo');
    elsif v_antigo->>'revogada_em' is null and v_novo->>'revogada_em' is not null then
      v_acao := 'dispensa_revogada';
      v_motivo := coalesce(v_motivo, v_novo->>'motivo_revogacao');
    end if;
  else
    v_registro_id := v_novo->>'account_owner_id';
    v_acao := 'config_alterada';
    v_motivo := coalesce(v_motivo, v_novo->>'motivo_alteracao');
  end if;

  insert into public.requisitos_historico (
    account_owner_id, entidade, registro_id, requisito_id, pessoa_id, acao, antes, depois, motivo, ator_user_id
  ) values (
    (v_novo->>'account_owner_id')::uuid,
    v_entidade,
    v_registro_id,
    v_requisito_id,
    v_pessoa_id,
    v_acao,
    v_antigo,
    v_novo,
    v_motivo,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists requisitos_controle_historico_trg on public.requisitos_controle;
create trigger requisitos_controle_historico_trg
  after insert or update on public.requisitos_controle
  for each row execute function public.requisitos_historico_log();

drop trigger if exists requisitos_aplicabilidade_historico_trg on public.requisitos_aplicabilidade;
create trigger requisitos_aplicabilidade_historico_trg
  after insert or update on public.requisitos_aplicabilidade
  for each row execute function public.requisitos_historico_log();

drop trigger if exists requisitos_realizacoes_historico_trg on public.requisitos_realizacoes;
create trigger requisitos_realizacoes_historico_trg
  after insert or update on public.requisitos_realizacoes
  for each row execute function public.requisitos_historico_log();

drop trigger if exists requisitos_dispensas_historico_trg on public.requisitos_dispensas;
create trigger requisitos_dispensas_historico_trg
  after insert or update on public.requisitos_dispensas
  for each row execute function public.requisitos_historico_log();

drop trigger if exists requisitos_config_historico_trg on public.requisitos_config;
create trigger requisitos_config_historico_trg
  after insert or update on public.requisitos_config
  for each row execute function public.requisitos_historico_log();

-- ---------------------------------------------------------------------------
-- RLS: leitura pelo proprio tenant; escrita somente por RPC
-- ---------------------------------------------------------------------------

alter table public.requisitos_controle enable row level security;
alter table public.requisitos_aplicabilidade enable row level security;
alter table public.requisitos_realizacoes enable row level security;
alter table public.requisitos_dispensas enable row level security;
alter table public.requisitos_config enable row level security;
alter table public.requisitos_historico enable row level security;
alter table public.requisitos_alertas_envios enable row level security;

drop policy if exists requisitos_controle_select_owner on public.requisitos_controle;
create policy requisitos_controle_select_owner
  on public.requisitos_controle for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

drop policy if exists requisitos_aplicabilidade_select_owner on public.requisitos_aplicabilidade;
create policy requisitos_aplicabilidade_select_owner
  on public.requisitos_aplicabilidade for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

drop policy if exists requisitos_realizacoes_select_owner on public.requisitos_realizacoes;
create policy requisitos_realizacoes_select_owner
  on public.requisitos_realizacoes for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

drop policy if exists requisitos_dispensas_select_owner on public.requisitos_dispensas;
create policy requisitos_dispensas_select_owner
  on public.requisitos_dispensas for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

drop policy if exists requisitos_config_select_owner on public.requisitos_config;
create policy requisitos_config_select_owner
  on public.requisitos_config for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

drop policy if exists requisitos_historico_select_owner on public.requisitos_historico;
create policy requisitos_historico_select_owner
  on public.requisitos_historico for select to authenticated
  using (public.is_master() or (account_owner_id = public.my_owner_id() and public.has_permission('validades.read'::text)));

-- requisitos_alertas_envios: sem policy para authenticated (somente service_role via Edge Function).

revoke all on public.requisitos_controle from public, anon, authenticated;
revoke all on public.requisitos_aplicabilidade from public, anon, authenticated;
revoke all on public.requisitos_realizacoes from public, anon, authenticated;
revoke all on public.requisitos_dispensas from public, anon, authenticated;
revoke all on public.requisitos_config from public, anon, authenticated;
revoke all on public.requisitos_historico from public, anon, authenticated;
revoke all on public.requisitos_alertas_envios from public, anon, authenticated;

grant select on public.requisitos_controle to authenticated;
grant select on public.requisitos_aplicabilidade to authenticated;
grant select on public.requisitos_realizacoes to authenticated;
grant select on public.requisitos_dispensas to authenticated;
grant select on public.requisitos_config to authenticated;
grant select on public.requisitos_historico to authenticated;

grant all on public.requisitos_controle to service_role;
grant all on public.requisitos_aplicabilidade to service_role;
grant all on public.requisitos_realizacoes to service_role;
grant all on public.requisitos_dispensas to service_role;
grant all on public.requisitos_config to service_role;
grant all on public.requisitos_historico to service_role;
grant all on public.requisitos_alertas_envios to service_role;

-- ---------------------------------------------------------------------------
-- Funcoes internas: "hoje" do tenant e base calculada (esperado x realizado)
-- ---------------------------------------------------------------------------

create or replace function public.validades_hoje(p_owner_id uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.requisitos_config c where c.account_owner_id = p_owner_id),
    'America/Sao_Paulo'
  ))::date;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'validades_linha'
  ) then
    create type public.validades_linha as (
      pessoa_id uuid,
      pessoa_nome text,
      matricula text,
      cargo_id uuid,
      cargo text,
      setor_id uuid,
      setor text,
      centro_servico_id uuid,
      centro_servico text,
      centro_custo_id uuid,
      centro_custo text,
      requisito_id uuid,
      requisito_nome text,
      requisito_codigo text,
      categoria text,
      requisito_tipo text,
      realizacao_id uuid,
      data_realizacao date,
      data_vencimento date,
      numero_documento text,
      entidade_emissora text,
      observacao text,
      origem_registro text,
      possui_validade boolean,
      validade_quantidade integer,
      validade_unidade text,
      dias_restantes integer,
      status text,
      exigencia text,
      origens text[],
      dispensa_id uuid,
      dispensa_motivo text,
      dispensa_valida_ate date,
      hoje date,
      janela integer
    );
  end if;
end;
$$;

-- Colaboradores considerados no controle: ativos e sem desligamento efetivado.
-- Sem SECURITY DEFINER e sem SET para poder ser inlined pelo planner (usa as estatisticas de `pessoas`);
-- so e executada dentro das RPCs (definer).
create or replace function public._validades_pessoas_ativas(p_owner_id uuid)
returns table (
  id uuid,
  nome text,
  matricula text,
  cargo_id uuid,
  setor_id uuid,
  centro_servico_id uuid,
  centro_custo_id uuid
)
language sql
stable
as $$
  select
    p.id,
    p.nome::text,
    p.matricula::text,
    p.cargo_id,
    p.setor_id,
    p.centro_servico_id,
    p.centro_custo_id
  from public.pessoas p
  where p.account_owner_id = p_owner_id
    and coalesce(p.ativo, true) = true
    and (p."dataDemissao" is null or p."dataDemissao" > now());
$$;

-- Regra unica de aplicabilidade: dimensoes preenchidas precisam coincidir (E).
create or replace function public._validades_regra_aplica(
  p_regra_cargo_id uuid,
  p_regra_setor_id uuid,
  p_regra_centro_servico_id uuid,
  p_regra_centro_custo_id uuid,
  p_regra_pessoa_id uuid,
  p_pessoa_id uuid,
  p_pessoa_cargo_id uuid,
  p_pessoa_setor_id uuid,
  p_pessoa_centro_servico_id uuid,
  p_pessoa_centro_custo_id uuid
)
returns boolean
language sql
immutable
as $$
  select (p_regra_pessoa_id is null or p_regra_pessoa_id = p_pessoa_id)
    and (p_regra_cargo_id is null or p_regra_cargo_id = p_pessoa_cargo_id)
    and (p_regra_setor_id is null or p_regra_setor_id = p_pessoa_setor_id)
    and (p_regra_centro_servico_id is null or p_regra_centro_servico_id = p_pessoa_centro_servico_id)
    and (p_regra_centro_custo_id is null or p_regra_centro_custo_id = p_pessoa_centro_custo_id);
$$;

-- Uma linha por par (colaborador ativo, requisito ativo) que seja exigido por regra
-- OU que tenha realizacao vigente. Requisito exigido sem realizacao aparece como `pendente`.
--
-- Desempenho: cada regra casa com as pessoas por um join de igualdade na dimensao mais seletiva
-- (pessoa > setor > cargo > centro de servico > centro de custo) e esperado x realizado e um FULL JOIN,
-- para o plano nao depender de estimativas de linhas de CTE (evita nested loop sem indice).
create or replace function public._validades_base(p_owner_id uuid)
returns setof public.validades_linha
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  with cfg as (
    select
      coalesce(c.janela_critica_dias, 7) as janela,
      (now() at time zone coalesce(c.timezone, 'America/Sao_Paulo'))::date as hoje
    from (select 1) as unico
    left join public.requisitos_config c on c.account_owner_id = p_owner_id
  ),
  regras as (
    select
      a.requisito_id,
      a.cargo_id,
      a.setor_id,
      a.centro_servico_id,
      a.centro_custo_id,
      a.pessoa_id,
      concat_ws(' + ',
        case when a.pessoa_id is not null then 'Individual' end,
        case when a.cargo_id is not null then 'Cargo: ' || coalesce(cg.nome, '?') end,
        case when a.setor_id is not null then 'Setor: ' || coalesce(st.nome, '?') end,
        case when a.centro_servico_id is not null then 'Centro de servico: ' || coalesce(cs.nome, '?') end,
        case when a.centro_custo_id is not null then 'Centro de custo: ' || coalesce(cc.nome, '?') end
      ) as origem
    from public.requisitos_aplicabilidade a
    join public.requisitos_controle r
      on r.id = a.requisito_id
     and r.account_owner_id = p_owner_id
     and r.ativo
    left join public.cargos cg on cg.id = a.cargo_id
    left join public.setores st on st.id = a.setor_id
    left join public.centros_servico cs on cs.id = a.centro_servico_id
    left join public.centros_custo cc on cc.id = a.centro_custo_id
    where a.account_owner_id = p_owner_id
      and a.ativo
  ),
  casamentos as (
    select pa.id as pessoa_id, rg.requisito_id, rg.origem
    from regras rg
    join public._validades_pessoas_ativas(p_owner_id) pa on pa.id = rg.pessoa_id
    where rg.pessoa_id is not null
      and public._validades_regra_aplica(
        rg.cargo_id, rg.setor_id, rg.centro_servico_id, rg.centro_custo_id, rg.pessoa_id,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id)

    union all

    select pa.id, rg.requisito_id, rg.origem
    from regras rg
    join public._validades_pessoas_ativas(p_owner_id) pa on pa.setor_id = rg.setor_id
    where rg.pessoa_id is null
      and rg.setor_id is not null
      and public._validades_regra_aplica(
        rg.cargo_id, rg.setor_id, rg.centro_servico_id, rg.centro_custo_id, rg.pessoa_id,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id)

    union all

    select pa.id, rg.requisito_id, rg.origem
    from regras rg
    join public._validades_pessoas_ativas(p_owner_id) pa on pa.cargo_id = rg.cargo_id
    where rg.pessoa_id is null
      and rg.setor_id is null
      and rg.cargo_id is not null
      and public._validades_regra_aplica(
        rg.cargo_id, rg.setor_id, rg.centro_servico_id, rg.centro_custo_id, rg.pessoa_id,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id)

    union all

    select pa.id, rg.requisito_id, rg.origem
    from regras rg
    join public._validades_pessoas_ativas(p_owner_id) pa on pa.centro_servico_id = rg.centro_servico_id
    where rg.pessoa_id is null
      and rg.setor_id is null
      and rg.cargo_id is null
      and rg.centro_servico_id is not null
      and public._validades_regra_aplica(
        rg.cargo_id, rg.setor_id, rg.centro_servico_id, rg.centro_custo_id, rg.pessoa_id,
        pa.id, pa.cargo_id, pa.setor_id, pa.centro_servico_id, pa.centro_custo_id)

    union all

    select pa.id, rg.requisito_id, rg.origem
    from regras rg
    join public._validades_pessoas_ativas(p_owner_id) pa on pa.centro_custo_id = rg.centro_custo_id
    where rg.pessoa_id is null
      and rg.setor_id is null
      and rg.cargo_id is null
      and rg.centro_servico_id is null
      and rg.centro_custo_id is not null
  ),
  esperados as (
    select
      pessoa_id,
      requisito_id,
      array_agg(distinct origem order by origem) as origens
    from casamentos
    group by pessoa_id, requisito_id
  ),
  vigentes as (
    select v.*
    from public.requisitos_realizacoes v
    join public.requisitos_controle r
      on r.id = v.requisito_id
     and r.account_owner_id = p_owner_id
     and r.ativo
    where v.account_owner_id = p_owner_id
      and v.status_registro = 'vigente'
  ),
  pares as (
    select
      coalesce(e.pessoa_id, v.pessoa_id) as pessoa_id,
      coalesce(e.requisito_id, v.requisito_id) as requisito_id,
      e.origens,
      e.pessoa_id is not null as esperado,
      v.id as realizacao_id,
      v.data_realizacao,
      v.data_vencimento,
      v.numero_documento,
      v.entidade_emissora,
      v.observacao,
      v.origem_registro,
      v.possui_validade_snapshot,
      v.validade_quantidade_snapshot,
      v.validade_unidade_snapshot
    from esperados e
    full join vigentes v
      on v.pessoa_id = e.pessoa_id
     and v.requisito_id = e.requisito_id
  )
  select
    pa.id,
    pa.nome,
    pa.matricula,
    pa.cargo_id,
    cg.nome::text,
    pa.setor_id,
    st.nome::text,
    pa.centro_servico_id,
    cs.nome::text,
    pa.centro_custo_id,
    cc.nome::text,
    r.id,
    r.nome,
    r.codigo,
    r.categoria,
    r.tipo,
    pr.realizacao_id,
    pr.data_realizacao,
    pr.data_vencimento,
    pr.numero_documento,
    pr.entidade_emissora,
    pr.observacao,
    pr.origem_registro,
    case when pr.realizacao_id is not null then pr.possui_validade_snapshot else r.possui_validade end,
    case when pr.realizacao_id is not null then pr.validade_quantidade_snapshot else r.validade_quantidade end,
    case when pr.realizacao_id is not null then pr.validade_unidade_snapshot else r.validade_unidade end,
    (pr.data_vencimento - cfg.hoje),
    public.validade_status(
      pr.realizacao_id is not null,
      pr.possui_validade_snapshot,
      (pr.data_vencimento - cfg.hoje),
      cfg.janela,
      pr.esperado and d.id is not null
    ),
    case
      when not pr.esperado then 'nao_exigido'
      when d.id is not null then 'dispensado'
      else 'exigido'
    end,
    coalesce(pr.origens, array['Sem exigencia atual']::text[]),
    d.id,
    d.motivo,
    d.valida_ate,
    cfg.hoje,
    cfg.janela
  from pares pr
  cross join cfg
  join public._validades_pessoas_ativas(p_owner_id) pa on pa.id = pr.pessoa_id
  join public.requisitos_controle r on r.id = pr.requisito_id
  left join public.requisitos_dispensas d
    on d.account_owner_id = p_owner_id
   and d.pessoa_id = pr.pessoa_id
   and d.requisito_id = pr.requisito_id
   and d.revogada_em is null
   and (d.valida_ate is null or d.valida_ate >= cfg.hoje)
  left join public.cargos cg on cg.id = pa.cargo_id
  left join public.setores st on st.id = pa.setor_id
  left join public.centros_servico cs on cs.id = pa.centro_servico_id
  left join public.centros_custo cc on cc.id = pa.centro_custo_id;
$$;

comment on function public._validades_base(uuid) is
  'Base unica do controle de validades (esperado x realizado x status). Uso interno das RPCs e dos alertas.';

-- Filtros compartilhados pela lista, painel e exportacao.
create or replace function public._validades_filtrada(p_owner_id uuid, p_filtros jsonb)
returns setof public.validades_linha
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  with f as (
    select
      nullif(btrim(coalesce(p_filtros->>'termo', '')), '') as termo,
      nullif(p_filtros->>'pessoa_id', '')::uuid as pessoa_id,
      nullif(p_filtros->>'requisito_id', '')::uuid as requisito_id,
      nullif(btrim(coalesce(p_filtros->>'categoria', '')), '') as categoria,
      nullif(btrim(coalesce(p_filtros->>'status', '')), '') as status,
      coalesce(nullif(btrim(coalesce(p_filtros->>'exigencia', '')), ''), 'exigido') as exigencia,
      nullif(p_filtros->>'cargo_id', '')::uuid as cargo_id,
      nullif(p_filtros->>'setor_id', '')::uuid as setor_id,
      nullif(p_filtros->>'centro_servico_id', '')::uuid as centro_servico_id,
      nullif(p_filtros->>'centro_custo_id', '')::uuid as centro_custo_id,
      nullif(p_filtros->>'vencimento_de', '')::date as vencimento_de,
      nullif(p_filtros->>'vencimento_ate', '')::date as vencimento_ate,
      nullif(btrim(coalesce(p_filtros->>'faixa', '')), '') as faixa
  )
  select b.*
  from public._validades_base(p_owner_id) b
  cross join f
  where (f.exigencia = 'todos' or b.exigencia = f.exigencia)
    and (f.termo is null
      or b.pessoa_nome ilike '%' || f.termo || '%'
      or b.matricula ilike '%' || f.termo || '%'
      or b.requisito_nome ilike '%' || f.termo || '%'
      or coalesce(b.requisito_codigo, '') ilike '%' || f.termo || '%')
    and (f.pessoa_id is null or b.pessoa_id = f.pessoa_id)
    and (f.requisito_id is null or b.requisito_id = f.requisito_id)
    and (f.categoria is null or b.categoria = f.categoria)
    and (f.status is null or b.status = any (string_to_array(f.status, ',')))
    and (f.cargo_id is null or b.cargo_id = f.cargo_id)
    and (f.setor_id is null or b.setor_id = f.setor_id)
    and (f.centro_servico_id is null or b.centro_servico_id = f.centro_servico_id)
    and (f.centro_custo_id is null or b.centro_custo_id = f.centro_custo_id)
    and (f.vencimento_de is null or b.data_vencimento >= f.vencimento_de)
    and (f.vencimento_ate is null or b.data_vencimento <= f.vencimento_ate)
    and (
      f.faixa is null
      or (f.faixa = '0_7' and b.dias_restantes between 0 and 7)
      or (f.faixa = '8_30' and b.dias_restantes between 8 and 30)
      or (f.faixa = '31_60' and b.dias_restantes between 31 and 60)
      or (f.faixa = '61_90' and b.dias_restantes between 61 and 90)
    );
$$;

-- Nome amigavel do usuario (titular ou dependente).
create or replace function public._validades_usuario_nome(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select case
    when p_user_id is null then null
    else coalesce(
      (select coalesce(u.display_name, u.username, u.email) from public.app_users u where u.id = p_user_id),
      (select coalesce(d.display_name, d.username, d.email) from public.app_users_dependentes d where d.auth_user_id = p_user_id limit 1),
      p_user_id::text
    )
  end;
$$;

-- Acesso: owner da sessao + permissao (master e service_role liberados).
create or replace function public.validades_assert_access(p_owner_id uuid, p_permission text)
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

  if not public.has_permission(p_permission) then
    raise exception 'Sem permissao para esta operacao (%).', p_permission using errcode = '42501';
  end if;
end;
$$;

create or replace function public.validades_pode(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or coalesce(public.is_master(), false)
    or coalesce(public.has_permission(p_permission), false);
$$;

revoke all on function public.validade_calcular_vencimento(date, boolean, integer, text) from public, anon;
revoke all on function public.validade_status(boolean, boolean, integer, integer, boolean) from public, anon;
grant execute on function public.validade_calcular_vencimento(date, boolean, integer, text) to authenticated, service_role;
grant execute on function public.validade_status(boolean, boolean, integer, integer, boolean) to authenticated, service_role;

revoke all on function public.requisitos_aplicabilidade_before_write() from public, anon, authenticated;
revoke all on function public.requisitos_realizacoes_before_write() from public, anon, authenticated;
revoke all on function public.requisitos_dispensas_before_write() from public, anon, authenticated;
revoke all on function public.requisitos_historico_log() from public, anon, authenticated;

revoke all on function public._validades_pessoas_ativas(uuid) from public, anon, authenticated;
revoke all on function public._validades_regra_aplica(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public._validades_pessoas_ativas(uuid) to service_role;
grant execute on function public._validades_regra_aplica(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;

revoke all on function public.validades_hoje(uuid) from public, anon, authenticated;
revoke all on function public._validades_base(uuid) from public, anon, authenticated;
revoke all on function public._validades_filtrada(uuid, jsonb) from public, anon, authenticated;
revoke all on function public._validades_usuario_nome(uuid) from public, anon, authenticated;
grant execute on function public.validades_hoje(uuid) to service_role;
grant execute on function public._validades_base(uuid) to service_role;
grant execute on function public._validades_filtrada(uuid, jsonb) to service_role;
grant execute on function public._validades_usuario_nome(uuid) to service_role;

revoke all on function public.validades_assert_access(uuid, text) from public, anon;
revoke all on function public.validades_pode(text) from public, anon;
grant execute on function public.validades_assert_access(uuid, text) to authenticated, service_role;
grant execute on function public.validades_pode(text) to authenticated, service_role;

notify pgrst, 'reload schema';
