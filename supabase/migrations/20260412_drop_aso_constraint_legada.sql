-- Remove a constraint legada aso_controle_owner_pessoa_tipo_unique
-- que impede mais de um registro do mesmo tipo por pessoa.
-- Essa constraint era excessivamente restritiva e impedia o fluxo
-- de baixa de exame periodico (que cria um novo registro ativo
-- apos fechar o anterior).
--
-- As restricoes corretas ja existem:
--   aso_controle_owner_pessoa_tipo_data_unique_idx  => 1 registro ativo por tipo+data
--   aso_controle_owner_pessoa_admissional_unique_idx => 1 admissional ativo por pessoa
--   aso_controle_owner_pessoa_demissional_unique_idx => 1 demissional ativo por pessoa

-- Tenta dropar como constraint (caso tenha sido criada via ALTER TABLE ADD CONSTRAINT)
alter table public.aso_controle
  drop constraint if exists aso_controle_owner_pessoa_tipo_unique;

-- Tenta dropar como index (caso tenha sido criada via CREATE UNIQUE INDEX)
drop index if exists public.aso_controle_owner_pessoa_tipo_unique;

select pg_notify('pgrst', 'reload schema');
