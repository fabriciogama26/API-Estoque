-- Cria tabelas de referência para agentes de acidente e seus tipos associados.

create table if not exists public.acidente_agentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint acidente_agentes_nome_not_blank check (length(btrim(nome)) > 0),
  constraint acidente_agentes_nome_unique unique (nome)
);

create index if not exists acidente_agentes_ordem_idx
  on public.acidente_agentes (ativo desc, ordem asc, nome asc);

create table if not exists public.acidente_tipos (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.acidente_agentes(id) on delete cascade,
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint acidente_tipos_nome_not_blank check (length(btrim(nome)) > 0),
  constraint acidente_tipos_unique unique (agente_id, nome)
);

create index if not exists acidente_tipos_agente_idx
  on public.acidente_tipos (agente_id, ativo desc, ordem asc, nome asc);

-- Semeia agentes padronizados.
insert into public.acidente_agentes (nome, ordem)
values
  ('Agente Quimico', 1),
  ('Agente Biologico', 2),
  ('Agente Fisico', 3),
  ('Agente Mecanico / de Acidente', 4),
  ('Agente Ergonomico', 5),
  ('Agente Psicosocial', 6)
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- Semeia tipos vinculados aos agentes.
insert into public.acidente_tipos (agente_id, nome, ordem)
select agente.id, tipo.nome, tipo.ordem
from public.acidente_agentes as agente
join (
  values
    ('Agente Quimico', 'Poeiras', 1),
    ('Agente Quimico', 'Fumos metalicos', 2),
    ('Agente Quimico', 'Nevoas e nevoas oleosas', 3),
    ('Agente Quimico', 'Vapores organicos', 4),
    ('Agente Quimico', 'Gases toxicos', 5),
    ('Agente Quimico', 'Acidos e bases fortes', 6),
    ('Agente Quimico', 'Produtos de limpeza agressivos', 7),
    ('Agente Quimico', 'Agrotoxicos e pesticidas', 8),
    ('Agente Quimico', 'Combustiveis e inflamaveis', 9),
    ('Agente Quimico', 'Resinas, colas, tintas e adesivos', 10),

    ('Agente Biologico', 'Bacterias', 1),
    ('Agente Biologico', 'Virus', 2),
    ('Agente Biologico', 'Fungos e esporos', 3),
    ('Agente Biologico', 'Parasitas', 4),
    ('Agente Biologico', 'Fluidos biologicos', 5),
    ('Agente Biologico', 'Materiais contaminados', 6),
    ('Agente Biologico', 'Animais e vetores', 7),
    ('Agente Biologico', 'Carcacas e residuos de origem animal', 8),

    ('Agente Fisico', 'Ruido excessivo', 1),
    ('Agente Fisico', 'Vibracao', 2),
    ('Agente Fisico', 'Temperaturas extremas', 3),
    ('Agente Fisico', 'Pressao anormal', 4),
    ('Agente Fisico', 'Radiacao ionizante', 5),
    ('Agente Fisico', 'Radiacao nao ionizante', 6),
    ('Agente Fisico', 'Iluminacao inadequada', 7),
    ('Agente Fisico', 'Corrente eletrica', 8),
    ('Agente Fisico', 'Umidade elevada ou seca excessiva', 9),
    ('Agente Fisico', 'Campos eletromagneticos', 10),

    ('Agente Mecanico / de Acidente', 'Maquinas e equipamentos com partes moveis', 1),
    ('Agente Mecanico / de Acidente', 'Ferramentas manuais ou eletricas', 2),
    ('Agente Mecanico / de Acidente', 'Queda de objetos ou materiais', 3),
    ('Agente Mecanico / de Acidente', 'Escadas, andaimes e plataformas instaveis', 4),
    ('Agente Mecanico / de Acidente', 'Pisos escorregadios, irregulares ou com obstaculos', 5),
    ('Agente Mecanico / de Acidente', 'Veiculos em movimento', 6),
    ('Agente Mecanico / de Acidente', 'Perfurocortantes', 7),
    ('Agente Mecanico / de Acidente', 'Animais', 8),
    ('Agente Mecanico / de Acidente', 'Projecao de fragmentos ou particulas', 9),
    ('Agente Mecanico / de Acidente', 'Falta de protecao, sinalizacao ou guarda-corpo', 10),
    ('Agente Mecanico / de Acidente', 'Explosoes, incendios e curto-circuitos', 11),

    ('Agente Ergonomico', 'Postura incorreta ou forcada', 1),
    ('Agente Ergonomico', 'Movimentos repetitivos', 2),
    ('Agente Ergonomico', 'Esforco fisico intenso', 3),
    ('Agente Ergonomico', 'Levantamento e transporte manual de cargas', 4),
    ('Agente Ergonomico', 'Ritmo de trabalho acelerado', 5),
    ('Agente Ergonomico', 'Monotonia e repetitividade', 6),
    ('Agente Ergonomico', 'Jornada prolongada sem pausas', 7),
    ('Agente Ergonomico', 'Mobiliario inadequado', 8),
    ('Agente Ergonomico', 'Falta de conforto termico ou visual', 9),
    ('Agente Ergonomico', 'Exigencia cognitiva excessiva', 10),

    ('Agente Psicosocial', 'Estresse ocupacional', 1),
    ('Agente Psicosocial', 'Assedio moral ou sexual', 2),
    ('Agente Psicosocial', 'Pressao por metas inalcancaveis', 3),
    ('Agente Psicosocial', 'Falta de reconhecimento', 4),
    ('Agente Psicosocial', 'Conflitos interpessoais ou hierarquicos', 5),
    ('Agente Psicosocial', 'Isolamento social', 6),
    ('Agente Psicosocial', 'Sobrecarga ou ambiguidade de funcao', 7),
    ('Agente Psicosocial', 'Clima organizacional negativo', 8),
    ('Agente Psicosocial', 'Trabalho noturno ou em revezamento', 9),
    ('Agente Psicosocial', 'Inseguranca quanto a estabilidade no emprego', 10)
) as tipo(nome_agente, nome, ordem)
  on agente.nome = tipo.nome_agente
on conflict (agente_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- Habilita RLS e define politicas basicas.
alter table if exists public.acidente_agentes enable row level security;
alter table if exists public.acidente_tipos enable row level security;

create policy acidente_agentes_select_authenticated on public.acidente_agentes
  for select
  to authenticated
  using (ativo is true);

create policy acidente_tipos_select_authenticated on public.acidente_tipos
  for select
  to authenticated
  using (ativo is true);

create policy acidente_agentes_select_anon on public.acidente_agentes
  for select
  to anon
  using (ativo is true);

create policy acidente_tipos_select_anon on public.acidente_tipos
  for select
  to anon
  using (ativo is true);

create policy acidente_agentes_write_service_role on public.acidente_agentes
  for all
  to service_role
  using (true)
  with check (true);

create policy acidente_tipos_write_service_role on public.acidente_tipos
  for all
  to service_role
  using (true)
  with check (true);
