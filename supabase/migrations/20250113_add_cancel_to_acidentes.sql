-- Adiciona flag de cancelamento para acidentes (não entrar nos cálculos/dashboard).
alter table public.acidentes
  add column if not exists cancelado boolean not null default false,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por text;

create index if not exists acidentes_cancelado_idx on public.acidentes (cancelado);

