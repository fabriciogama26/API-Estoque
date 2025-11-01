-- Expande a tabela de histórico de materiais para registrar qualquer alteração.

alter table if exists public.material_price_history
  add column if not exists campos_alterados jsonb not null default '[]'::jsonb;

comment on table public.material_price_history is 'Histórico de edições dos materiais.';
comment on column public.material_price_history.campos_alterados is 'Lista de campos alterados em cada edição.';
