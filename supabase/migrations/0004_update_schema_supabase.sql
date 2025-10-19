-- Atualiza o schema para alinhar nomenclatura camelCase e colunas utilizadas
-- pelas funções serverless, além de impor unicidade de matrícula em pessoas.

create extension if not exists "uuid-ossp";

-- === Materiais ==============================================================
alter table if exists public.materiais
  rename column valor_unitario to "valorUnitario";

alter table if exists public.materiais
  rename column validade_dias to "validadeDias";

alter table if exists public.materiais
  rename column estoque_minimo to "estoqueMinimo";

alter table if exists public.materiais
  rename column usuario_cadastro to "usuarioCadastro";

alter table if exists public.materiais
  rename column data_cadastro to "dataCadastro";

alter table if exists public.materiais
  add column if not exists "usuarioAtualizacao" text default 'sistema';

alter table if exists public.materiais
  add column if not exists "atualizadoEm" timestamptz;

alter table if exists public.materiais
  add column if not exists "descricao" text;

-- Garante check constraints consistentes
alter table if exists public.materiais
  alter column "valorUnitario" type numeric(14,2)
    using "valorUnitario"::numeric(14,2);

alter table if exists public.materiais
  alter column "estoqueMinimo" type integer
    using "estoqueMinimo"::integer;

alter table if exists public.materiais
  alter column "estoqueMinimo" set default 0;

alter table if exists public.materiais
  alter column "estoqueMinimo" set not null;

drop index if exists materiais_nome_fabricante_idx;

create unique index if not exists materiais_nome_fabricante_idx
  on public.materiais (lower(nome), lower(fabricante));

-- === Pessoas ================================================================
update public.pessoas
set matricula = concat('MIG-', substr(gen_random_uuid()::text, 1, 8))
where matricula is null or length(trim(matricula)) = 0;

alter table if exists public.pessoas
  rename column usuario_cadastro to "usuarioCadastro";

alter table if exists public.pessoas
  rename column criado_em to "criadoEm";

alter table if exists public.pessoas
  add column if not exists "usuarioEdicao" text;

alter table if exists public.pessoas
  add column if not exists "atualizadoEm" timestamptz;

alter table if exists public.pessoas
  add column if not exists "historicoEdicao" jsonb default '[]'::jsonb not null;

alter table if exists public.pessoas
  alter column matricula set not null;

alter table if exists public.pessoas
  add constraint pessoas_matricula_not_blank check (length(trim(matricula)) > 0);

create unique index if not exists pessoas_matricula_unique_idx
  on public.pessoas (lower(matricula));

-- === Entradas ===============================================================
alter table if exists public.entradas
  rename column material_id to "materialId";

alter table if exists public.entradas
  rename column data_entrada to "dataEntrada";

alter table if exists public.entradas
  rename column usuario_responsavel to "usuarioResponsavel";

alter table if exists public.entradas
  add column if not exists "centroCusto" text not null default '';

alter table if exists public.entradas
  add column if not exists "centroServico" text not null default '';

alter table if exists public.entradas
  alter column "quantidade" type numeric(14,2)
    using "quantidade"::numeric(14,2);

drop index if exists entradas_material_idx;
create index if not exists entradas_material_idx
  on public.entradas ("materialId", "dataEntrada" desc);

-- === Saídas =================================================================
alter table if exists public.saidas
  rename column material_id to "materialId";

alter table if exists public.saidas
  rename column pessoa_id to "pessoaId";

alter table if exists public.saidas
  rename column data_entrega to "dataEntrega";

alter table if exists public.saidas
  rename column data_troca to "dataTroca";

alter table if exists public.saidas
  rename column usuario_responsavel to "usuarioResponsavel";

alter table if exists public.saidas
  add column if not exists "centroCusto" text not null default '';

alter table if exists public.saidas
  add column if not exists "centroServico" text not null default '';

alter table if exists public.saidas
  alter column "quantidade" type numeric(14,2)
    using "quantidade"::numeric(14,2);

drop index if exists saidas_material_idx;
create index if not exists saidas_material_idx
  on public.saidas ("materialId", "dataEntrega" desc);

drop index if exists saidas_pessoa_idx;
create index if not exists saidas_pessoa_idx
  on public.saidas ("pessoaId", "dataEntrega" desc);

-- === Histórico de Preços ====================================================
alter table if exists public.precos_historico
  rename to material_price_history;

alter table if exists public.material_price_history
  rename column material_id to "materialId";

alter table if exists public.material_price_history
  rename column valor_unitario to "valorUnitario";

alter table if exists public.material_price_history
  rename column data_registro to "criadoEm";

alter table if exists public.material_price_history
  rename column usuario_responsavel to "usuarioResponsavel";

alter table if exists public.material_price_history
  alter column "valorUnitario" type numeric(14,2)
    using "valorUnitario"::numeric(14,2);

alter table if exists public.material_price_history
  alter column "usuarioResponsavel" set default 'sistema';

drop index if exists precos_material_idx;
create index if not exists material_price_history_material_idx
  on public.material_price_history ("materialId", "criadoEm" desc);

-- === Acidentes ==============================================================
create table if not exists public.acidentes (
  id uuid primary key default gen_random_uuid(),
  matricula text not null,
  nome text not null,
  cargo text not null,
  data timestamptz not null,
  "diasPerdidos" numeric(14,2) not null default 0 check ("diasPerdidos" >= 0),
  "diasDebitados" numeric(14,2) not null default 0 check ("diasDebitados" >= 0),
  tipo text not null,
  agente text not null,
  cid text,
  lesao text not null,
  "parteLesionada" text not null,
  setor text not null,
  local text not null,
  cat text,
  observacao text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz,
  "registradoPor" text,
  "atualizadoPor" text
);

create index if not exists acidentes_matricula_idx
  on public.acidentes (lower(matricula), data desc);

-- === Dados auxiliares =======================================================
comment on table public.material_price_history is 'Histórico de alteração de preços dos materiais.';
comment on column public.pessoas."historicoEdicao" is 'Timeline de alterações em formato JSONB.';
