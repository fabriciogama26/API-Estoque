-- Tabela de status para HHT mensal e coluna de FK no hht_mensal.

create table if not exists public.status_hht (
  id uuid primary key default gen_random_uuid(),
  status text null,
  ativo boolean null default true,
  created_at timestamptz not null default now()
);

do $$
declare
  v_ativo_id uuid;
  v_cancelado_id uuid;
begin
  if not exists (select 1 from public.status_hht where lower(status) = 'ativo') then
    insert into public.status_hht (status, ativo) values ('Ativo', true) returning id into v_ativo_id;
  else
    select id into v_ativo_id from public.status_hht where lower(status) = 'ativo' limit 1;
  end if;

  if not exists (select 1 from public.status_hht where lower(status) = 'cancelado') then
    insert into public.status_hht (status, ativo) values ('Cancelado', true) returning id into v_cancelado_id;
  else
    select id into v_cancelado_id from public.status_hht where lower(status) = 'cancelado' limit 1;
  end if;

  perform set_config('app.status_hht_default', coalesce(v_ativo_id::text, ''), true);
  perform set_config('app.status_hht_cancelado', coalesce(v_cancelado_id::text, ''), true);
end$$;

alter table if exists public.hht_mensal add column if not exists status_hht_id uuid;

do $$
declare
  v_default uuid;
begin
  v_default := nullif(current_setting('app.status_hht_default', true), '')::uuid;
  if v_default is not null then
    update public.hht_mensal set status_hht_id = coalesce(status_hht_id, v_default);
  end if;
end$$;

alter table if exists public.hht_mensal
  alter column status_hht_id set not null,
  alter column status_hht_id set default nullif(current_setting('app.status_hht_default', true), '')::uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hht_mensal_status_fk'
      and conrelid = 'public.hht_mensal'::regclass
  ) then
    alter table public.hht_mensal
      add constraint hht_mensal_status_fk foreign key (status_hht_id) references public.status_hht(id) on delete restrict;
  end if;
end$$;

create index if not exists status_hht_id_idx on public.hht_mensal (status_hht_id);

alter table if exists public.status_hht enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'status_hht'
      and policyname = 'status_hht_select_authenticated'
  ) then
    create policy status_hht_select_authenticated on public.status_hht
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'status_hht'
      and policyname = 'status_hht_service_role'
  ) then
    create policy status_hht_service_role on public.status_hht
      for all to service_role using (true) with check (true);
  end if;
end
$$;
