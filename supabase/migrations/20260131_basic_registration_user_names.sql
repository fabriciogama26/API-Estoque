-- Adiciona nomes de usuario nas tabelas base e atualiza auditoria.

-- Colunas para nome do usuario.
alter table if exists public.fabricantes
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

alter table if exists public.cargos
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

alter table if exists public.centros_custo
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

alter table if exists public.centros_servico
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

alter table if exists public.centros_estoque
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

alter table if exists public.setores
  add column if not exists created_by_user_name text,
  add column if not exists updated_by_user_name text;

create or replace function public.resolve_current_user_label()
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_label text;
begin
  if v_uid is null then
    return null;
  end if;

  select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, ''))
    into v_label
  from public.app_users_dependentes
  where auth_user_id = v_uid and ativo is not false
  limit 1;

  if v_label is not null then
    return v_label;
  end if;

  select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, ''))
    into v_label
  from public.app_users
  where id = v_uid
  limit 1;

  return v_label;
end;
$$;

-- Atualiza funcoes de auditoria para preencher nomes.
create or replace function public.basic_registration_audit_fabricantes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.created_at is null then
      new.created_at = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.basic_registration_audit_centros_estoque()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.created_at is null then
      new.created_at = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.basic_registration_audit_cargos()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_em is null then
      new.criado_em = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.criado_em, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.basic_registration_audit_centros_custo()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_em is null then
      new.criado_em = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.criado_em, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.basic_registration_audit_centros_servico()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_em is null then
      new.criado_em = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.criado_em, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.basic_registration_audit_setores()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_em is null then
      new.criado_em = now();
    end if;
    new.updated_at = coalesce(new.updated_at, new.criado_em, now());
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id = coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid());
    new.created_by_user_name = coalesce(new.created_by_user_name, public.resolve_current_user_label());
    new.updated_by_user_name = coalesce(new.updated_by_user_name, new.created_by_user_name, public.resolve_current_user_label());
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
    new.updated_by_user_name = coalesce(public.resolve_current_user_label(), new.updated_by_user_name, old.updated_by_user_name);
  end if;
  return new;
end;
$$ language plpgsql;

-- Backfill para nomes de usuario quando possivel.
update public.fabricantes f
set created_by_user_name = coalesce(
  f.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = f.account_owner_id)
)
from public.app_users u
where u.id = f.created_by_user_id
  and (f.created_by_user_name is null or f.created_by_user_name = '');

update public.fabricantes f
set updated_by_user_name = coalesce(
  f.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = f.account_owner_id)
)
from public.app_users u
where u.id = f.updated_by_user_id
  and (f.updated_by_user_name is null or f.updated_by_user_name = '');

update public.cargos c
set created_by_user_name = coalesce(
  c.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = c.account_owner_id)
)
from public.app_users u
where u.id = c.created_by_user_id
  and (c.created_by_user_name is null or c.created_by_user_name = '');

update public.cargos c
set updated_by_user_name = coalesce(
  c.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = c.account_owner_id)
)
from public.app_users u
where u.id = c.updated_by_user_id
  and (c.updated_by_user_name is null or c.updated_by_user_name = '');

update public.centros_custo cc
set created_by_user_name = coalesce(
  cc.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = cc.account_owner_id)
)
from public.app_users u
where u.id = cc.created_by_user_id
  and (cc.created_by_user_name is null or cc.created_by_user_name = '');

update public.centros_custo cc
set updated_by_user_name = coalesce(
  cc.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = cc.account_owner_id)
)
from public.app_users u
where u.id = cc.updated_by_user_id
  and (cc.updated_by_user_name is null or cc.updated_by_user_name = '');

update public.centros_servico cs
set created_by_user_name = coalesce(
  cs.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = cs.account_owner_id)
)
from public.app_users u
where u.id = cs.created_by_user_id
  and (cs.created_by_user_name is null or cs.created_by_user_name = '');

update public.centros_servico cs
set updated_by_user_name = coalesce(
  cs.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = cs.account_owner_id)
)
from public.app_users u
where u.id = cs.updated_by_user_id
  and (cs.updated_by_user_name is null or cs.updated_by_user_name = '');

update public.centros_estoque ce
set created_by_user_name = coalesce(
  ce.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = ce.account_owner_id)
)
from public.app_users u
where u.id = ce.created_by_user_id
  and (ce.created_by_user_name is null or ce.created_by_user_name = '');

update public.centros_estoque ce
set updated_by_user_name = coalesce(
  ce.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = ce.account_owner_id)
)
from public.app_users u
where u.id = ce.updated_by_user_id
  and (ce.updated_by_user_name is null or ce.updated_by_user_name = '');

update public.setores s
set created_by_user_name = coalesce(
  s.created_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = s.account_owner_id)
)
from public.app_users u
where u.id = s.created_by_user_id
  and (s.created_by_user_name is null or s.created_by_user_name = '');

update public.setores s
set updated_by_user_name = coalesce(
  s.updated_by_user_name,
  u.username,
  u.display_name,
  u.email,
  (select coalesce(nullif(username, ''), nullif(display_name, ''), nullif(email, '')) from public.app_users uo where uo.id = s.account_owner_id)
)
from public.app_users u
where u.id = s.updated_by_user_id
  and (s.updated_by_user_name is null or s.updated_by_user_name = '');
