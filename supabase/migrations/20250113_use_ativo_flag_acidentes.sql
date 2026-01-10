-- Ajusta para usar a coluna ativo como controle de cancelamento de acidentes.
alter table public.acidentes
  add column if not exists ativo boolean default true;

update public.acidentes set ativo = true where ativo is null;

alter table public.acidentes
  alter column ativo set not null,
  alter column ativo set default true;

-- Remove colunas de cancelamento alternativas, se criadas.
alter table public.acidentes
  drop column if exists cancelado,
  drop column if exists cancelado_em,
  drop column if exists cancelado_por;

drop index if exists acidentes_cancelado_idx;
