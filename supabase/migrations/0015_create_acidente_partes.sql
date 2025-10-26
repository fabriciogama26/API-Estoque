-- Cria tabela de partes lesionadas e armazena selecoes multiplas nos acidentes.

create table if not exists public.acidente_partes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null default '',
  subgrupo text not null default '',
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint acidente_partes_nome_not_blank check (length(btrim(nome)) > 0)
);

create unique index if not exists acidente_partes_unique_idx
  on public.acidente_partes (grupo, subgrupo, nome);

create index if not exists acidente_partes_ordem_idx
  on public.acidente_partes (grupo, subgrupo, ordem, nome);

insert into public.acidente_partes (ordem, grupo, subgrupo, nome) values
  (1, 'Cabeca', '', 'Couro cabeludo'),
  (2, 'Cabeca', '', 'Cranio'),
  (3, 'Cabeca', '', 'Face'),
  (4, 'Cabeca', '', 'Testa'),
  (5, 'Cabeca', '', 'Olho direito'),
  (6, 'Cabeca', '', 'Olho esquerdo'),
  (7, 'Cabeca', '', 'Nariz'),
  (8, 'Cabeca', '', 'Boca'),
  (9, 'Cabeca', '', 'Bochecha direita'),
  (10, 'Cabeca', '', 'Bochecha esquerda'),
  (11, 'Cabeca', '', 'Queixo'),
  (12, 'Cabeca', '', 'Ouvidos'),
  (13, 'Cabeca', '', 'Orelha direita'),
  (14, 'Cabeca', '', 'Orelha esquerda'),
  (15, 'Cabeca', '', 'Mandibula'),
  (16, 'Cabeca', '', 'Maxilar'),
  (17, 'Cabeca', '', 'Dentes'),
  (18, 'Cabeca', '', 'Lingua'),
  (19, 'Pescoco', '', 'Regiao anterior (garganta)'),
  (20, 'Pescoco', '', 'Regiao posterior (nuca)'),
  (21, 'Pescoco', '', 'Traqueia'),
  (22, 'Pescoco', '', 'Pescoco lateral direito'),
  (23, 'Pescoco', '', 'Pescoco lateral esquerdo'),
  (24, 'Tronco', 'Regiao Toracica', 'Torax anterior (peito)'),
  (25, 'Tronco', 'Regiao Toracica', 'Torax posterior (costas superiores)'),
  (26, 'Tronco', 'Regiao Toracica', 'Mamas'),
  (27, 'Tronco', 'Regiao Toracica', 'Esterno'),
  (28, 'Tronco', 'Regiao Toracica', 'Costelas direitas / esquerdas'),
  (29, 'Tronco', 'Regiao Toracica', 'Pulmoes (internos)'),
  (30, 'Tronco', 'Regiao Toracica', 'Coracao (interno)'),
  (31, 'Tronco', 'Regiao Abdominal', 'Abdome superior'),
  (32, 'Tronco', 'Regiao Abdominal', 'Abdome inferior'),
  (33, 'Tronco', 'Regiao Abdominal', 'Lado direito / esquerdo'),
  (34, 'Tronco', 'Regiao Abdominal', 'Figado'),
  (35, 'Tronco', 'Regiao Abdominal', 'Estomago'),
  (36, 'Tronco', 'Regiao Abdominal', 'Intestinos'),
  (37, 'Tronco', 'Regiao Abdominal', 'Baco'),
  (38, 'Tronco', 'Regiao Abdominal', 'Pancreas'),
  (39, 'Tronco', 'Regiao Abdominal', 'Rins direito e esquerdo'),
  (40, 'Tronco', 'Regiao Lombar e Dorsal', 'Coluna dorsal'),
  (41, 'Tronco', 'Regiao Lombar e Dorsal', 'Coluna lombar'),
  (42, 'Tronco', 'Regiao Lombar e Dorsal', 'Quadril direito'),
  (43, 'Tronco', 'Regiao Lombar e Dorsal', 'Quadril esquerdo'),
  (44, 'Tronco', 'Regiao Lombar e Dorsal', 'Nadega direita'),
  (45, 'Tronco', 'Regiao Lombar e Dorsal', 'Nadega esquerda'),
  (46, 'Membros Superiores', 'Ombros e Bracos', 'Ombro direito'),
  (47, 'Membros Superiores', 'Ombros e Bracos', 'Ombro esquerdo'),
  (48, 'Membros Superiores', 'Ombros e Bracos', 'Braco direito (superior)'),
  (49, 'Membros Superiores', 'Ombros e Bracos', 'Braco esquerdo (superior)'),
  (50, 'Membros Superiores', 'Cotovelos e Antebracos', 'Cotovelo direito'),
  (51, 'Membros Superiores', 'Cotovelos e Antebracos', 'Cotovelo esquerdo'),
  (52, 'Membros Superiores', 'Cotovelos e Antebracos', 'Antebraco direito'),
  (53, 'Membros Superiores', 'Cotovelos e Antebracos', 'Antebraco esquerdo'),
  (54, 'Membros Superiores', 'Punhos e Maos', 'Punho direito'),
  (55, 'Membros Superiores', 'Punhos e Maos', 'Punho esquerdo'),
  (56, 'Membros Superiores', 'Punhos e Maos', 'Mao direita'),
  (57, 'Membros Superiores', 'Punhos e Maos', 'Mao direita - Palma'),
  (58, 'Membros Superiores', 'Punhos e Maos', 'Mao direita - Dorso'),
  (59, 'Membros Superiores', 'Punhos e Maos', 'Polegar direito'),
  (60, 'Membros Superiores', 'Punhos e Maos', 'Indicador direito'),
  (61, 'Membros Superiores', 'Punhos e Maos', 'Medio direito'),
  (62, 'Membros Superiores', 'Punhos e Maos', 'Anelar direito'),
  (63, 'Membros Superiores', 'Punhos e Maos', 'Minimo direito'),
  (64, 'Membros Superiores', 'Punhos e Maos', 'Mao esquerda'),
  (65, 'Membros Superiores', 'Punhos e Maos', 'Mao esquerda - Palma'),
  (66, 'Membros Superiores', 'Punhos e Maos', 'Mao esquerda - Dorso'),
  (67, 'Membros Superiores', 'Punhos e Maos', 'Polegar esquerdo'),
  (68, 'Membros Superiores', 'Punhos e Maos', 'Indicador esquerdo'),
  (69, 'Membros Superiores', 'Punhos e Maos', 'Medio esquerdo'),
  (70, 'Membros Superiores', 'Punhos e Maos', 'Anelar esquerdo'),
  (71, 'Membros Superiores', 'Punhos e Maos', 'Minimo esquerdo'),
  (72, 'Membros Inferiores', 'Quadris e Coxas', 'Quadril direito'),
  (73, 'Membros Inferiores', 'Quadris e Coxas', 'Quadril esquerdo'),
  (74, 'Membros Inferiores', 'Quadris e Coxas', 'Coxa direita (anterior / posterior)'),
  (75, 'Membros Inferiores', 'Quadris e Coxas', 'Coxa esquerda (anterior / posterior)'),
  (76, 'Membros Inferiores', 'Joelhos e Pernas', 'Joelho direito'),
  (77, 'Membros Inferiores', 'Joelhos e Pernas', 'Joelho esquerdo'),
  (78, 'Membros Inferiores', 'Joelhos e Pernas', 'Perna direita (anterior / posterior)'),
  (79, 'Membros Inferiores', 'Joelhos e Pernas', 'Perna esquerda (anterior / posterior)'),
  (80, 'Membros Inferiores', 'Joelhos e Pernas', 'Panturrilha direita'),
  (81, 'Membros Inferiores', 'Joelhos e Pernas', 'Panturrilha esquerda'),
  (82, 'Membros Inferiores', 'Tornozelos e Pes', 'Tornozelo direito'),
  (83, 'Membros Inferiores', 'Tornozelos e Pes', 'Tornozelo esquerdo'),
  (84, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe direito'),
  (85, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe direito - Dorso'),
  (86, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe direito - Planta'),
  (87, 'Membros Inferiores', 'Tornozelos e Pes', 'Halux (dedao) direito'),
  (88, 'Membros Inferiores', 'Tornozelos e Pes', '2o dedo direito'),
  (89, 'Membros Inferiores', 'Tornozelos e Pes', '3o dedo direito'),
  (90, 'Membros Inferiores', 'Tornozelos e Pes', '4o dedo direito'),
  (91, 'Membros Inferiores', 'Tornozelos e Pes', '5o dedo direito'),
  (92, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe esquerdo'),
  (93, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe esquerdo - Dorso'),
  (94, 'Membros Inferiores', 'Tornozelos e Pes', 'Pe esquerdo - Planta'),
  (95, 'Membros Inferiores', 'Tornozelos e Pes', 'Halux (dedao) esquerdo'),
  (96, 'Membros Inferiores', 'Tornozelos e Pes', '2o dedo esquerdo'),
  (97, 'Membros Inferiores', 'Tornozelos e Pes', '3o dedo esquerdo'),
  (98, 'Membros Inferiores', 'Tornozelos e Pes', '4o dedo esquerdo'),
  (99, 'Membros Inferiores', 'Tornozelos e Pes', '5o dedo esquerdo')
on conflict (grupo, subgrupo, nome) do update set ordem = excluded.ordem, ativo = true;

alter table if exists public.acidentes
  add column if not exists partes_lesionadas text[] not null default '{}'::text[];

update public.acidentes
set partes_lesionadas = array_remove(array[nullif(trim("parteLesionada"), '')], null)
where coalesce("parteLesionada", '') <> ''
  and (partes_lesionadas is null or array_length(partes_lesionadas, 1) is null or array_length(partes_lesionadas, 1) = 0);

alter table if exists public.acidentes enable row level security;
-- RLS ja estava habilitado anteriormente; garantimos as policies para a nova tabela.
alter table if exists public.acidente_partes enable row level security;

create policy acidente_partes_select_authenticated on public.acidente_partes
  for select
  to authenticated
  using (ativo is true);

create policy acidente_partes_select_anon on public.acidente_partes
  for select
  to anon
  using (ativo is true);

create policy acidente_partes_write_service_role on public.acidente_partes
  for all
  to service_role
  using (true)
  with check (true);
