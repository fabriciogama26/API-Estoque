-- Cadastro Base: colunas de auditoria, historico unificado e permissoes.
-- Observacao: validacao de dependencia vazia entre tabelas sera criada em migration futura.

set check_function_bodies = off;

-- Permissoes do cadastro base
insert into public.permissions (key, description) values
  ('basic_registration.read', 'Cadastro base - ler'),
  ('basic_registration.write', 'Cadastro base - alterar')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('basic_registration.read', 'basic_registration.write')
where lower(r.name) in ('master', 'admin', 'owner')
on conflict do nothing;

-- Colunas adicionais (mantem colunas existentes em pt-br)
alter table if exists public.fabricantes
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

alter table if exists public.cargos
  add column if not exists updated_at timestamp with time zone,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

alter table if exists public.centros_custo
  add column if not exists updated_at timestamp with time zone,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

alter table if exists public.centros_servico
  add column if not exists updated_at timestamp with time zone,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

alter table if exists public.centros_estoque
  add column if not exists updated_at timestamp with time zone,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

alter table if exists public.setores
  add column if not exists updated_at timestamp with time zone,
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid,
  add column if not exists account_owner_id uuid not null default public.my_owner_id();

-- Backfill de auditoria (usar valores existentes quando houver)
update public.fabricantes
   set created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

update public.cargos
   set updated_at = coalesce(updated_at, criado_em, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

update public.centros_custo
   set updated_at = coalesce(updated_at, criado_em, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

update public.centros_servico
   set updated_at = coalesce(updated_at, criado_em, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

update public.centros_estoque
   set updated_at = coalesce(updated_at, created_at, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

update public.setores
   set updated_at = coalesce(updated_at, criado_em, now()),
       account_owner_id = coalesce(account_owner_id, public.my_owner_id());

-- FKs para auditoria e owner (se existirem colunas)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fabricantes' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'fabricantes_account_owner_id_fkey') then
    alter table public.fabricantes add constraint fabricantes_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cargos' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'cargos_account_owner_id_fkey') then
    alter table public.cargos add constraint cargos_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_custo' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_custo_account_owner_id_fkey') then
    alter table public.centros_custo add constraint centros_custo_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_servico' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_servico_account_owner_id_fkey') then
    alter table public.centros_servico add constraint centros_servico_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_estoque' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_estoque_account_owner_id_fkey') then
    alter table public.centros_estoque add constraint centros_estoque_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'setores' and column_name = 'account_owner_id')
    and not exists (select 1 from pg_constraint where conname = 'setores_account_owner_id_fkey') then
    alter table public.setores add constraint setores_account_owner_id_fkey foreign key (account_owner_id) references public.app_users(id);
  end if;
end $$;

-- FKs para usuario criador/atualizador
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fabricantes' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'fabricantes_created_by_user_id_fkey') then
    alter table public.fabricantes add constraint fabricantes_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fabricantes' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'fabricantes_updated_by_user_id_fkey') then
    alter table public.fabricantes add constraint fabricantes_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cargos' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'cargos_created_by_user_id_fkey') then
    alter table public.cargos add constraint cargos_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cargos' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'cargos_updated_by_user_id_fkey') then
    alter table public.cargos add constraint cargos_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_custo' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_custo_created_by_user_id_fkey') then
    alter table public.centros_custo add constraint centros_custo_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_custo' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_custo_updated_by_user_id_fkey') then
    alter table public.centros_custo add constraint centros_custo_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_servico' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_servico_created_by_user_id_fkey') then
    alter table public.centros_servico add constraint centros_servico_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_servico' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_servico_updated_by_user_id_fkey') then
    alter table public.centros_servico add constraint centros_servico_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_estoque' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_estoque_created_by_user_id_fkey') then
    alter table public.centros_estoque add constraint centros_estoque_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'centros_estoque' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'centros_estoque_updated_by_user_id_fkey') then
    alter table public.centros_estoque add constraint centros_estoque_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'setores' and column_name = 'created_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'setores_created_by_user_id_fkey') then
    alter table public.setores add constraint setores_created_by_user_id_fkey foreign key (created_by_user_id) references public.app_users(id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'setores' and column_name = 'updated_by_user_id')
    and not exists (select 1 from pg_constraint where conname = 'setores_updated_by_user_id_fkey') then
    alter table public.setores add constraint setores_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.app_users(id);
  end if;
end $$;

