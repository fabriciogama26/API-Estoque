-- Configura referencia de lesoes por agente e habilita armazenamento de multiplas lesoes.

create table if not exists public.acidente_lesoes (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.acidente_agentes(id) on delete cascade,
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint acidente_lesoes_nome_not_blank check (length(btrim(nome)) > 0),
  constraint acidente_lesoes_unique unique (agente_id, nome)
);

create index if not exists acidente_lesoes_ordem_idx
  on public.acidente_lesoes (agente_id, ordem, nome);

insert into public.acidente_lesoes (agente_id, nome, ordem)
select agente.id, lesao.nome, lesao.ordem
from public.acidente_agentes as agente
join (
  values
    ('Agente Quimico', 'Queimadura quimica', 1),
    ('Agente Quimico', 'Irritacao cutanea', 2),
    ('Agente Quimico', 'Dermatite de contato', 3),
    ('Agente Quimico', 'Sensibilizacao alergica', 4),
    ('Agente Quimico', 'Corrosao tecidual', 5),
    ('Agente Quimico', 'Necrose', 6),
    ('Agente Quimico', 'Intoxicacao aguda', 7),
    ('Agente Quimico', 'Intoxicacao cronica', 8),
    ('Agente Quimico', 'Lesao ocular quimica', 9),
    ('Agente Quimico', 'Lesao respiratoria por vapores toxicos', 10),
    ('Agente Quimico', 'Edema pulmonar quimico', 11),
    ('Agente Quimico', 'Lesao hepatica', 12),
    ('Agente Quimico', 'Lesao renal por exposicao prolongada', 13),
    ('Agente Biologico', 'Infeccao local', 1),
    ('Agente Biologico', 'Infeccao sistemica', 2),
    ('Agente Biologico', 'Hepatite viral', 3),
    ('Agente Biologico', 'HIV / AIDS', 4),
    ('Agente Biologico', 'Leptospirose', 5),
    ('Agente Biologico', 'Raiva', 6),
    ('Agente Biologico', 'Tetano', 7),
    ('Agente Biologico', 'Micoses e dermatofitoses', 8),
    ('Agente Biologico', 'Toxoplasmose', 9),
    ('Agente Biologico', 'Brucelose', 10),
    ('Agente Biologico', 'Outras zoonoses', 11),
    ('Agente Biologico', 'Reacao alergica a agentes biologicos', 12),
    ('Agente Fisico', 'Queimadura termica', 1),
    ('Agente Fisico', 'Queimadura eletrica', 2),
    ('Agente Fisico', 'Choque eletrico', 3),
    ('Agente Fisico', 'Queimadura por radiacao', 4),
    ('Agente Fisico', 'Lesao por frio', 5),
    ('Agente Fisico', 'Lesao por calor', 6),
    ('Agente Fisico', 'Barotrauma', 7),
    ('Agente Fisico', 'Lesao por ruido', 8),
    ('Agente Fisico', 'Lesao por vibracao', 9),
    ('Agente Fisico', 'Cansaco visual', 10),
    ('Agente Fisico', 'Ofuscamento por iluminacao inadequada', 11),
    ('Agente Mecanico / de Acidente', 'Corte', 1),
    ('Agente Mecanico / de Acidente', 'Laceracao', 2),
    ('Agente Mecanico / de Acidente', 'Perfuracao', 3),
    ('Agente Mecanico / de Acidente', 'Puntura', 4),
    ('Agente Mecanico / de Acidente', 'Escoriacao', 5),
    ('Agente Mecanico / de Acidente', 'Abrasao', 6),
    ('Agente Mecanico / de Acidente', 'Contusao', 7),
    ('Agente Mecanico / de Acidente', 'Fratura', 8),
    ('Agente Mecanico / de Acidente', 'Luxacao', 9),
    ('Agente Mecanico / de Acidente', 'Entorse', 10),
    ('Agente Mecanico / de Acidente', 'Amputacao parcial ou total', 11),
    ('Agente Mecanico / de Acidente', 'Esguicho de particulas nos olhos', 12),
    ('Agente Mecanico / de Acidente', 'Lesao por esmagamento', 13),
    ('Agente Mecanico / de Acidente', 'Queda com impacto corporal', 14),
    ('Agente Mecanico / de Acidente', 'Lesao por objeto projetado ou em movimento', 15),
    ('Agente Mecanico / de Acidente', 'Perfurocortante contaminado', 16),
    ('Agente Mecanico / de Acidente', 'Lesao por animal', 17),
    ('Agente Mecanico / de Acidente', 'Politraumatismo', 18),
    ('Agente Ergonomico', 'Lombalgia', 1),
    ('Agente Ergonomico', 'Cervicalgia', 2),
    ('Agente Ergonomico', 'Tendinite', 3),
    ('Agente Ergonomico', 'Tenossinovite', 4),
    ('Agente Ergonomico', 'Bursite', 5),
    ('Agente Ergonomico', 'Sindrome do tunel do carpo', 6),
    ('Agente Ergonomico', 'Epicondilite lateral / medial', 7),
    ('Agente Ergonomico', 'Fadiga muscular', 8),
    ('Agente Ergonomico', 'Contraturas e dores miofasciais', 9),
    ('Agente Ergonomico', 'Hernia de disco', 10),
    ('Agente Ergonomico', 'Disturbios osteomusculares relacionados ao trabalho (DORT/LER)', 11),
    ('Agente Psicosocial', 'Estresse ocupacional agudo ou cronico', 1),
    ('Agente Psicosocial', 'Sindrome de Burnout', 2),
    ('Agente Psicosocial', 'Ansiedade ocupacional', 3),
    ('Agente Psicosocial', 'Depressao relacionada ao trabalho', 4),
    ('Agente Psicosocial', 'Transtorno do sono', 5),
    ('Agente Psicosocial', 'Transtorno pos-traumatico', 6),
    ('Agente Psicosocial', 'Disturbios cognitivos', 7)
) as lesao(nome_agente, nome, ordem)
  on agente.nome = lesao.nome_agente
on conflict (agente_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

alter table if exists public.acidentes
  add column if not exists lesoes text[] not null default '{}'::text[];

update public.acidentes
set lesoes = array_remove(array[nullif(trim(lesao), '')], null)
where coalesce(lesao, '') <> ''
  and (lesoes is null or array_length(lesoes, 1) is null or array_length(lesoes, 1) = 0);

alter table if exists public.acidente_lesoes enable row level security;

create policy acidente_lesoes_select_authenticated on public.acidente_lesoes
  for select
  to authenticated
  using (ativo is true);

create policy acidente_lesoes_select_anon on public.acidente_lesoes
  for select
  to anon
  using (ativo is true);

create policy acidente_lesoes_write_service_role on public.acidente_lesoes
  for all
  to service_role
  using (true)
  with check (true);
