-- Refatora acidentes para tabela accidents + tabelas de grupo.

-- Remove view antiga para permitir alteracoes de tipo nas colunas base.
drop view if exists public.vw_acidentes;

-- Tabela principal (accidents).
create table if not exists public.accidents (
  id uuid default gen_random_uuid() not null,
  people_id uuid,
  lost_days smallint default 0,
  debited_days smallint default 0,
  cid_code text,
  cat_number text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz,
  created_by_username uuid,
  updated_by_username uuid,
  sesmt_involved boolean default true,
  location_name uuid,
  hht_value bigint,
  sesmt_date timestamptz,
  esocial_date timestamptz,
  accident_date timestamptz,
  cancel_reason text,
  is_active boolean default true,
  account_owner_id uuid not null,
  esocial_involved boolean default false,
  service_center uuid
);

-- Colunas adicionadas em bases antigas (se existirem).
alter table if exists public.accidents add column if not exists people_id uuid;
alter table if exists public.accidents add column if not exists lost_days smallint default 0;
alter table if exists public.accidents add column if not exists debited_days smallint default 0;
alter table if exists public.accidents add column if not exists cid_code text;
alter table if exists public.accidents add column if not exists cat_number text;
alter table if exists public.accidents add column if not exists notes text;
alter table if exists public.accidents add column if not exists created_at timestamptz default now();
alter table if exists public.accidents add column if not exists updated_at timestamptz;
alter table if exists public.accidents add column if not exists created_by_username uuid;
alter table if exists public.accidents add column if not exists updated_by_username uuid;
alter table if exists public.accidents add column if not exists sesmt_involved boolean default true;
alter table if exists public.accidents add column if not exists location_name uuid;
alter table if exists public.accidents add column if not exists hht_value bigint;
alter table if exists public.accidents add column if not exists sesmt_date timestamptz;
alter table if exists public.accidents add column if not exists esocial_date timestamptz;
alter table if exists public.accidents add column if not exists accident_date timestamptz;
alter table if exists public.accidents add column if not exists cancel_reason text;
alter table if exists public.accidents add column if not exists is_active boolean default true;
alter table if exists public.accidents add column if not exists account_owner_id uuid;
alter table if exists public.accidents add column if not exists esocial_involved boolean default false;
alter table if exists public.accidents add column if not exists service_center uuid;
alter table if exists public.accidents drop column if exists updated_by;

alter table if exists public.accidents
  alter column lost_days type smallint using lost_days::smallint,
  alter column debited_days type smallint using debited_days::smallint,
  alter column hht_value type bigint using
    case when hht_value is null then null else round(hht_value)::bigint end;

alter table if exists public.accidents
  alter column lost_days set default 0,
  alter column debited_days set default 0,
  alter column sesmt_involved set default true,
  alter column is_active set default true,
  alter column esocial_involved set default false,
  alter column account_owner_id drop default;

