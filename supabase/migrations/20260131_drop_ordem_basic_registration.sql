-- Remove colunas de ordem das tabelas base (Cadastro Base).

alter table if exists public.cargos
  drop column if exists ordem;

alter table if exists public.centros_custo
  drop column if exists ordem;

alter table if exists public.centros_servico
  drop column if exists ordem;

alter table if exists public.setores
  drop column if exists ordem;

-- Remove indices relacionados a ordem, se existirem.
drop index if exists public.cargos_ordem_idx;
drop index if exists public.centros_custo_ordem_idx;
drop index if exists public.centros_servico_ordem_idx;
drop index if exists public.setores_ordem_idx;
