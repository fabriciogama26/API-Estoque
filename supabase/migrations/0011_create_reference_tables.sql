-- Cria tabelas de referência para cadastro controlado de materiais e locais.
create table if not exists public.grupos_material (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint grupos_material_nome_not_blank check (length(btrim(nome)) > 0),
  constraint grupos_material_nome_unique unique (nome)
);

create index if not exists grupos_material_ordem_idx
  on public.grupos_material (ativo desc, ordem asc, nome asc);

insert into public.grupos_material (nome, ordem)
values
  ('Vestimentas', 1),
  ('Calçados', 2),
  ('Proteção das Mãos', 3),
  ('Proteção da Cabeça e Face', 4),
  ('Proteção Auditiva', 5),
  ('Proteção Respiratória', 6),
  ('Proteção contra Quedas', 7)
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

create table if not exists public.acidente_locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint acidente_locais_nome_not_blank check (length(btrim(nome)) > 0),
  constraint acidente_locais_nome_unique unique (nome)
);

create index if not exists acidente_locais_ordem_idx
  on public.acidente_locais (ativo desc, ordem asc, nome asc);

insert into public.acidente_locais (nome, ordem)
values
  ('Sala de aula', 1),
  ('Laboratório de química', 2),
  ('Laboratório de biologia', 3),
  ('Laboratório de informática', 4),
  ('Laboratório de radiologia', 5),
  ('Clínica veterinária', 6),
  ('Curral', 7),
  ('Baias', 8),
  ('Consultório médico', 9),
  ('Centro cirúrgico', 10),
  ('Farmácia', 11),
  ('Refeitório', 12),
  ('Cozinha', 13),
  ('Corredor', 14),
  ('Escada', 15),
  ('Pátio', 16),
  ('Banheiro', 17),
  ('Biblioteca', 18),
  ('Auditório', 19),
  ('Sala administrativa', 20),
  ('Estacionamento', 21),
  ('Oficina de manutenção', 22),
  ('Almoxarifado', 23),
  ('Central de gás', 24),
  ('Depósito de materiais', 25),
  ('Praça', 26),
  ('Garagem', 27),
  ('Sala de máquinas', 28),
  ('Abrigo de gerador', 29),
  ('Poço de elevador', 30),
  ('Laboratório de análises clínicas', 31)
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;
