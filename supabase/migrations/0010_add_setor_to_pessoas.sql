-- Adiciona coluna de setor em pessoas e preenche registros existentes.
alter table if exists public.pessoas
  add column if not exists setor text;

update public.pessoas
set setor = coalesce(nullif(trim(setor), ''), nullif(trim(centro_servico), ''), nullif(trim(local), ''))
where setor is null or trim(setor) = '';

alter table if exists public.pessoas
  alter column setor set default '',
  alter column setor set not null;
