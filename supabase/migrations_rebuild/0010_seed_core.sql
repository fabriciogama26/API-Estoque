-- Seed data extracted from legacy migrations (excluding sample data).

insert into public.material_groups (name, sort_order)
values
  ('Vestimentas', 1),
  ('Calçados', 2),
  ('Proteção das Mãos', 3),
  ('Proteção da Cabeça e Face', 4),
  ('Proteção Auditiva', 5),
  ('Proteção Respiratória', 6),
  ('Proteção contra Quedas', 7)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.accident_locations (name, sort_order)
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
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_groups (name, sort_order)
values ('Outros', 8)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Camisa manga longa'),
    (2, 'Camisa manga curta'),
    (3, 'Calça de brim'),
    (4, 'Jaleco hospitalar'),
    (5, 'Avental PVC'),
    (6, 'Macacão de proteção química'),
    (7, 'Capote descartável'),
    (8, 'Touca descartável'),
    (9, 'Avental de chumbo (radiologia)'),
    (10, 'Colete refletivo'),
    (11, 'Capa de chuva'),
    (12, 'Colete salva-vidas')
) as v(sort_order, name) on g.name = 'Vestimentas'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Botina de segurança bico plástico'),
    (2, 'Botina de segurança bico de aço'),
    (3, 'Sapato hospitalar fechado'),
    (4, 'Tênis antiderrapante'),
    (5, 'Bota de borracha cano longo'),
    (6, 'Bota de PVC')
) as v(sort_order, name) on g.name = 'Calçados'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Luva de vaqueta'),
    (2, 'Luva nitrílica'),
    (3, 'Luva de látex'),
    (4, 'Luva térmica'),
    (5, 'Luva de raspa'),
    (6, 'Luva de procedimento'),
    (7, 'Luva descartável')
) as v(sort_order, name) on g.name = 'Proteção das Mãos'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Capacete de segurança'),
    (2, 'Protetor facial'),
    (3, 'Óculos de segurança incolor'),
    (4, 'Óculos de segurança fumê'),
    (5, 'Máscara facial'),
    (6, 'Máscara cirúrgica'),
    (7, 'Máscara com filtro'),
    (8, 'Escudo facial')
) as v(sort_order, name) on g.name = 'Proteção da Cabeça e Face'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Protetor auricular tipo plug'),
    (2, 'Protetor auricular tipo concha')
) as v(sort_order, name) on g.name = 'Proteção Auditiva'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Respirador semifacial'),
    (2, 'Respirador purificador de ar'),
    (3, 'Máscara de carvão ativado')
) as v(sort_order, name) on g.name = 'Proteção Respiratória'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Cinto de segurança tipo paraquedista'),
    (2, 'Talabarte com absorvedor de energia'),
    (3, 'Trava quedas'),
    (4, 'Cordas de ancoragem')
) as v(sort_order, name) on g.name = 'Proteção contra Quedas'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.material_group_items (group_id, name, sort_order)
select g.id, v.name, v.sort_order
from public.material_groups g
join (values
    (1, 'Creme protetor solar'),
    (2, 'Creme de proteção dérmica'),
    (3, 'Protetor de nuca')
) as v(sort_order, name) on g.name = 'Outros'
on conflict (group_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.accident_agents (name, sort_order)
values
  ('Agente Quimico', 1),
  ('Agente Biologico', 2),
  ('Agente Fisico', 3),
  ('Agente Mecanico / de Acidente', 4),
  ('Agente Ergonomico', 5),
  ('Agente Psicosocial', 6)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.accident_types (agent_id, name, sort_order)
select accident_agent.id, accident_type.name, accident_type.sort_order
from public.accident_agents as accident_agent
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
) as accident_type(nome_agente, name, sort_order)
  on accident_agent.name = accident_type.nome_agente
on conflict (agent_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.accident_body_parts (sort_order, group_name, subgroup_name, name) values
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
on conflict (group_name, subgroup_name, name) do update set sort_order = excluded.sort_order, is_active = true;

insert into public.accident_injuries (agent_id, name, sort_order)
select accident_agent.id, lesao.name, lesao.sort_order
from public.accident_agents as accident_agent
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
) as lesao(nome_agente, name, sort_order)
  on accident_agent.name = lesao.nome_agente
on conflict (agent_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.execution_types (name, sort_order)
values
  ('PROPRIO', 1),
  ('TERCEIROS', 2)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.app_credentials_catalog (code, label, description)
values
  ('master', 'Master', 'Acesso total'),
  ('admin', 'Administrador', 'Administracao completa'),
  ('operador', 'Operador', 'Operacao diaria'),
  ('estagiario', 'Estagiario', 'Acesso reduzido'),
  ('visitante', 'Visitante', 'Somente leitura basica')
on conflict (id) do nothing;

insert into public.stock_entry_statuses (id, status, is_active)
values
  ('82f86834-5b97-4bf0-9801-1372b6d1bd37', 'REGISTRADO', true),
  ('c5f5d4e8-8c1f-4c8d-bf52-918c0b9fbde3', 'CANCELADO', true)
on conflict (id) do update
set status = excluded.status,
    is_active = excluded.is_active;

insert into public.permissions (key, description) values
  ('rbac.manage', 'Gerenciar roles e overrides'),
  ('users.manage', 'Gerenciar usuarios (ativar/inativar, dependentes)'),
  ('credentials.manage', 'Gerenciar catalogo/credenciais')
on conflict (key) do nothing;

insert into public.permissions (key, description) values
  ('estoque.atual', 'Estoque Atual'),
  ('estoque.dashboard', 'Dashboard Estoque'),
  ('dashboard_analise_estoque', 'Analise de Estoque'),
  ('acidentes.dashboard', 'Dashboard Acidentes'),
  ('estoque.entradas', 'Entradas'),
  ('estoque.saidas', 'Saidas'),
  ('estoque.materiais', 'Materiais'),
  ('estoque.termo', 'Termo de EPI'),
  ('estoque.relatorio', 'Relatorio de Estoque')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('rbac.manage', 'users.manage', 'credentials.manage')
where lower(r.name) in ('master', 'admin', 'owner')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key in (
  'estoque.atual',
  'estoque.dashboard',
  'dashboard_analise_estoque',
  'estoque.entradas',
  'estoque.saidas',
  'estoque.materiais',
  'estoque.termo',
  'estoque.relatorio'
)
where p_old.key in ('estoque.read', 'estoque.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key = 'acidentes.dashboard'
where p_old.key in ('acidentes.read', 'acidentes.write')
on conflict do nothing;
