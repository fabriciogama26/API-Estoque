-- Renomeia colunas de centro de custo/servico para snake_case.

alter table if exists public.pessoas
  rename column "local" to centro_servico;

alter table if exists public.entradas
  rename column "centroServico" to centro_servico;

alter table if exists public.entradas
  rename column "centroCusto" to centro_custo;

alter table if exists public.saidas
  rename column "centroServico" to centro_servico;

alter table if exists public.saidas
  rename column "centroCusto" to centro_custo;
