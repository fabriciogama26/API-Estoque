-- Cria tabela de itens vinculados aos grupos de material e
-- popula os EPIs padronizados conforme o catálogo atualizado.

create table if not exists public.grupos_material_itens (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_material(id) on delete cascade,
  nome text not null,
  ordem smallint not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint grupos_material_itens_nome_not_blank check (length(btrim(nome)) > 0),
  constraint grupos_material_itens_unique unique (grupo_id, nome)
);

create index if not exists grupos_material_itens_grupo_idx
  on public.grupos_material_itens (grupo_id, ordem, nome);

-- Garante que o grupo "Outros" exista.
insert into public.grupos_material (nome, ordem)
values ('Outros', 8)
on conflict (nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Vestimentas ============================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
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
) as v(ordem, nome) on g.nome = 'Vestimentas'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Calçados ===============================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Botina de segurança bico plástico'),
    (2, 'Botina de segurança bico de aço'),
    (3, 'Sapato hospitalar fechado'),
    (4, 'Tênis antiderrapante'),
    (5, 'Bota de borracha cano longo'),
    (6, 'Bota de PVC')
) as v(ordem, nome) on g.nome = 'Calçados'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Proteção das Mãos ======================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Luva de vaqueta'),
    (2, 'Luva nitrílica'),
    (3, 'Luva de látex'),
    (4, 'Luva térmica'),
    (5, 'Luva de raspa'),
    (6, 'Luva de procedimento'),
    (7, 'Luva descartável')
) as v(ordem, nome) on g.nome = 'Proteção das Mãos'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Proteção da Cabeça e Face ==============================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Capacete de segurança'),
    (2, 'Protetor facial'),
    (3, 'Óculos de segurança incolor'),
    (4, 'Óculos de segurança fumê'),
    (5, 'Máscara facial'),
    (6, 'Máscara cirúrgica'),
    (7, 'Máscara com filtro'),
    (8, 'Escudo facial')
) as v(ordem, nome) on g.nome = 'Proteção da Cabeça e Face'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Proteção Auditiva ======================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Protetor auricular tipo plug'),
    (2, 'Protetor auricular tipo concha')
) as v(ordem, nome) on g.nome = 'Proteção Auditiva'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Proteção Respiratória ==================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Respirador semifacial'),
    (2, 'Respirador purificador de ar'),
    (3, 'Máscara de carvão ativado')
) as v(ordem, nome) on g.nome = 'Proteção Respiratória'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Proteção contra Quedas =================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Cinto de segurança tipo paraquedista'),
    (2, 'Talabarte com absorvedor de energia'),
    (3, 'Trava quedas'),
    (4, 'Cordas de ancoragem')
) as v(ordem, nome) on g.nome = 'Proteção contra Quedas'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;

-- === Outros =================================================================
insert into public.grupos_material_itens (grupo_id, nome, ordem)
select g.id, v.nome, v.ordem
from public.grupos_material g
join (values
    (1, 'Creme protetor solar'),
    (2, 'Creme de proteção dérmica'),
    (3, 'Protetor de nuca')
) as v(ordem, nome) on g.nome = 'Outros'
on conflict (grupo_id, nome) do update
set ordem = excluded.ordem,
    ativo = true;
