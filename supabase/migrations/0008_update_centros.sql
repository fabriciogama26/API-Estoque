-- Remove centro_servico de entradas e renomeia setor em acidentes.

alter table if exists public.entradas
  drop column if exists centro_servico;

alter table if exists public.acidentes
  rename column setor to centro_servico;
