-- Garante coluna de vínculo com a entrada e índice para histórico.
alter table if exists public.entrada_historico
  add column if not exists entrada_id uuid references public.entradas(id);

create index if not exists entrada_historico_entrada_id_idx
  on public.entrada_historico (entrada_id);