-- Auditoria: atualiza datas/usuarios
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
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
    if new.account_owner_id is null then
      new.account_owner_id = public.my_owner_id();
    end if;
  else
    new.updated_at = now();
    new.updated_by_user_id = coalesce(auth.uid(), new.updated_by_user_id, old.updated_by_user_id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists fabricantes_basic_registration_audit on public.fabricantes;
create trigger fabricantes_basic_registration_audit
  before insert or update on public.fabricantes
  for each row execute function public.basic_registration_audit_fabricantes();

drop trigger if exists centros_estoque_basic_registration_audit on public.centros_estoque;
create trigger centros_estoque_basic_registration_audit
  before insert or update on public.centros_estoque
  for each row execute function public.basic_registration_audit_centros_estoque();

drop trigger if exists cargos_basic_registration_audit on public.cargos;
create trigger cargos_basic_registration_audit
  before insert or update on public.cargos
  for each row execute function public.basic_registration_audit_cargos();

drop trigger if exists centros_custo_basic_registration_audit on public.centros_custo;
create trigger centros_custo_basic_registration_audit
  before insert or update on public.centros_custo
  for each row execute function public.basic_registration_audit_centros_custo();

drop trigger if exists centros_servico_basic_registration_audit on public.centros_servico;
create trigger centros_servico_basic_registration_audit
  before insert or update on public.centros_servico
  for each row execute function public.basic_registration_audit_centros_servico();

drop trigger if exists setores_basic_registration_audit on public.setores;
create trigger setores_basic_registration_audit
  before insert or update on public.setores
  for each row execute function public.basic_registration_audit_setores();

-- Historico unificado
create table if not exists public.basic_registration_history (
  id uuid not null default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  record_name text,
  action text not null,
  changed_fields text[] not null default '{}'::text[],
  before jsonb,
  after jsonb,
  record_created_at timestamp with time zone,
  record_updated_at timestamp with time zone,
  record_created_by_user_id uuid,
  record_updated_by_user_id uuid,
  changed_by_user_id uuid,
  created_at timestamp with time zone not null default now(),
  account_owner_id uuid not null default public.my_owner_id(),
  constraint basic_registration_history_pkey primary key (id)
);

create index if not exists basic_registration_history_table_record_idx
  on public.basic_registration_history (table_name, record_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'basic_registration_history_account_owner_id_fkey') then
    alter table public.basic_registration_history
      add constraint basic_registration_history_account_owner_id_fkey
      foreign key (account_owner_id) references public.app_users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'basic_registration_history_changed_by_user_id_fkey') then
    alter table public.basic_registration_history
      add constraint basic_registration_history_changed_by_user_id_fkey
      foreign key (changed_by_user_id) references public.app_users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'basic_registration_history_created_by_user_id_fkey') then
    alter table public.basic_registration_history
      add constraint basic_registration_history_created_by_user_id_fkey
      foreign key (record_created_by_user_id) references public.app_users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'basic_registration_history_updated_by_user_id_fkey') then
    alter table public.basic_registration_history
      add constraint basic_registration_history_updated_by_user_id_fkey
      foreign key (record_updated_by_user_id) references public.app_users(id);
  end if;
end $$;

create or replace function public.basic_registration_log_changes()
returns trigger as $$
declare
  old_row jsonb;
  new_row jsonb;
  old_base jsonb;
  new_base jsonb;
  fields text[];
  record_id uuid;
  record_name text;
  record_created_at timestamp with time zone;
  record_updated_at timestamp with time zone;
  record_created_by uuid;
  record_updated_by uuid;
  actor uuid;
  action_label text;
  owner_id uuid;
begin
  if tg_op = 'INSERT' then
    new_row = to_jsonb(new);
    old_row = null;
    action_label = 'INSERT';
  elsif tg_op = 'UPDATE' then
    new_row = to_jsonb(new);
    old_row = to_jsonb(old);
    action_label = 'UPDATE';
  else
    new_row = null;
    old_row = to_jsonb(old);
    action_label = 'DELETE';
  end if;

  old_base = coalesce(old_row, '{}'::jsonb)
    - 'updated_at' - 'updated_by_user_id' - 'created_at' - 'created_by_user_id'
    - 'criado_em' - 'account_owner_id';
  new_base = coalesce(new_row, '{}'::jsonb)
    - 'updated_at' - 'updated_by_user_id' - 'created_at' - 'created_by_user_id'
    - 'criado_em' - 'account_owner_id';

  if action_label = 'UPDATE' and old_base is not distinct from new_base then
    return new;
  end if;

  select array_agg(key order by key) into fields
  from (
    select key from jsonb_each(coalesce(old_base, '{}'::jsonb))
    union
    select key from jsonb_each(coalesce(new_base, '{}'::jsonb))
  ) keys
  where (coalesce(old_base, '{}'::jsonb)->key) is distinct from (coalesce(new_base, '{}'::jsonb)->key);

  record_id = coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  record_name = coalesce(new_row->>'nome', new_row->>'fabricante', new_row->>'almox', old_row->>'nome', old_row->>'fabricante', old_row->>'almox');
  record_created_at = coalesce(
    (new_row->>'created_at')::timestamp with time zone,
    (new_row->>'criado_em')::timestamp with time zone,
    (old_row->>'created_at')::timestamp with time zone,
    (old_row->>'criado_em')::timestamp with time zone
  );
  record_updated_at = coalesce(
    (new_row->>'updated_at')::timestamp with time zone,
    (old_row->>'updated_at')::timestamp with time zone,
    record_created_at
  );
  record_created_by = coalesce((new_row->>'created_by_user_id')::uuid, (old_row->>'created_by_user_id')::uuid);
  record_updated_by = coalesce((new_row->>'updated_by_user_id')::uuid, (old_row->>'updated_by_user_id')::uuid);
  actor = auth.uid();
  owner_id = coalesce((new_row->>'account_owner_id')::uuid, (old_row->>'account_owner_id')::uuid, public.my_owner_id());

  insert into public.basic_registration_history (
    table_name,
    record_id,
    record_name,
    action,
    changed_fields,
    before,
    after,
    record_created_at,
    record_updated_at,
    record_created_by_user_id,
    record_updated_by_user_id,
    changed_by_user_id,
    account_owner_id
  )
  values (
    tg_table_name,
    record_id,
    record_name,
    action_label,
    coalesce(fields, '{}'::text[]),
    old_row,
    new_row,
    record_created_at,
    record_updated_at,
    record_created_by,
    record_updated_by,
    actor,
    owner_id
  );

  if action_label = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists basic_registration_log_fabricantes on public.fabricantes;
