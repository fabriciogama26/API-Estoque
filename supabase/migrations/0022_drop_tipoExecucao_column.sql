-- Remove coluna textual legado (caso ainda exista) e garante que tipo_execucao_id esteja presente.
alter table if exists public.pessoas
  add column if not exists tipo_execucao_id uuid;

update public.pessoas p
set tipo_execucao_id = te.id
from public.tipo_execucao te
where p.tipo_execucao_id is null
  and te.nome is not null
  and lower(te.nome) = lower(trim(coalesce(p."tipoExecucao", '')));

update public.pessoas
set tipo_execucao_id = (select id from public.tipo_execucao where nome = 'PROPRIO' limit 1)
where tipo_execucao_id is null;

alter table if exists public.pessoas
  alter column tipo_execucao_id set not null;

alter table if exists public.pessoas
  drop column if exists "tipoExecucao";
