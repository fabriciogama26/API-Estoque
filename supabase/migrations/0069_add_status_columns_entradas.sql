-- Adds status_entrada table and aligns entradas status/audit columns

create table if not exists public.status_entrada (
  id uuid not null default gen_random_uuid(),
  status text not null,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint status_entrada_pkey primary key (id),
  constraint status_entrada_status_key unique (status)
);

-- Seed default statuses (ids are fixed to keep references stable)
insert into public.status_entrada (id, status, ativo)
values
  ('82f86834-5b97-4bf0-9801-1372b6d1bd37', 'REGISTRADO', true),
  ('c5f5d4e8-8c1f-4c8d-bf52-918c0b9fbde3', 'CANCELADO', true)
on conflict (id) do update
set status = excluded.status,
    ativo = excluded.ativo;

-- Entradas: audit columns + status FK/default
alter table public.entradas
  add column if not exists usuario_edicao uuid,
  add column if not exists atualizado_em timestamptz,
  add column if not exists status uuid;

-- Backfill null status with default
update public.entradas
set status = '82f86834-5b97-4bf0-9801-1372b6d1bd37'
where status is null;

-- Default and FK
alter table public.entradas
  alter column status set default '82f86834-5b97-4bf0-9801-1372b6d1bd37',
  add constraint entradas_status_fkey foreign key (status) references public.status_entrada (id);

comment on column public.entradas.status is 'Status da entrada (FK status_entrada.id)';
comment on column public.entradas.usuario_edicao is 'Usuário que realizou a última edição';
comment on column public.entradas.atualizado_em is 'Data/hora da última edição';