create trigger basic_registration_log_fabricantes
  after insert or update or delete on public.fabricantes
  for each row execute function public.basic_registration_log_changes();

drop trigger if exists basic_registration_log_cargos on public.cargos;
create trigger basic_registration_log_cargos
  after insert or update or delete on public.cargos
  for each row execute function public.basic_registration_log_changes();

drop trigger if exists basic_registration_log_centros_custo on public.centros_custo;
create trigger basic_registration_log_centros_custo
  after insert or update or delete on public.centros_custo
  for each row execute function public.basic_registration_log_changes();

drop trigger if exists basic_registration_log_centros_servico on public.centros_servico;
create trigger basic_registration_log_centros_servico
  after insert or update or delete on public.centros_servico
  for each row execute function public.basic_registration_log_changes();

drop trigger if exists basic_registration_log_centros_estoque on public.centros_estoque;
create trigger basic_registration_log_centros_estoque
  after insert or update or delete on public.centros_estoque
  for each row execute function public.basic_registration_log_changes();

drop trigger if exists basic_registration_log_setores on public.setores;
create trigger basic_registration_log_setores
  after insert or update or delete on public.setores
  for each row execute function public.basic_registration_log_changes();

-- RLS e policies
alter table if exists public.basic_registration_history enable row level security;

drop policy if exists basic_registration_history_select_owner on public.basic_registration_history;
create policy basic_registration_history_select_owner
  on public.basic_registration_history
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('basic_registration.read'::text) or public.has_permission('basic_registration.write'::text))
  );

drop policy if exists basic_registration_history_insert_owner on public.basic_registration_history;
create policy basic_registration_history_insert_owner
  on public.basic_registration_history
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('basic_registration.write'::text))
  );

-- Atualiza policies das tabelas base para incluir permissoes do cadastro base
drop policy if exists cargos_select_owner on public.cargos;
create policy cargos_select_owner
  on public.cargos
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists cargos_insert_owner on public.cargos;
create policy cargos_insert_owner
  on public.cargos
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists cargos_update_owner on public.cargos;
create policy cargos_update_owner
  on public.cargos
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists setores_select_owner on public.setores;
create policy setores_select_owner
  on public.setores
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists setores_insert_owner on public.setores;
create policy setores_insert_owner
  on public.setores
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists setores_update_owner on public.setores;
create policy setores_update_owner
  on public.setores
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_servico_select_owner on public.centros_servico;
create policy centros_servico_select_owner
  on public.centros_servico
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.read'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_servico_insert_owner on public.centros_servico;
create policy centros_servico_insert_owner
  on public.centros_servico
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_servico_update_owner on public.centros_servico;
create policy centros_servico_update_owner
  on public.centros_servico
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_custo_select_owner on public.centros_custo;
create policy centros_custo_select_owner
  on public.centros_custo
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.read'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_custo_insert_owner on public.centros_custo;
create policy centros_custo_insert_owner
  on public.centros_custo
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_custo_update_owner on public.centros_custo;
create policy centros_custo_update_owner
  on public.centros_custo
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_estoque_select_owner on public.centros_estoque;
create policy centros_estoque_select_owner
  on public.centros_estoque
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.read'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_estoque_insert_owner on public.centros_estoque;
create policy centros_estoque_insert_owner
  on public.centros_estoque
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists centros_estoque_update_owner on public.centros_estoque;
create policy centros_estoque_update_owner
  on public.centros_estoque
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists fabricantes_select_owner on public.fabricantes;
create policy fabricantes_select_owner
  on public.fabricantes
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.read'::text)
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.materiais'::text)
      or public.has_permission('basic_registration.read'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists fabricantes_insert_owner on public.fabricantes;
create policy fabricantes_insert_owner
  on public.fabricantes
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.materiais'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );

drop policy if exists fabricantes_update_owner on public.fabricantes;
create policy fabricantes_update_owner
  on public.fabricantes
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.materiais'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.materiais'::text)
      or public.has_permission('basic_registration.write'::text)
    )
  );
