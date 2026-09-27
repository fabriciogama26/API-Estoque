-- Stub minimo do ambiente Supabase para validar as migrations do Controle de Validades
-- em um PostgreSQL local e descartavel (NUNCA executar no projeto Supabase real).
--
-- Reproduz apenas o necessario:
--   - roles anon/authenticated/service_role;
--   - auth.uid() e auth.role() lidos de `request.jwt.claim.sub` / `request.jwt.claim.role`;
--   - tabelas de tenant (app_users, pessoas e catalogos), RBAC e inventory_report;
--   - my_owner_id(), current_account_owner_id(), is_master(), has_permission() e forecast_assert_owner_access()
--     com a mesma semantica das migrations do projeto.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
  );
$$;

create table if not exists public.app_users (
  id uuid primary key,
  username text,
  display_name text,
  email text,
  ativo boolean default true,
  credential text,
  parent_user_id uuid
);

create table if not exists public.app_users_dependentes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  owner_app_user_id uuid references public.app_users(id),
  username text,
  display_name text,
  email text,
  ativo boolean default true
);

create or replace function public.current_account_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select d.owner_app_user_id from public.app_users_dependentes d where d.auth_user_id = auth.uid() limit 1),
    (select coalesce(u.parent_user_id, u.id) from public.app_users u where u.id = auth.uid())
  );
$$;

create or replace function public.my_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_owner_id();
$$;

create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  account_owner_id uuid references public.app_users(id)
);

create table if not exists public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  account_owner_id uuid references public.app_users(id)
);

create table if not exists public.centros_servico (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  centro_custo_id uuid references public.centros_custo(id),
  account_owner_id uuid references public.app_users(id)
);

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  centro_servico_id uuid references public.centros_servico(id),
  account_owner_id uuid references public.app_users(id)
);

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text,
  "dataAdmissao" timestamptz,
  "dataDemissao" timestamptz,
  centro_servico_id uuid references public.centros_servico(id),
  setor_id uuid references public.setores(id),
  cargo_id uuid references public.cargos(id),
  centro_custo_id uuid references public.centros_custo(id),
  ativo boolean default true,
  account_owner_id uuid references public.app_users(id)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

create table if not exists public.role_permissions (
  role_id uuid references public.roles(id),
  permission_id uuid references public.permissions(id),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid,
  role_id uuid references public.roles(id),
  scope_parent_user_id uuid,
  primary key (user_id, role_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid,
  permission_key text,
  allowed boolean,
  primary key (user_id, permission_key)
);

create table if not exists public.inventory_report (
  id uuid not null default gen_random_uuid() primary key,
  account_owner_id uuid not null references public.app_users(id),
  created_at timestamptz not null default now(),
  created_by uuid null,
  periodo_inicio date not null,
  periodo_fim date not null,
  termo text not null default '',
  metadados jsonb not null default '{}'::jsonb,
  email_status text null,
  email_enviado_em timestamptz null,
  email_erro text null,
  email_tentativas integer not null default 0
);

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and lower(r.name) = 'master'
  );
$$;

-- Placeholder: a migration 20260929_01 recria com o mapa completo.
create or replace function public.expand_permission_dependencies(p_permissions text[])
returns text[]
language sql
immutable
as $$
  select coalesce(p_permissions, '{}'::text[]);
$$;

-- Copia de supabase/migrations/20260305_expand_permission_dependencies.sql
-- (unica diferenca: `any(coalesce(...))` para o parser do PostgreSQL 18 local tratar como array).
create or replace function public.has_permission(p_key text, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  with is_master as (
    select exists(
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = coalesce(p_user_id, auth.uid())
        and lower(r.name) = 'master'
    ) as master_flag
  ),
  override as (
    select allowed
    from public.user_permission_overrides o
    where o.user_id = coalesce(p_user_id, auth.uid())
      and o.permission_key = p_key
    limit 1
  ),
  role_perm as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = coalesce(p_user_id, auth.uid())
  ),
  overrides as (
    select permission_key, allowed
    from public.user_permission_overrides
    where user_id = coalesce(p_user_id, auth.uid())
  ),
  merged as (
    select key
    from role_perm
    where key not in (
      select permission_key from overrides where allowed = false
    )
    union
    select permission_key
    from overrides
    where allowed = true
  ),
  effective as (
    select case
      when (select master_flag from is_master) then array(select key from public.permissions)
      else public.expand_permission_dependencies(coalesce(array(select key from merged), '{}'::text[]))
    end as permissions
  )
  select case
    when exists(select 1 from override where allowed = false) then false
    when exists(select 1 from override where allowed = true) then true
    else coalesce(p_key = any(coalesce((select permissions from effective), '{}'::text[])), false)
  end;
$$;

-- Copia de supabase/migrations/20260926_secure_forecast_purchase_rpcs.sql
create or replace function public.forecast_assert_owner_access(p_owner_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  if p_owner_id is null then
    raise exception 'p_owner_id obrigatorio.' using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') = 'service_role' or public.is_master() then
    return;
  end if;

  v_owner := public.my_owner_id();

  if v_owner is null then
    raise exception 'Owner da sessao nao resolvido.' using errcode = '42501';
  end if;

  if p_owner_id <> v_owner then
    raise exception 'Acesso negado ao owner informado.' using errcode = '42501';
  end if;
end;
$$;

grant select on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on all functions in schema auth to authenticated, service_role, anon;

insert into public.roles (name) values ('master'), ('admin'), ('operador'), ('visitante')
on conflict (name) do nothing;

insert into public.permissions (key, description) values
  ('pessoas.read', 'Pessoas - Ler'),
  ('pessoas.write', 'Pessoas - Alterar'),
  ('estoque.read', 'Estoque - Ler')
on conflict (key) do nothing;
