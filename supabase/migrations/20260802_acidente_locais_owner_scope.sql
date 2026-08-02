-- Torna o catalogo de locais de acidente isolado por tenant.
-- Mantem acidentes existentes remapeando cada FK para uma copia do local no owner correto.

set check_function_bodies = off;

alter table if exists public.acidente_locais
  add column if not exists updated_at timestamptz,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text,
  add column if not exists account_owner_id uuid;

alter table if exists public.acidente_locais
  alter column updated_at set default now();

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'acidente_locais'
       and column_name = 'ordem'
  ) then
    alter table public.acidente_locais alter column ordem drop not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'acidente_locais_nome_unique'
       and conrelid = 'public.acidente_locais'::regclass
  ) then
    alter table public.acidente_locais drop constraint acidente_locais_nome_unique;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'acidente_locais_account_owner_id_fkey'
  ) then
    alter table public.acidente_locais
      add constraint acidente_locais_account_owner_id_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'acidente_locais_created_by_user_id_fkey'
  ) then
    alter table public.acidente_locais
      add constraint acidente_locais_created_by_user_id_fkey
      foreign key (created_by_user_id) references public.app_users(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'acidente_locais_updated_by_user_id_fkey'
  ) then
    alter table public.acidente_locais
      add constraint acidente_locais_updated_by_user_id_fkey
      foreign key (updated_by_user_id) references public.app_users(id);
  end if;
end $$;

with owners as (
  select distinct coalesce(parent_user_id, id) as owner_id
    from public.app_users
   where coalesce(parent_user_id, id) is not null
  union
  select distinct owner_app_user_id
    from public.app_users_dependentes
   where owner_app_user_id is not null
  union
  select distinct account_owner_id
    from public.accidents
   where account_owner_id is not null
),
source_locais as (
  select distinct on (lower(btrim(nome)))
    nome,
    ativo,
    coalesce(criado_em, now()) as criado_em
  from public.acidente_locais
  where account_owner_id is null
    and nullif(btrim(nome), '') is not null
  order by lower(btrim(nome)), account_owner_id nulls first, criado_em nulls last
)
insert into public.acidente_locais (
  nome,
  ativo,
  criado_em,
  updated_at,
  account_owner_id
)
select
  s.nome,
  coalesce(s.ativo, true),
  s.criado_em,
  now(),
  o.owner_id
from owners o
cross join source_locais s
where not exists (
  select 1
    from public.acidente_locais l
   where l.account_owner_id = o.owner_id
     and lower(btrim(l.nome)) = lower(btrim(s.nome))
);

update public.accidents a
   set location_name = scoped.id
  from public.acidente_locais atual,
       public.acidente_locais scoped
 where a.location_name = atual.id
   and scoped.account_owner_id = a.account_owner_id
   and lower(btrim(scoped.nome)) = lower(btrim(atual.nome))
   and a.account_owner_id is not null
   and atual.account_owner_id is distinct from a.account_owner_id;

delete from public.acidente_locais l
 where l.account_owner_id is null
   and not exists (
     select 1
       from public.accidents a
      where a.location_name = l.id
   );

do $$
begin
  if exists (
    select 1 from public.acidente_locais where account_owner_id is null
  ) then
    raise exception 'acidente_locais_unscoped_remaining';
  end if;
end $$;

alter table if exists public.acidente_locais
  alter column account_owner_id set default public.my_owner_id(),
  alter column account_owner_id set not null;

drop index if exists public.acidente_locais_ordem_idx;
create index if not exists acidente_locais_owner_nome_idx
  on public.acidente_locais (account_owner_id, ativo desc, nome asc);

with ref_counts as (
  select location_name as id, count(*) as refs
    from public.accidents
   where location_name is not null
   group by location_name
),
ranked as (
  select
    l.id,
    first_value(l.id) over (
      partition by l.account_owner_id, lower(btrim(l.nome))
      order by coalesce(r.refs, 0) desc, l.criado_em asc nulls last, l.id
    ) as keep_id,
    row_number() over (
      partition by l.account_owner_id, lower(btrim(l.nome))
      order by coalesce(r.refs, 0) desc, l.criado_em asc nulls last, l.id
    ) as rn
  from public.acidente_locais l
  left join ref_counts r on r.id = l.id
  where l.account_owner_id is not null
)
update public.accidents a
   set location_name = ranked.keep_id
  from ranked
 where ranked.rn > 1
   and a.location_name = ranked.id;