alter table if exists public.accidents
  alter column lost_days drop not null,
  alter column debited_days drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accidents_pkey'
  ) then
    alter table public.accidents add constraint accidents_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_lost_days_check'
  ) then
    alter table public.accidents add constraint accidents_lost_days_check
      check (lost_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_debited_days_check'
  ) then
    alter table public.accidents add constraint accidents_debited_days_check
      check (debited_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_hht_check'
  ) then
    alter table public.accidents add constraint accidents_hht_check
      check (hht_value is null or hht_value >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accidents_account_owner_id_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_account_owner_id_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_people_id_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_people_id_fkey
      foreign key (people_id) references public.pessoas(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_service_center_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_service_center_fkey
      foreign key (service_center) references public.centros_servico(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_location_name_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_location_name_fkey
      foreign key (location_name) references public.acidente_locais(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_created_by_username_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_created_by_username_fkey
      foreign key (created_by_username) references public.app_users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accidents_updated_by_username_fkey'
  ) then
    alter table public.accidents
      add constraint accidents_updated_by_username_fkey
      foreign key (updated_by_username) references public.app_users(id);
  end if;
end $$;

create index if not exists accidents_date_idx
  on public.accidents (accident_date desc);
create index if not exists accidents_people_id_idx
  on public.accidents (people_id);
create index if not exists accidents_service_center_idx
  on public.accidents (service_center);

drop trigger if exists accidents_set_account_owner_id on public.accidents;
create trigger accidents_set_account_owner_id
  before insert on public.accidents
  for each row
  execute function public.set_account_owner_id_default();

-- Tabelas de grupo (agentes/lesoes/tipos) e partes.
create table if not exists public.accident_group_agents (
  id uuid default gen_random_uuid() not null,
  accident_id uuid,
  accident_agents_id uuid,
  accident_injuries_id uuid,
  accident_type_id uuid,
  created_at timestamptz default now() not null,
  account_owner_id uuid not null
);

create table if not exists public.accident_group_parts (
  id uuid default gen_random_uuid() not null,
  accident_parts_id uuid,
  accident_parts_group_id uuid,
  accident_parts_subgroup_id uuid,
  created_at timestamptz default now() not null,
  accident_id uuid,
  account_owner_id uuid not null
);

alter table if exists public.accident_group_agents add column if not exists accident_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_agents_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_injuries_id uuid;
alter table if exists public.accident_group_agents add column if not exists accident_type_id uuid;
alter table if exists public.accident_group_agents add column if not exists created_at timestamptz default now();
alter table if exists public.accident_group_agents add column if not exists account_owner_id uuid;

alter table if exists public.accident_group_parts add column if not exists accident_parts_id uuid;
alter table if exists public.accident_group_parts add column if not exists accident_parts_group_id uuid;
alter table if exists public.accident_group_parts add column if not exists accident_parts_subgroup_id uuid;
alter table if exists public.accident_group_parts add column if not exists created_at timestamptz default now();
alter table if exists public.accident_group_parts add column if not exists accident_id uuid;
alter table if exists public.accident_group_parts add column if not exists account_owner_id uuid;

alter table if exists public.accident_group_agents drop column if exists ordem;
alter table if exists public.accident_group_parts drop column if exists ordem;

alter table if exists public.accident_group_agents
  alter column account_owner_id drop default;
alter table if exists public.accident_group_parts
  alter column account_owner_id drop default;

alter table if exists public.accident_group_agents
  alter column accident_id drop not null;
alter table if exists public.accident_group_parts
  alter column accident_id drop not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'accident_group_agents'
       and c.contype = 'p'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_pkey primary key (id);
  end if;

  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'accident_group_parts'
       and c.contype = 'p'
  ) then
    alter table public.accident_group_parts
      add constraint group_accident_parts_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_agents_accidents_id_fkey'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_accidents_id_fkey
      foreign key (accident_id) references public.accidents(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_agents_accident_agents_id_fkey'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_accident_agents_id_fkey
      foreign key (accident_agents_id) references public.acidente_agentes(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_agents_accidents_injuries_id_fkey'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_accidents_injuries_id_fkey
      foreign key (accident_injuries_id) references public.acidente_lesoes(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_agents_accidents_type_id_fkey'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_accidents_type_id_fkey
      foreign key (accident_type_id) references public.acidente_tipos(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_agents_account_owner_id_fkey'
  ) then
    alter table public.accident_group_agents
      add constraint accident_group_agents_account_owner_id_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_parts_accident_id_fkey'
  ) then
    alter table public.accident_group_parts
      add constraint accident_group_parts_accident_id_fkey
      foreign key (accident_id) references public.accidents(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'group_accident_parts_accident_parts_id_fkey'
  ) then
    alter table public.accident_group_parts
      add constraint group_accident_parts_accident_parts_id_fkey
      foreign key (accident_parts_id) references public.acidente_partes(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'group_accident_parts_accident_parts_group_id_fkey'
  ) then
    alter table public.accident_group_parts
      add constraint group_accident_parts_accident_parts_group_id_fkey
      foreign key (accident_parts_group_id) references public.acidente_partes_grupo(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'group_accident_parts_accident_parts_subgroup_id_fkey'
  ) then
    alter table public.accident_group_parts
      add constraint group_accident_parts_accident_parts_subgroup_id_fkey
      foreign key (accident_parts_subgroup_id) references public.acidente_partes_sub_grupo(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accident_group_parts_account_owner_id_fkey'
  ) then
    alter table public.accident_group_parts
      add constraint accident_group_parts_account_owner_id_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;
end $$;

create index if not exists accident_group_agents_accident_idx
  on public.accident_group_agents (accident_id);
create index if not exists accident_group_agents_owner_idx
  on public.accident_group_agents (account_owner_id);
create index if not exists accident_group_parts_accident_idx
  on public.accident_group_parts (accident_id);
create index if not exists accident_group_parts_owner_idx
  on public.accident_group_parts (account_owner_id);

-- Owner + consistencia para vinculos de acidentes.
create or replace function public.set_owner_accident_relacionado()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_grupo uuid;
  v_subgrupo uuid;
begin
  select a.account_owner_id
    into v_owner
    from public.accidents a
   where a.id = new.accident_id;

  if v_owner is null then
    raise exception 'Acidente sem owner; nao pode vincular.';
  end if;

  if new.account_owner_id is null then
    new.account_owner_id := v_owner;
  elsif new.account_owner_id <> v_owner then
    raise exception 'Owner do vinculo nao confere com o owner do acidente.';
  end if;

  if tg_table_name = 'accident_group_parts' then
    if new.accident_parts_id is not null then
      select grupo, subgrupo into v_grupo, v_subgrupo
        from public.acidente_partes
       where id = new.accident_parts_id;

      if v_grupo is null then
        raise exception 'Parte lesionada invalida.';
      end if;

      if new.accident_parts_group_id is null then
        new.accident_parts_group_id := v_grupo;
      elsif new.accident_parts_group_id <> v_grupo then
        raise exception 'Grupo da parte nao confere.';
      end if;

      if new.accident_parts_subgroup_id is null then
        new.accident_parts_subgroup_id := v_subgrupo;
      elsif v_subgrupo is not null and new.accident_parts_subgroup_id <> v_subgrupo then
        raise exception 'Subgrupo da parte nao confere.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists accident_group_agents_set_owner on public.accident_group_agents;
create trigger accident_group_agents_set_owner
  before insert or update of accident_id, account_owner_id on public.accident_group_agents
  for each row
  execute function public.set_owner_accident_relacionado();

drop trigger if exists accident_group_parts_set_owner on public.accident_group_parts;
create trigger accident_group_parts_set_owner
  before insert or update of accident_id, account_owner_id, accident_parts_id, accident_parts_group_id, accident_parts_subgroup_id
  on public.accident_group_parts
  for each row
  execute function public.set_owner_accident_relacionado();

-- Ajusta FK do historico para apontar para accidents.
alter table if exists public.acidente_historico
  drop constraint if exists acidente_historico_acidente_id_fkey;
alter table if exists public.acidente_historico
  add constraint acidente_historico_acidente_id_fkey
  foreign key (acidente_id) references public.accidents(id) on delete cascade;

-- RLS (padrao tenant).
alter table if exists public.accidents enable row level security;
alter table if exists public.accident_group_agents enable row level security;
alter table if exists public.accident_group_parts enable row level security;

drop policy if exists accidents_select_owner on public.accidents;
create policy accidents_select_owner
  on public.accidents
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master()
      or public.has_permission('acidentes.read'::text)
      or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accidents_insert_owner on public.accidents;
create policy accidents_insert_owner
  on public.accidents
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accidents_update_owner on public.accidents;
create policy accidents_update_owner
  on public.accidents
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_agents_select_owner on public.accident_group_agents;
create policy accident_group_agents_select_owner
  on public.accident_group_agents
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master()
      or public.has_permission('acidentes.read'::text)
      or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_agents_insert_owner on public.accident_group_agents;
create policy accident_group_agents_insert_owner
  on public.accident_group_agents
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_agents_update_owner on public.accident_group_agents;
create policy accident_group_agents_update_owner
  on public.accident_group_agents
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_parts_select_owner on public.accident_group_parts;
create policy accident_group_parts_select_owner
  on public.accident_group_parts
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master()
      or public.has_permission('acidentes.read'::text)
      or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_parts_insert_owner on public.accident_group_parts;
create policy accident_group_parts_insert_owner
  on public.accident_group_parts
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

drop policy if exists accident_group_parts_update_owner on public.accident_group_parts;
create policy accident_group_parts_update_owner
  on public.accident_group_parts
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

-- HHT mensal: bloqueia cancelamento quando houver acidentes no mes/centro (agora em accidents).
create or replace function public.hht_mensal_prevent_inactivation()
returns trigger as $$
declare
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_setting('app.bypass_hht_guard', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado
      from public.status_hht
     where lower(status) = 'cancelado'
     limit 1;
  end if;

  if tg_op = 'DELETE' then
    select exists(
      select 1
        from public.accidents a
       where date_trunc('month', a.accident_date) = old.mes_ref
         and a.service_center = old.centro_servico_id
         and coalesce(a.is_active, true) = true
         and coalesce(a.cancel_reason, '') is distinct from '__cancel_placeholder__'
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar/excluir: ha acidentes cadastrados para este centro e mes.';
    end if;
    return old;
  end if;

  if v_status_cancelado is not null
     and new.status_hht_id = v_status_cancelado
     and (old.status_hht_id is distinct from v_status_cancelado) then
    select exists(
      select 1
        from public.accidents a
       where date_trunc('month', a.accident_date) = new.mes_ref
         and a.service_center = new.centro_servico_id
         and coalesce(a.is_active, true) = true
         and coalesce(a.cancel_reason, '') is distinct from '__cancel_placeholder__'
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function public.hht_mensal_delete(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_registro record;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  select id, mes_ref, centro_servico_id, status_hht_id
    into v_registro
    from public.hht_mensal
   where id = p_id;

  if not found then
    raise exception 'Registro nao encontrado.';
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado
      from public.status_hht
     where lower(status) = 'cancelado'
     limit 1;
  end if;

  if v_status_cancelado is not null and v_registro.status_hht_id = v_status_cancelado then
    raise exception 'Registro ja cancelado.';
  end if;

  select exists(
    select 1
      from public.accidents a
     where date_trunc('month', a.accident_date) = v_registro.mes_ref
       and a.service_center = v_registro.centro_servico_id
       and coalesce(a.is_active, true) = true
       and coalesce(a.cancel_reason, '') is distinct from '__cancel_placeholder__'
  ) into v_tem_acidente;

  if coalesce(v_tem_acidente, false) then
    raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
  end if;

  perform set_config('app.hht_motivo', coalesce(trim(both from p_motivo), ''), true);
  update public.hht_mensal
     set status_hht_id = coalesce(v_status_cancelado, status_hht_id)
   where id = p_id;
end;
$$;

grant execute on function public.hht_mensal_delete(uuid, text) to authenticated, service_role;

-- RPCs full para acidentes (novo modelo com IDs).
drop function if exists public.rpc_acidentes_create_full(
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text
);

drop function if exists public.rpc_acidentes_create_full(
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  text
);

drop function if exists public.rpc_acidentes_update_full(
  uuid,
  text,
  text,
  text,
  timestamptz,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  timestamptz,
  boolean,
  timestamptz,
  numeric,
  text,
  jsonb
);

drop function if exists public.rpc_acidentes_update_full(
  uuid,
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  text,
  jsonb
);

create or replace function public.rpc_acidentes_create_full(
  p_pessoa_id uuid,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_cid text,
  p_centro_servico_id uuid,
  p_local_id uuid,
  p_cat text,
  p_observacao text,
  p_agente_id uuid,
  p_tipos_ids uuid[] default null,
  p_lesoes_ids uuid[] default null,
  p_partes_ids uuid[] default null,
  p_data_esocial timestamptz default null,
  p_esocial boolean default false,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_registrado_por text default null
) returns setof public.accidents
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_id uuid;
  v_registrado_uuid uuid;
  v_tipo_count int;
  v_lesao_count int;
  v_invalid boolean;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := auth.uid();
  end if;

  begin
    v_registrado_uuid := nullif(trim(p_registrado_por), '')::uuid;
  exception
    when invalid_text_representation then
      v_registrado_uuid := null;
  end;
  if v_registrado_uuid is null then
    v_registrado_uuid := auth.uid();
  end if;

  v_tipo_count := coalesce(array_length(p_tipos_ids, 1), 0);
  v_lesao_count := coalesce(array_length(p_lesoes_ids, 1), 0);
  if v_tipo_count = 0 then
    raise exception 'acidente_tipos_required' using errcode = 'P0001';
  end if;
  if v_lesao_count = 0 then
    raise exception 'acidente_lesoes_required' using errcode = 'P0001';
  end if;
  if p_agente_id is null then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;
  if p_partes_ids is null or coalesce(array_length(p_partes_ids, 1), 0) = 0 then
    raise exception 'acidente_partes_required' using errcode = 'P0001';
  end if;
  if p_partes_ids is null or coalesce(array_length(p_partes_ids, 1), 0) = 0 then
    raise exception 'acidente_partes_required' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_tipos_ids) as t(id)
      left join public.acidente_tipos at on at.id = t.id and at.agente_id = p_agente_id
     where t.id is not null and at.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_tipos_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_lesoes_ids) as l(id)
      left join public.acidente_lesoes al on al.id = l.id and al.agente_id = p_agente_id
     where l.id is not null and al.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_lesoes_invalidas' using errcode = 'P0001';
  end if;

  if p_partes_ids is not null then
    select exists(
      select 1
        from unnest(p_partes_ids) as p(id)
        left join public.acidente_partes ap on ap.id = p.id
       where p.id is not null and ap.id is null
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_partes_invalidas' using errcode = 'P0001';
    end if;
  end if;

  insert into public.accidents (
    people_id,
    accident_date,
    lost_days,
    debited_days,
    cid_code,
    service_center,
    location_name,
    cat_number,
    notes,
    esocial_date,
    esocial_involved,
    sesmt_involved,
    sesmt_date,
    created_by_username,
    account_owner_id,
    is_active,
    cancel_reason
  ) values (
    p_pessoa_id,
    p_data,
    coalesce(p_dias_perdidos, 0)::smallint,
    coalesce(p_dias_debitados, 0)::smallint,
    nullif(trim(p_cid), ''),
    p_centro_servico_id,
    p_local_id,
    nullif(trim(p_cat), ''),
    nullif(trim(p_observacao), ''),
    p_data_esocial,
    coalesce(p_esocial, false),
    coalesce(p_sesmt, false),
    p_data_sesmt,
    v_registrado_uuid,
    v_owner,
    true,
    null
  ) returning id into v_id;

  insert into public.accident_group_agents (
    accident_id,
    accident_agents_id,
    accident_type_id,
    accident_injuries_id,
    account_owner_id
  )
  select
    v_id,
    p_agente_id,
    t.id,
    l.id,
    v_owner
  from unnest(p_tipos_ids) with ordinality as t(id, ord)
  full join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
  where t.id is not null or l.id is not null;

  if p_partes_ids is not null and array_length(p_partes_ids, 1) > 0 then
    insert into public.accident_group_parts (
      accident_id,
      accident_parts_id,
      account_owner_id
    )
    select v_id, p.id, v_owner
      from unnest(p_partes_ids) with ordinality as p(id, ord)
     where p.id is not null;
  end if;

  return query
    select *
      from public.accidents a
     where a.id = v_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_acidentes_create_full(
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text
) from public;

grant execute on function public.rpc_acidentes_create_full(
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text
) to authenticated;

create or replace function public.rpc_acidentes_update_full(
  p_id uuid,
  p_pessoa_id uuid,
  p_data timestamptz,
  p_dias_perdidos numeric,
  p_dias_debitados numeric,
  p_cid text,
  p_centro_servico_id uuid,
  p_local_id uuid,
  p_cat text,
  p_observacao text,
  p_agente_id uuid,
  p_tipos_ids uuid[] default null,
  p_lesoes_ids uuid[] default null,
  p_partes_ids uuid[] default null,
  p_data_esocial timestamptz default null,
  p_esocial boolean default false,
  p_sesmt boolean default false,
  p_data_sesmt timestamptz default null,
  p_atualizado_por text default null,
  p_campos_alterados jsonb default '[]'::jsonb
) returns setof public.accidents
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_atualizado_uuid uuid;
  v_row_owner uuid;
  v_tipo_count int;
  v_lesao_count int;
  v_invalid boolean;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.accidents
   where id = p_id;

  if v_row_owner is null then
    raise exception 'acidente_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  begin
    v_atualizado_uuid := nullif(trim(p_atualizado_por), '')::uuid;
  exception
    when invalid_text_representation then
      v_atualizado_uuid := null;
  end;
  if v_atualizado_uuid is null then
    v_atualizado_uuid := auth.uid();
  end if;

  v_tipo_count := coalesce(array_length(p_tipos_ids, 1), 0);
  v_lesao_count := coalesce(array_length(p_lesoes_ids, 1), 0);
  if v_tipo_count = 0 then
    raise exception 'acidente_tipos_required' using errcode = 'P0001';
  end if;
  if v_lesao_count = 0 then
    raise exception 'acidente_lesoes_required' using errcode = 'P0001';
  end if;
  if p_agente_id is null then
    raise exception 'acidente_agente_required' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_tipos_ids) as t(id)
      left join public.acidente_tipos at on at.id = t.id and at.agente_id = p_agente_id
     where t.id is not null and at.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_tipos_invalidos' using errcode = 'P0001';
  end if;

  select exists(
    select 1
      from unnest(p_lesoes_ids) as l(id)
      left join public.acidente_lesoes al on al.id = l.id and al.agente_id = p_agente_id
     where l.id is not null and al.id is null
  ) into v_invalid;
  if coalesce(v_invalid, false) then
    raise exception 'acidente_lesoes_invalidas' using errcode = 'P0001';
  end if;

  if p_partes_ids is not null then
    select exists(
      select 1
        from unnest(p_partes_ids) as p(id)
        left join public.acidente_partes ap on ap.id = p.id
       where p.id is not null and ap.id is null
    ) into v_invalid;
    if coalesce(v_invalid, false) then
      raise exception 'acidente_partes_invalidas' using errcode = 'P0001';
    end if;
  end if;

  update public.accidents
     set people_id = p_pessoa_id,
         accident_date = p_data,
         lost_days = coalesce(p_dias_perdidos, 0)::smallint,
         debited_days = coalesce(p_dias_debitados, 0)::smallint,
         cid_code = nullif(trim(p_cid), ''),
         service_center = p_centro_servico_id,
         location_name = p_local_id,
         cat_number = nullif(trim(p_cat), ''),
         notes = nullif(trim(p_observacao), ''),
         esocial_date = p_data_esocial,
         esocial_involved = coalesce(p_esocial, false),
         sesmt_involved = coalesce(p_sesmt, false),
         sesmt_date = p_data_sesmt,
         updated_by_username = v_atualizado_uuid,
         updated_at = now()
   where id = p_id;

  delete from public.accident_group_agents where accident_id = p_id;
  insert into public.accident_group_agents (
    accident_id,
    accident_agents_id,
    accident_type_id,
    accident_injuries_id,
    account_owner_id
  )
  select
    p_id,
    p_agente_id,
    t.id,
    l.id,
    v_row_owner
  from unnest(p_tipos_ids) with ordinality as t(id, ord)
  full join unnest(p_lesoes_ids) with ordinality as l(id, ord) using (ord)
  where t.id is not null or l.id is not null;

  delete from public.accident_group_parts where accident_id = p_id;
  if p_partes_ids is not null and array_length(p_partes_ids, 1) > 0 then
    insert into public.accident_group_parts (
      accident_id,
      accident_parts_id,
      account_owner_id
    )
    select p_id, p.id, v_row_owner
      from unnest(p_partes_ids) with ordinality as p(id, ord)
     where p.id is not null;
  end if;

  if p_campos_alterados is not null
     and jsonb_typeof(p_campos_alterados) = 'array'
     and jsonb_array_length(p_campos_alterados) > 0 then
    insert into public.acidente_historico (
      acidente_id,
      data_edicao,
      usuario_responsavel,
      campos_alterados,
      account_owner_id
    ) values (
      p_id,
      now(),
      coalesce(nullif(trim(p_atualizado_por), ''), auth.uid()::text),
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select *
      from public.accidents a
     where a.id = p_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_acidentes_update_full(
  uuid,
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text,
  jsonb
) from public;

grant execute on function public.rpc_acidentes_update_full(
  uuid,
  uuid,
  timestamptz,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  timestamptz,
  boolean,
  boolean,
  timestamptz,
  text,
  jsonb
) to authenticated;

-- RPC de filtros baseado no novo modelo.
drop function if exists public.rpc_acidentes_filtros();
create or replace function public.rpc_acidentes_filtros()
returns table (
  centros_servico text[],
  tipos text[],
  lesoes text[],
  partes text[],
  agentes text[],
  cargos text[]
)
language sql
security definer
set search_path = public as $$
  with acidentes_base as (
    select
      a.id,
      cs.nome as centro_servico_nome,
      cg.nome as cargo_nome
    from public.accidents a
    left join public.centros_servico cs on cs.id = a.service_center
    left join public.pessoas p on p.id = a.people_id
    left join public.cargos cg on cg.id = p.cargo_id
    where a.accident_date is not null
      and coalesce(a.is_active, true) = true
      and coalesce(a.cancel_reason, '') is distinct from '__cancel_placeholder__'
  ),
  agentes as (
    select array(
      select distinct coalesce(nullif(trim(aa.nome), ''), 'Nao informado')
      from public.accident_group_agents aga
      join public.acidente_agentes aa on aa.id = aga.accident_agents_id
      join acidentes_base ab on ab.id = aga.accident_id
      order by 1
    ) as valores
  ),
  tipos as (
    select array(
      select distinct coalesce(nullif(trim(at.nome), ''), 'Nao informado')
      from public.accident_group_agents aga
      join public.acidente_tipos at on at.id = aga.accident_type_id
      join acidentes_base ab on ab.id = aga.accident_id
      order by 1
    ) as valores
  ),
  lesoes as (
    select array(
      select distinct coalesce(nullif(trim(al.nome), ''), 'Nao informado')
      from public.accident_group_agents aga
      join public.acidente_lesoes al on al.id = aga.accident_injuries_id
      join acidentes_base ab on ab.id = aga.accident_id
      order by 1
    ) as valores
  ),
  partes as (
    select array(
      select distinct coalesce(
        nullif(trim(concat_ws(' / ', pg.nome, sg.nome, ap.nome)), ''),
        'Nao informado'
      )
      from public.accident_group_parts agp
      join public.acidente_partes ap on ap.id = agp.accident_parts_id
      left join public.acidente_partes_grupo pg on pg.id = ap.grupo
      left join public.acidente_partes_sub_grupo sg on sg.id = ap.subgrupo
      join acidentes_base ab on ab.id = agp.accident_id
      order by 1
    ) as valores
  ),
  centros as (
    select array(
      select distinct coalesce(nullif(trim(ab.centro_servico_nome), ''), 'Nao informado')
      from acidentes_base ab
      order by 1
    ) as valores
  ),
  cargos as (
    select array(
      select distinct coalesce(nullif(trim(ab.cargo_nome), ''), 'Nao informado')
      from acidentes_base ab
      order by 1
    ) as valores
  )
  select
    coalesce((select valores from centros), array[]::text[]) as centros_servico,
    coalesce((select valores from tipos), array[]::text[]) as tipos,
    coalesce((select valores from lesoes), array[]::text[]) as lesoes,
    coalesce((select valores from partes), array[]::text[]) as partes,
    coalesce((select valores from agentes), array[]::text[]) as agentes,
    coalesce((select valores from cargos), array[]::text[]) as cargos;
$$;

grant execute on function public.rpc_acidentes_filtros() to anon, authenticated, service_role;

-- View para lista completa com IDs + labels (facilita o frontend).
drop view if exists public.vw_acidentes;
create view public.vw_acidentes as
with agentes_agg as (
  select
    aga.accident_id,
    (array_agg(aa.id order by aga.created_at, aga.id))[1] as agente_id,
    (array_agg(aa.nome order by aga.created_at, aga.id))[1] as agente_nome,
    array_agg(at.id order by aga.created_at, aga.id) as tipos_ids,
    array_agg(at.nome order by aga.created_at, aga.id) as tipos_nomes,
    array_agg(al.id order by aga.created_at, aga.id) as lesoes_ids,
    array_agg(al.nome order by aga.created_at, aga.id) as lesoes_nomes
  from public.accident_group_agents aga
  left join public.acidente_agentes aa on aa.id = aga.accident_agents_id
  left join public.acidente_tipos at on at.id = aga.accident_type_id
  left join public.acidente_lesoes al on al.id = aga.accident_injuries_id
  group by aga.accident_id
),
partes_agg as (
  select
    agp.accident_id,
    array_agg(ap.id order by agp.created_at, agp.id) as partes_ids,
    array_agg(
      concat_ws(' / ', pg.nome, sg.nome, ap.nome)
      order by agp.created_at, agp.id
    ) as partes_nomes
  from public.accident_group_parts agp
  join public.acidente_partes ap on ap.id = agp.accident_parts_id
  left join public.acidente_partes_grupo pg on pg.id = ap.grupo
  left join public.acidente_partes_sub_grupo sg on sg.id = ap.subgrupo
  group by agp.accident_id
)
select
  a.id,
  a.people_id,
  p.matricula,
  p.nome,
  cg.nome as cargo,
  a.accident_date as data,
  a.lost_days as dias_perdidos,
  a.debited_days as dias_debitados,
  a.cid_code as cid,
  a.cat_number as cat,
  a.notes as observacao,
  a.created_at as criado_em,
  a.updated_at as atualizado_em,
  a.created_by_username as registrado_por,
  a.updated_by_username as atualizado_por,
  a.esocial_date as data_esocial,
  a.esocial_involved as esocial,
  a.sesmt_involved as sesmt,
  a.sesmt_date as data_sesmt,
  a.is_active as ativo,
  a.cancel_reason as cancel_motivo,
  a.service_center as centro_servico_id,
  cs.nome as centro_servico,
  a.location_name as local_id,
  al.nome as local,
  ag.agente_id,
  ag.agente_nome,
  ag.tipos_ids,
  ag.tipos_nomes,
  ag.lesoes_ids,
  ag.lesoes_nomes,
  pa.partes_ids,
  pa.partes_nomes,
  a.account_owner_id
from public.accidents a
left join public.pessoas p on p.id = a.people_id
left join public.cargos cg on cg.id = p.cargo_id
left join public.centros_servico cs on cs.id = a.service_center
left join public.acidente_locais al on al.id = a.location_name
left join agentes_agg ag on ag.accident_id = a.id
left join partes_agg pa on pa.accident_id = a.id;

grant select on public.vw_acidentes to anon, authenticated, service_role;

-- Migracao dos dados de acidentes legados (acidentes -> accidents).
do $$
declare
  v_missing text;
begin
  if to_regclass('public.acidentes') is null then
    return;
  end if;

  insert into public.accidents (
    id,
    people_id,
    lost_days,
    debited_days,
    cid_code,
    cat_number,
    notes,
    created_at,
    updated_at,
    created_by_username,
    updated_by_username,
    sesmt_involved,
    location_name,
    hht_value,
    sesmt_date,
    esocial_date,
    accident_date,
    is_active,
    cancel_reason,
    account_owner_id,
    esocial_involved,
    service_center
  )
  select
    a.id,
    p.id,
    coalesce(a."diasPerdidos", 0)::smallint,
    coalesce(a."diasDebitados", 0)::smallint,
    a.cid,
    a.cat,
    a.observacao,
    a."criadoEm",
    a."atualizadoEm",
    a."registradoPor",
    a."atualizadoPor",
    coalesce(a.sesmt, false),
    al.id,
    case when a.hht is null then null else round(a.hht)::bigint end,
    a.data_sesmt,
    a.data_esocial,
    a.data,
    coalesce(a.ativo, true),
    nullif(trim(coalesce(to_jsonb(a)->>'cancelMotivo', to_jsonb(a)->>'cancel_motivo', '')), ''),
    a.account_owner_id,
    coalesce(a.data_esocial is not null, false),
    cs.id
  from public.acidentes a
  left join public.pessoas p on p.matricula = a.matricula
  left join public.centros_servico cs on lower(trim(cs.nome)) = lower(trim(a.centro_servico::text))
  left join public.acidente_locais al on lower(trim(al.nome)) = lower(trim(a.local::text))
  where not exists (select 1 from public.accidents x where x.id = a.id);

  select string_agg(distinct trim(a.agente), ', ')
    into v_missing
    from public.acidentes a
    left join public.acidente_agentes ag
      on lower(trim(ag.nome)) = lower(trim(a.agente))
   where trim(coalesce(a.agente, '')) <> ''
     and ag.id is null;

  if v_missing is not null then
    raise exception 'Agentes nao encontrados no catalogo: %', v_missing;
  end if;

  select string_agg(distinct trim(a.centro_servico::text), ', ')
    into v_missing
    from public.acidentes a
    left join public.centros_servico cs
      on lower(trim(cs.nome)) = lower(trim(a.centro_servico::text))
   where trim(coalesce(a.centro_servico::text, '')) <> ''
     and cs.id is null;

  if v_missing is not null then
    raise exception 'Centros de servico nao encontrados no catalogo: %', v_missing;
  end if;

  select string_agg(distinct trim(a.local::text), ', ')
    into v_missing
    from public.acidentes a
    left join public.acidente_locais al
      on lower(trim(al.nome)) = lower(trim(a.local::text))
   where trim(coalesce(a.local::text, '')) <> ''
     and al.id is null;

  if v_missing is not null then
    raise exception 'Locais nao encontrados no catalogo: %', v_missing;
  end if;

  select string_agg(distinct concat(trim(a.agente), ': ', trim(tipos.nome)), ', ')
    into v_missing
    from public.acidentes a
    join public.acidente_agentes ag
      on lower(trim(ag.nome)) = lower(trim(a.agente))
    join lateral (
      select row_number() over () as idx, valor as nome
      from unnest(regexp_split_to_array(coalesce(nullif(a.tipo, ''), ''), E'\\s*[;,]\\s*')) as valor
      where trim(valor) <> ''
    ) tipos on true
    left join public.acidente_tipos t
      on t.agente_id = ag.id
     and lower(trim(t.nome)) = lower(trim(tipos.nome))
   where trim(coalesce(a.tipo, '')) <> ''
     and t.id is null;

  if v_missing is not null then
    raise exception 'Tipos nao encontrados no catalogo (agente: tipo): %', v_missing;
  end if;

  select string_agg(distinct concat(trim(a.agente), ': ', trim(lesoes.nome)), ', ')
    into v_missing
    from public.acidentes a
    join public.acidente_agentes ag
      on lower(trim(ag.nome)) = lower(trim(a.agente))
    join lateral (
      select row_number() over () as idx, valor as nome
      from unnest(
        case
          when coalesce(array_length(a.lesoes, 1), 0) > 0 then a.lesoes
          else array[coalesce(nullif(trim(to_jsonb(a)->>'lesao'), ''), '')]
        end
      ) as valor
      where trim(valor) <> ''
    ) lesoes on true
    left join public.acidente_lesoes l
      on l.agente_id = ag.id
     and lower(trim(l.nome)) = lower(trim(lesoes.nome))
   where (
     trim(coalesce(to_jsonb(a)->>'lesao', '')) <> ''
     or coalesce(array_length(a.lesoes, 1), 0) > 0
   )
     and l.id is null;

  if v_missing is not null then
    raise exception 'Lesoes nao encontradas no catalogo (agente: lesao): %', v_missing;
  end if;

  select string_agg(distinct trim(partes.valor), ', ')
    into v_missing
    from public.acidentes a
    join lateral (
      select valor
      from unnest(
        case
          when coalesce(array_length(a.partes_lesionadas, 1), 0) > 0 then a.partes_lesionadas
          else array[coalesce(nullif(trim(to_jsonb(a)->>'parteLesionada'), ''), '')]
        end
      ) as valor
      where trim(valor) <> ''
    ) partes on true
    left join public.acidente_partes ap
      on lower(trim(ap.nome)) = lower(trim(partes.valor))
   where ap.id is null;

  if v_missing is not null then
    raise exception 'Partes lesionadas nao encontradas no catalogo: %', v_missing;
  end if;

end $$;

-- Vinculos agentes/tipos/lesoes (combinacao por indice).
insert into public.accident_group_agents (
  accident_id,
  accident_agents_id,
  accident_type_id,
  accident_injuries_id,
  account_owner_id
)
select
  a.id,
  ag.id,
  at.id,
  al.id,
  a.account_owner_id
from public.acidentes a
join public.acidente_agentes ag
  on lower(trim(ag.nome)) = lower(trim(a.agente))
join lateral (
  select
    coalesce(tipos.idx, lesoes.idx) as idx,
    tipos.nome as tipo_nome,
    lesoes.nome as lesao_nome
  from (
    select row_number() over () as idx, valor as nome
    from unnest(regexp_split_to_array(coalesce(nullif(a.tipo, ''), ''), E'\\s*[;,]\\s*')) as valor
    where trim(valor) <> ''
  ) tipos
  full join (
    select row_number() over () as idx, valor as nome
    from unnest(
      case
        when coalesce(array_length(a.lesoes, 1), 0) > 0 then a.lesoes
        else array[coalesce(nullif(trim(to_jsonb(a)->>'lesao'), ''), '')]
      end
    ) as valor
    where trim(valor) <> ''
  ) lesoes on lesoes.idx = tipos.idx
) pares on true
left join public.acidente_tipos at on at.agente_id = ag.id and lower(trim(at.nome)) = lower(trim(pares.tipo_nome))
left join public.acidente_lesoes al on al.agente_id = ag.id and lower(trim(al.nome)) = lower(trim(pares.lesao_nome))
where (pares.tipo_nome is not null or pares.lesao_nome is not null)
  and not exists (
  select 1
    from public.accident_group_agents aga
   where aga.accident_id = a.id
     and aga.accident_type_id is not distinct from at.id
     and aga.accident_injuries_id is not distinct from al.id
);

-- Vinculos partes lesionadas.
insert into public.accident_group_parts (
  accident_id,
  accident_parts_id,
  account_owner_id
)
select
  a.id,
  ap.id,
  a.account_owner_id
from public.acidentes a
join lateral (
  select row_number() over () as idx, valor
  from unnest(
    case
      when coalesce(array_length(a.partes_lesionadas, 1), 0) > 0 then a.partes_lesionadas
      else array[coalesce(nullif(trim(to_jsonb(a)->>'parteLesionada'), ''), '')]
    end
  ) as valor
  where trim(valor) <> ''
) partes on true
join public.acidente_partes ap on lower(trim(ap.nome)) = lower(trim(partes.valor))
where not exists (
  select 1
    from public.accident_group_parts agp
   where agp.accident_id = a.id
     and agp.accident_parts_id = ap.id
);

