alter table if exists public.acidentes
  add column if not exists esocial boolean not null default false;

alter table if exists public.acidentes
  add column if not exists data_sesmt timestamptz;
