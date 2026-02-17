-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.acidente_agentes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT acidente_agentes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.acidente_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  acidente_id uuid NOT NULL,
  data_edicao timestamp with time zone NOT NULL DEFAULT now(),
  usuario_responsavel text NOT NULL DEFAULT ''::text,
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_id uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT acidente_historico_pkey PRIMARY KEY (id),
  CONSTRAINT acidente_historico_acidente_id_fkey FOREIGN KEY (acidente_id) REFERENCES public.acidentes(id),
  CONSTRAINT acidente_historico_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT acidente_historico_usuario_responsavel_fkey FOREIGN KEY (usuario_responsavel) REFERENCES public.app_users(username),
  CONSTRAINT acidente_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.acidente_lesoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  agente_id uuid,
  CONSTRAINT acidente_lesoes_pkey PRIMARY KEY (id),
  CONSTRAINT acidente_lesoes_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.acidente_agentes(id)
);
CREATE TABLE public.acidente_locais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT acidente_locais_pkey PRIMARY KEY (id)
);
CREATE TABLE public.acidente_partes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  grupo text NOT NULL DEFAULT ''::text,
  subgrupo text NOT NULL DEFAULT ''::text,
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT acidente_partes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.acidente_partes_grupo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text,
  ativo boolean DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  ordem smallint,
  CONSTRAINT acidente_partes_grupo_pkey PRIMARY KEY (id)
);
CREATE TABLE public.acidente_partes_sub_grupo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text,
  ativo boolean DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  grupo_id uuid,
  CONSTRAINT acidente_partes_sub_grupo_pkey PRIMARY KEY (id),
  CONSTRAINT acidente_partes_sub_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.acidente_partes_grupo(id)
);
CREATE TABLE public.acidente_tipos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT acidente_tipos_pkey PRIMARY KEY (id),
  CONSTRAINT acidente_tipos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.acidente_agentes(id)
);
CREATE TABLE public.acidentes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  matricula text NOT NULL,
  nome text NOT NULL,
  cargo text NOT NULL,
  data timestamp with time zone NOT NULL,
  diasPerdidos numeric NOT NULL DEFAULT 0 CHECK ("diasPerdidos" >= 0::numeric),
  diasDebitados numeric NOT NULL DEFAULT 0 CHECK ("diasDebitados" >= 0::numeric),
  tipo text NOT NULL DEFAULT ''::text,
  agente text NOT NULL DEFAULT ''::text,
  cid text,
  centro_servico text NOT NULL,
  local text NOT NULL,
  cat text,
  observacao text,
  criadoEm timestamp with time zone NOT NULL DEFAULT now(),
  atualizadoEm timestamp with time zone DEFAULT now(),
  registradoPor text,
  atualizadoPor text,
  hht numeric DEFAULT 0 CHECK (hht >= 0::numeric),
  partes_lesionadas ARRAY NOT NULL DEFAULT '{}'::text[],
  lesoes ARRAY NOT NULL DEFAULT '{}'::text[],
  data_esocial timestamp with time zone,
  sesmt boolean DEFAULT false,
  data_sesmt timestamp with time zone,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  ativo boolean DEFAULT true,
  cancel_motivo text text,
  CONSTRAINT acidentes_pkey PRIMARY KEY (id),
  CONSTRAINT acidentes_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.api_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  environment text NOT NULL DEFAULT 'api'::text,
  service text NOT NULL DEFAULT 'api'::text,
  method text,
  path text,
  status integer,
  code text,
  user_id uuid,
  message text NOT NULL,
  stack text,
  context jsonb,
  severity text NOT NULL DEFAULT 'error'::text,
  fingerprint text NOT NULL,
  CONSTRAINT api_errors_pkey PRIMARY KEY (id),
  CONSTRAINT api_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.app_credentials_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_text text UNIQUE,
  label text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  level smallint DEFAULT '2'::smallint,
  CONSTRAINT app_credentials_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.app_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  environment text NOT NULL DEFAULT 'app'::text,
  page text NOT NULL DEFAULT ''::text,
  user_id uuid,
  message text NOT NULL,
  stack text,
  context jsonb,
  severity text NOT NULL DEFAULT 'error'::text,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  resolved_at timestamp with time zone,
  resolved_by text,
  CONSTRAINT app_errors_pkey PRIMARY KEY (id),
  CONSTRAINT app_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.app_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  login_name text,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  ativo boolean DEFAULT true,
  credential uuid,
  page_permissions ARRAY DEFAULT '{}'::text[],
  plan_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  status_plan uuid,
  payment_status uuid,
  parent_user_id uuid,
  perm_version integer DEFAULT 1,
  CONSTRAINT app_users_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT app_users_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planos_users(id),
  CONSTRAINT app_users_credential_fkey FOREIGN KEY (credential) REFERENCES public.app_credentials_catalog(id),
  CONSTRAINT app_users_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.app_users_credential_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_username text,
  changed_by uuid,
  changed_by_username text,
  before_credential text,
  after_credential text,
  before_pages ARRAY DEFAULT '{}'::text[],
  after_pages ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  action text DEFAULT 'update'::text,
  target_auth_user_id uuid,
  owner_app_user_id uuid,
  target_dependent_id uuid,
  CONSTRAINT app_users_credential_history_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_credential_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT app_users_cred_hist_target_auth_fkey FOREIGN KEY (target_auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT app_users_cred_hist_owner_app_user_fkey FOREIGN KEY (owner_app_user_id) REFERENCES public.app_users(id),
  CONSTRAINT app_users_cred_hist_target_dep_fkey FOREIGN KEY (target_dependent_id) REFERENCES public.app_users_dependentes(id)
);
CREATE TABLE public.app_users_dependentes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  owner_app_user_id uuid NOT NULL,
  username text,
  display_name text,
  email text,
  credential uuid,
  page_permissions ARRAY DEFAULT '{}'::text[],
  ativo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_users_dependentes_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_dependentes_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT app_users_dependentes_owner_app_user_id_fkey FOREIGN KEY (owner_app_user_id) REFERENCES public.app_users(id),
  CONSTRAINT app_users_dependentes_credential_fkey FOREIGN KEY (credential) REFERENCES public.app_credentials_catalog(id)
);
CREATE TABLE public.caracteristica_epi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  caracteristica_material text NOT NULL,
  ativo boolean DEFAULT true,
  CONSTRAINT caracteristica_epi_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cargos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT cargos_pkey PRIMARY KEY (id),
  CONSTRAINT cargos_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.centros_custo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT centros_custo_pkey PRIMARY KEY (id),
  CONSTRAINT centros_custo_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.centros_estoque (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  almox text,
  centro_custo uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ativo boolean DEFAULT true,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT centros_estoque_pkey PRIMARY KEY (id),
  CONSTRAINT centros_estoque_centro_custo_fkey FOREIGN KEY (centro_custo) REFERENCES public.centros_custo(id),
  CONSTRAINT centros_estoque_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.centros_servico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  centro_custo_id uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT centros_servico_pkey PRIMARY KEY (id),
  CONSTRAINT centros_servico_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.centros_custo(id),
  CONSTRAINT centros_servico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.cor (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cor text NOT NULL,
  ativo boolean DEFAULT true,
  CONSTRAINT cor_pkey PRIMARY KEY (id)
);
CREATE TABLE public.entrada_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid,
  material_ent jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  usuarioResponsavel uuid,
  entrada_id uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT entrada_historico_pkey PRIMARY KEY (id),
  CONSTRAINT entrada_historico_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiais(id),
  CONSTRAINT entrada_historico_usuarioResponsavel_fkey FOREIGN KEY (usuarioResponsavel) REFERENCES public.app_users(id),
  CONSTRAINT entrada_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.entradas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  materialId uuid NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0::numeric),
  dataEntrada timestamp with time zone NOT NULL,
  usuarioResponsavel uuid,
  centro_estoque uuid NOT NULL,
  create_at timestamp with time zone DEFAULT now(),
  status uuid DEFAULT '82f86834-5b97-4bf0-9801-1372b6d1bd37'::uuid,
  atualizado_em timestamp with time zone DEFAULT now(),
  usuario_edicao uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT entradas_pkey PRIMARY KEY (id),
  CONSTRAINT entradas_material_id_fkey FOREIGN KEY (materialId) REFERENCES public.materiais(id),
  CONSTRAINT entradas_centro_estoque_fkey FOREIGN KEY (centro_estoque) REFERENCES public.centros_estoque(id),
  CONSTRAINT entradas_usuarioResponsavel_fkey FOREIGN KEY (usuarioResponsavel) REFERENCES public.app_users(id),
  CONSTRAINT entradas_status_fkey FOREIGN KEY (status) REFERENCES public.status_entrada(id),
  CONSTRAINT entradas_usuario_edicao_fkey FOREIGN KEY (usuario_edicao) REFERENCES public.app_users(id),
  CONSTRAINT entradas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.epi_classe (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_epi text NOT NULL,
  ativo boolean DEFAULT true,
  CONSTRAINT epi_classe_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fabricantes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fabricante text NOT NULL,
  ativo boolean DEFAULT true,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT fabricantes_pkey PRIMARY KEY (id),
  CONSTRAINT fabricantes_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.grupos_material (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grupos_material_pkey PRIMARY KEY (id)
);
CREATE TABLE public.grupos_material_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grupos_material_itens_pkey PRIMARY KEY (id),
  CONSTRAINT grupos_material_itens_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_material(id)
);
CREATE TABLE public.hht_mensal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mes_ref date NOT NULL CHECK (EXTRACT(day FROM mes_ref) = 1::numeric),
  centro_servico_id uuid NOT NULL,
  qtd_pessoas integer NOT NULL DEFAULT 0 CHECK (qtd_pessoas >= 0),
  horas_mes_base numeric NOT NULL DEFAULT 0 CHECK (horas_mes_base >= 0::numeric),
  escala_factor numeric NOT NULL DEFAULT 1 CHECK (escala_factor >= 0::numeric),
  horas_afastamento numeric NOT NULL DEFAULT 0 CHECK (horas_afastamento >= 0::numeric),
  horas_ferias numeric NOT NULL DEFAULT 0 CHECK (horas_ferias >= 0::numeric),
  horas_treinamento numeric NOT NULL DEFAULT 0 CHECK (horas_treinamento >= 0::numeric),
  horas_outros_descontos numeric NOT NULL DEFAULT 0 CHECK (horas_outros_descontos >= 0::numeric),
  horas_extras numeric NOT NULL DEFAULT 0 CHECK (horas_extras >= 0::numeric),
  modo text NOT NULL DEFAULT 'simples'::text CHECK (modo = ANY (ARRAY['manual'::text, 'simples'::text, 'completo'::text])),
  hht_informado numeric CHECK (hht_informado IS NULL OR hht_informado >= 0::numeric),
  hht_calculado numeric NOT NULL DEFAULT 0,
  hht_final numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  status_hht_id uuid NOT NULL DEFAULT '3a9aec3f-a1d2-40fd-9ec8-917d88dc2353'::uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT hht_mensal_pkey PRIMARY KEY (id),
  CONSTRAINT hht_mensal_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id),
  CONSTRAINT hht_mensal_centro_servico_id_fkey FOREIGN KEY (centro_servico_id) REFERENCES public.centros_servico(id),
  CONSTRAINT hht_mensal_status_fk FOREIGN KEY (status_hht_id) REFERENCES public.status_hht(id)
);
CREATE TABLE public.hht_mensal_hist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hht_mensal_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao = ANY (ARRAY['UPDATE'::text, 'DELETE'::text])),
  alterado_em timestamp with time zone NOT NULL DEFAULT now(),
  alterado_por uuid,
  antes jsonb NOT NULL,
  depois jsonb,
  motivo text,
  status_hht_nome text,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT hht_mensal_hist_pkey PRIMARY KEY (id),
  CONSTRAINT hht_mensal_hist_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id),
  CONSTRAINT hht_mensal_hist_hht_mensal_id_fkey FOREIGN KEY (hht_mensal_id) REFERENCES public.hht_mensal(id)
);
CREATE TABLE public.materiais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome uuid NOT NULL,
  fabricante uuid NOT NULL,
  validadeDias integer NOT NULL CHECK ("validadeDias" > 0),
  ca text,
  valorUnitario numeric NOT NULL CHECK ("valorUnitario" >= 0::numeric),
  estoqueMinimo integer NOT NULL DEFAULT 0 CHECK ("estoqueMinimo" >= 0),
  ativo boolean NOT NULL DEFAULT true,
  usuarioCadastro uuid NOT NULL,
  dataCadastro timestamp with time zone NOT NULL DEFAULT now(),
  usuarioAtualizacao uuid,
  atualizadoEm timestamp with time zone DEFAULT now(),
  descricao text,
  grupoMaterial uuid NOT NULL,
  numeroCalcado uuid,
  numeroVestimenta uuid,
  numeroEspecifico text,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  hash_base text,
  hash_completo text,
  CONSTRAINT materiais_pkey PRIMARY KEY (id),
  CONSTRAINT materiais_nome_fkey FOREIGN KEY (nome) REFERENCES public.grupos_material_itens(id),
  CONSTRAINT materiais_numeroCalcado_fkey FOREIGN KEY (numeroCalcado) REFERENCES public.medidas_calcado(id),
  CONSTRAINT materiais_numeroVestimenta_fkey FOREIGN KEY (numeroVestimenta) REFERENCES public.medidas_vestimentas(id),
  CONSTRAINT materiais_grupoMaterial_fkey FOREIGN KEY (grupoMaterial) REFERENCES public.grupos_material(id),
  CONSTRAINT materiais_usuarioCadastro_fkey FOREIGN KEY (usuarioCadastro) REFERENCES public.app_users(id),
  CONSTRAINT materiais_usuarioAtualizacao_fkey FOREIGN KEY (usuarioAtualizacao) REFERENCES public.app_users(id),
  CONSTRAINT materiais_fabricante_fkey FOREIGN KEY (fabricante) REFERENCES public.fabricantes(id),
  CONSTRAINT materiais_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.material_grupo_caracteristica_epi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  grupo_caracteristica_epi uuid NOT NULL,
  account_owner_id uuid NOT NULL,
  CONSTRAINT material_grupo_caracteristica_epi_pkey PRIMARY KEY (id),
  CONSTRAINT material_grupo_caracteristica_epi_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiais(id),
  CONSTRAINT material_grupo_caracteristica_epi_gurpo_caracteristica_epi_fkey FOREIGN KEY (grupo_caracteristica_epi) REFERENCES public.caracteristica_epi(id),
  CONSTRAINT material_grupo_carac_owner_fk FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.material_grupo_cor (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  grupo_material_cor uuid NOT NULL,
  account_owner_id uuid NOT NULL,
  CONSTRAINT material_grupo_cor_pkey PRIMARY KEY (id),
  CONSTRAINT material_grupo_cor_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiais(id),
  CONSTRAINT material_grupo_cor_gurpo_material_cor_fkey FOREIGN KEY (grupo_material_cor) REFERENCES public.cor(id),
  CONSTRAINT material_grupo_cor_owner_fk FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.material_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  materialId uuid NOT NULL,
  valorUnitario numeric NOT NULL CHECK ("valorUnitario" >= 0::numeric),
  criadoEm timestamp with time zone NOT NULL DEFAULT now(),
  usuarioResponsavel text NOT NULL DEFAULT 'sistema'::text,
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT material_price_history_pkey PRIMARY KEY (id),
  CONSTRAINT precos_historico_material_id_fkey FOREIGN KEY (materialId) REFERENCES public.materiais(id),
  CONSTRAINT material_price_history_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.medidas_calcado (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_calcado text NOT NULL,
  ativo boolean DEFAULT true,
  CONSTRAINT medidas_calcado_pkey PRIMARY KEY (id)
);
CREATE TABLE public.medidas_vestimentas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medidas text NOT NULL,
  ativo boolean DEFAULT true,
  CONSTRAINT medidas_vestimentas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pessoas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  matricula text NOT NULL CHECK (length(TRIM(BOTH FROM matricula)) > 0),
  usuarioCadastro uuid,
  criadoEm timestamp with time zone NOT NULL DEFAULT now(),
  usuarioEdicao uuid,
  atualizadoEm timestamp with time zone DEFAULT now(),
  dataAdmissao timestamp with time zone NOT NULL DEFAULT now(),
  centro_servico_id uuid NOT NULL,
  setor_id uuid NOT NULL,
  cargo_id uuid NOT NULL,
  centro_custo_id uuid NOT NULL,
  tipo_execucao_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  dataDemissao timestamp with time zone,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  observacao text,
  CONSTRAINT pessoas_pkey PRIMARY KEY (id),
  CONSTRAINT pessoas_usuario_cadastro_fk FOREIGN KEY (usuarioCadastro) REFERENCES public.app_users(id),
  CONSTRAINT pessoas_centro_servico_fk FOREIGN KEY (centro_servico_id) REFERENCES public.centros_servico(id),
  CONSTRAINT pessoas_setor_fk FOREIGN KEY (setor_id) REFERENCES public.setores(id),
  CONSTRAINT pessoas_cargo_fk FOREIGN KEY (cargo_id) REFERENCES public.cargos(id),
  CONSTRAINT pessoas_centro_custo_fk FOREIGN KEY (centro_custo_id) REFERENCES public.centros_custo(id),
  CONSTRAINT pessoas_tipo_execucao_fk FOREIGN KEY (tipo_execucao_id) REFERENCES public.tipo_execucao(id),
  CONSTRAINT pessoas_usuario_edicao_fk FOREIGN KEY (usuarioEdicao) REFERENCES public.app_users(id),
  CONSTRAINT pessoas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.pessoas_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pessoa_id uuid NOT NULL,
  data_edicao timestamp with time zone NOT NULL DEFAULT now(),
  usuario_responsavel uuid NOT NULL,
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT pessoas_historico_pkey PRIMARY KEY (id),
  CONSTRAINT pessoas_historico_usuario_responsavel_fkey FOREIGN KEY (usuario_responsavel) REFERENCES public.app_users(id),
  CONSTRAINT pessoas_historico_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id),
  CONSTRAINT pessoas_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.planos_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  planos character varying,
  description text,
  price numeric,
  billing_period character varying,
  max_clients integer,
  max_orders integer,
  max_users integer,
  features json,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT planos_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.saidas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  materialId uuid NOT NULL,
  pessoaId uuid NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0::numeric),
  dataEntrega timestamp with time zone NOT NULL,
  dataTroca timestamp with time zone,
  status uuid NOT NULL,
  usuarioResponsavel uuid,
  centro_custo uuid NOT NULL,
  centro_servico uuid NOT NULL,
  centro_estoque uuid,
  criadoEm timestamp with time zone DEFAULT now(),
  atualizadoEm timestamp with time zone DEFAULT now(),
  usuarioEdicao uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  isTroca boolean NOT NULL DEFAULT false,
  trocaDeSaida uuid,
  trocaSequencia integer NOT NULL DEFAULT 0,
  CONSTRAINT saidas_pkey PRIMARY KEY (id),
  CONSTRAINT saidas_centro_custo_fkey FOREIGN KEY (centro_custo) REFERENCES public.centros_custo(id),
  CONSTRAINT saidas_centro_servico_fkey FOREIGN KEY (centro_servico) REFERENCES public.centros_servico(id),
  CONSTRAINT saidas_material_id_fkey FOREIGN KEY (materialId) REFERENCES public.materiais(id),
  CONSTRAINT saidas_pessoa_id_fkey FOREIGN KEY (pessoaId) REFERENCES public.pessoas(id),
  CONSTRAINT saidas_status_fkey FOREIGN KEY (status) REFERENCES public.status_saida(id),
  CONSTRAINT saidas_usuarioResponsavel_fkey FOREIGN KEY (usuarioResponsavel) REFERENCES public.app_users(id),
  CONSTRAINT saidas_centro_estoque_fkey FOREIGN KEY (centro_estoque) REFERENCES public.centros_estoque(id),
  CONSTRAINT saidas_usuarioEdicao_fkey FOREIGN KEY (usuarioEdicao) REFERENCES public.app_users(id),
  CONSTRAINT saidas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id),
  CONSTRAINT saidas_trocaDeSaida_fkey FOREIGN KEY (trocaDeSaida) REFERENCES public.saidas(id)
);
CREATE TABLE public.saidas_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  saida_id uuid,
  material_id uuid,
  material_saida jsonb,
  usuarioResponsavel uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT saidas_historico_pkey PRIMARY KEY (id),
  CONSTRAINT saidas_historico_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiais(id),
  CONSTRAINT saidas_historico_usuarioResponsavel_fkey FOREIGN KEY (usuarioResponsavel) REFERENCES public.app_users(id),
  CONSTRAINT saidas_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.setores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  centro_servico_id uuid,
  account_owner_id uuid NOT NULL DEFAULT my_owner_id(),
  CONSTRAINT setores_pkey PRIMARY KEY (id),
  CONSTRAINT setores_centro_servico_id_fkey FOREIGN KEY (centro_servico_id) REFERENCES public.centros_servico(id),
  CONSTRAINT setores_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.status_entrada (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text,
  ativo boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT status_entrada_pkey PRIMARY KEY (id)
);
CREATE TABLE public.status_hht (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT status_hht_pkey PRIMARY KEY (id)
);
CREATE TABLE public.status_saida (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ativo boolean DEFAULT true,
  CONSTRAINT status_saida_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tipo_execucao (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0),
  ordem smallint NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tipo_execucao_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_permission_overrides (
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (user_id, permission_key),
  CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  scope_parent_user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id, scope_parent_user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
