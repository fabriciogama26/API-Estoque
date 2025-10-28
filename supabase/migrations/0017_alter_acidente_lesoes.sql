-- Ajusta acidente_lesoes para referenciar acidente_agentes por ID e remove coluna de texto legado.

-- Remove restricao antiga baseada no nome do agente, se existir.
alter table if exists public.acidente_lesoes
  drop constraint if exists acidente_lesoes_unique;

-- Adiciona coluna agente_id (FK para acidente_agentes) se ainda nao existir.
alter table if exists public.acidente_lesoes
  add column if not exists agente_id uuid references public.acidente_agentes(id) on delete cascade;

-- Popula agente_id usando a coluna de texto anterior, quando presente.
update public.acidente_lesoes les
set agente_id = agente.id
from public.acidente_agentes agente
where les.agente_id is null
  and les.agente is not null
  and lower(agente.nome) = lower(les.agente);

-- Remove a coluna de texto legado.
alter table if exists public.acidente_lesoes
  drop column if exists agente;

-- Cria constraint de unicidade na combinacao (agente_id, nome).
alter table if exists public.acidente_lesoes
  add constraint acidente_lesoes_unique unique (agente_id, nome);

-- Recria indice alinhado ao novo schema.
drop index if exists acidente_lesoes_ordem_idx;
create index if not exists acidente_lesoes_ordem_idx
  on public.acidente_lesoes (agente_id, ordem, nome);
