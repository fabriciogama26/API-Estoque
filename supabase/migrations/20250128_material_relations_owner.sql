-- Adiciona account_owner_id aos vinculos de material (cores e caracteristicas)
-- e aplica RLS por owner, mantendo triggers para preencher o owner automaticamente.

-- 1) Colunas e backfill
alter table public.material_grupo_cor
  add column if not exists account_owner_id uuid;

alter table public.material_grupo_caracteristica_epi
  add column if not exists account_owner_id uuid;

update public.material_grupo_cor mgc
set account_owner_id = m.account_owner_id
from public.materiais m
where m.id = mgc.material_id
  and mgc.account_owner_id is null;

update public.material_grupo_caracteristica_epi mgce
set account_owner_id = m.account_owner_id
from public.materiais m
where m.id = mgce.material_id
  and mgce.account_owner_id is null;

create index if not exists material_grupo_cor_owner_idx
  on public.material_grupo_cor (account_owner_id);

create index if not exists material_grupo_carac_owner_idx
  on public.material_grupo_caracteristica_epi (account_owner_id);

-- 2) Trigger para preencher owner baseado no material
create or replace function public.set_owner_material_relacionado()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off as
$$
declare
  v_owner uuid;
begin
  select m.account_owner_id
    into v_owner
    from public.materiais m
   where m.id = new.material_id;

  if v_owner is null then
    raise exception 'Material sem owner; nao pode vincular.';
  end if;

  if new.account_owner_id is null then
    new.account_owner_id := v_owner;
  elsif v_owner is not null and new.account_owner_id <> v_owner then
    raise exception 'Owner do vinculo nao confere com o owner do material.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_owner_material_grupo_cor on public.material_grupo_cor;
create trigger trg_set_owner_material_grupo_cor
before insert or update of material_id, account_owner_id
on public.material_grupo_cor
for each row
execute function public.set_owner_material_relacionado();

drop trigger if exists trg_set_owner_material_grupo_carac on public.material_grupo_caracteristica_epi;
create trigger trg_set_owner_material_grupo_carac
before insert or update of material_id, account_owner_id
on public.material_grupo_caracteristica_epi
for each row
execute function public.set_owner_material_relacionado();

-- 3) Garante owner no cadastro de materiais
create or replace function public.set_owner_materiais()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off as
$$
begin
  if new.account_owner_id is null then
    new.account_owner_id := public.my_owner_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_owner_materiais on public.materiais;
create trigger trg_set_owner_materiais
before insert or update of account_owner_id
on public.materiais
for each row
execute function public.set_owner_materiais();

-- 4) Impoe NOT NULL apos trigger de owner
alter table public.material_grupo_cor
  alter column account_owner_id set not null;

alter table public.material_grupo_caracteristica_epi
  alter column account_owner_id set not null;

-- 5) RLS por owner
alter table if exists public.material_grupo_cor enable row level security;
alter table if exists public.material_grupo_caracteristica_epi enable row level security;

drop policy if exists material_grupo_cor_select_all on public.material_grupo_cor;
drop policy if exists material_grupo_cor_insert_auth on public.material_grupo_cor;
drop policy if exists material_grupo_cor_update_auth on public.material_grupo_cor;
drop policy if exists material_grupo_cor_delete_auth on public.material_grupo_cor;
drop policy if exists material_grupo_cor_select_owner on public.material_grupo_cor;
drop policy if exists material_grupo_cor_insert_owner on public.material_grupo_cor;
drop policy if exists material_grupo_cor_update_owner on public.material_grupo_cor;
drop policy if exists material_grupo_cor_delete_owner on public.material_grupo_cor;

create policy material_grupo_cor_select_owner
  on public.material_grupo_cor
  for select
  to authenticated
  using (
    public.is_master()
    or account_owner_id = public.my_owner_id()
  );

create policy material_grupo_cor_insert_owner
  on public.material_grupo_cor
  for insert
  to authenticated
  with check (
    public.is_master()
    or (
      public.has_permission('estoque.write'::text)
      and exists (
        select 1
        from public.materiais m
        where m.id = material_grupo_cor.material_id
          and m.account_owner_id = public.my_owner_id()
      )
    )
  );

create policy material_grupo_cor_update_owner
  on public.material_grupo_cor
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

create policy material_grupo_cor_delete_owner
  on public.material_grupo_cor
  for delete
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

drop policy if exists material_grupo_carac_select_all on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_insert_auth on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_update_auth on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_delete_auth on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_select_owner on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_insert_owner on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_update_owner on public.material_grupo_caracteristica_epi;
drop policy if exists material_grupo_carac_delete_owner on public.material_grupo_caracteristica_epi;

create policy material_grupo_carac_select_owner
  on public.material_grupo_caracteristica_epi
  for select
  to authenticated
  using (
    public.is_master()
    or account_owner_id = public.my_owner_id()
  );

create policy material_grupo_carac_insert_owner
  on public.material_grupo_caracteristica_epi
  for insert
  to authenticated
  with check (
    public.is_master()
    or (
      public.has_permission('estoque.write'::text)
      and exists (
        select 1
        from public.materiais m
        where m.id = material_grupo_caracteristica_epi.material_id
          and m.account_owner_id = public.my_owner_id()
      )
    )
  );

create policy material_grupo_carac_update_owner
  on public.material_grupo_caracteristica_epi
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

create policy material_grupo_carac_delete_owner
  on public.material_grupo_caracteristica_epi
  for delete
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );
