-- Permite cadastrar acidentes sem HHT (campo deixa de ser obrigatório).
alter table public.acidentes
  alter column hht drop not null;

-- Mantém a checagem de valor não-negativo já existente.