with ref_counts as (
  select location_name as id, count(*) as refs
    from public.accidents
   where location_name is not null
   group by location_name
),
ranked as (
  select
    l.id,
    row_number() over (
      partition by l.account_owner_id, lower(btrim(l.nome))
      order by coalesce(r.refs, 0) desc, l.criado_em asc nulls last, l.id
    ) as rn
  from public.acidente_locais l
  left join ref_counts r on r.id = l.id
  where l.account_owner_id is not null
)
delete from public.acidente_locais l
 using ranked
 where ranked.rn > 1
   and l.id = ranked.id;

create unique index if not exists acidente_locais_owner_nome_unique
  on public.acidente_locais (account_owner_id, lower(btrim(nome)));

create or replace function public.basic_registration_audit_acidente_locais()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_em is null then
      new.criado_em = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.criado_em, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists acidente_locais_basic_registration_audit on public.acidente_locais;
create trigger acidente_locais_basic_registration_audit
  before insert or update on public.acidente_locais
  for each row execute function public.basic_registration_audit_acidente_locais();

drop trigger if exists basic_registration_log_acidente_locais on public.acidente_locais;
create trigger basic_registration_log_acidente_locais
  after insert or update or delete on public.acidente_locais
  for each row execute function public.basic_registration_log_changes();

create or replace function public.validate_accident_location_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_local_owner uuid;
begin
  if new.location_name is null then
    return new;
  end if;

  select l.account_owner_id
    into v_local_owner
    from public.acidente_locais l
   where l.id = new.location_name;

  if v_local_owner is null then
    raise exception 'acidente_local_invalido' using errcode = 'P0001';
  end if;

  if new.account_owner_id is null or v_local_owner <> new.account_owner_id then
    raise exception 'acidente_local_owner_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists accidents_validate_location_owner on public.accidents;
create trigger accidents_validate_location_owner
  before insert or update of location_name, account_owner_id on public.accidents
  for each row execute function public.validate_accident_location_owner();

alter table if exists public.acidente_locais enable row level security;
alter table if exists public.acidente_locais no force row level security;

drop policy if exists acidente_locais_select_authenticated on public.acidente_locais;
drop policy if exists acidente_locais_select_anon on public.acidente_locais;
drop policy if exists acidente_locais_write_service_role on public.acidente_locais;
drop policy if exists acidente_locais_public_select on public.acidente_locais;
drop policy if exists acidente_locais_no_insert on public.acidente_locais;
drop policy if exists acidente_locais_no_update on public.acidente_locais;
drop policy if exists acidente_locais_no_delete on public.acidente_locais;
drop policy if exists acidente_locais_select_owner on public.acidente_locais;
drop policy if exists acidente_locais_insert_owner on public.acidente_locais;
drop policy if exists acidente_locais_update_owner on public.acidente_locais;

create policy acidente_locais_select_owner
  on public.acidente_locais
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('acidentes.read'::text)
      or public.has_permission('acidentes.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

create policy acidente_locais_insert_owner
  on public.acidente_locais
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('basic_registration.write'::text))
  );

create policy acidente_locais_update_owner
  on public.acidente_locais
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('basic_registration.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('basic_registration.write'::text))
  );

grant select, insert, update on public.acidente_locais to authenticated;
grant all on public.acidente_locais to service_role;

create or replace function public.rpc_catalog_list(p_table text)
returns table (id uuid, nome text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_table text := lower(trim(p_table));
  v_caller_id uuid := auth.uid();
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := coalesce(public.is_master(), false);
  v_col text := 'nome';
  v_owner_table boolean := v_table = any (array[
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'acidente_locais'
  ]);
begin
  if v_table not in (
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'fabricantes',
    'acidente_locais',
    'tipo_execucao'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_caller_id is null then
    raise exception 'Nao autenticado.';
  end if;

  if v_table = 'centros_estoque' then
    v_col := 'almox';
  end if;
  if v_table = 'fabricantes' then
    v_col := 'fabricante';
  end if;

  if v_owner_table then
    if v_is_master then
      return query execute format(
        'select id, %I as nome from public.%I where coalesce(ativo, true) = true order by %I',
        v_col,
        v_table,
        v_col
      );
    end if;

    if v_owner is null then
      raise exception 'Owner nao identificado para usuario %.', v_caller_id;
    end if;

    return query execute format(
      'select id, %I as nome from public.%I where account_owner_id = $1 and coalesce(ativo, true) = true order by %I',
      v_col,
      v_table,
      v_col
    ) using v_owner;
  end if;

  return query execute format(
    'select id, %I as nome from public.%I where coalesce(ativo, true) = true order by %I',
    v_col,
    v_table,
    v_col
  );
end;
$$;

revoke all on function public.rpc_catalog_list(text) from public;
grant execute on function public.rpc_catalog_list(text) to authenticated;
