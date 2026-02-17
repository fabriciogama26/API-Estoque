CREATE TABLE public.accidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registration_number text NOT NULL,
    name text NOT NULL,
    job_role text NOT NULL,
    accident_date timestamp with time zone NOT NULL,
    "lost_days" numeric(14,2) DEFAULT 0 NOT NULL,
    "debited_days" numeric(14,2) DEFAULT 0 NOT NULL,
    accident_type text DEFAULT ''::text NOT NULL,
    accident_agent text DEFAULT ''::text NOT NULL,
    icd_code text,
    service_center text NOT NULL,
    location_name text NOT NULL,
    cat_number text,
    notes text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_by_username" text,
    "updated_by_username" text,
    hht_value numeric(14,2) DEFAULT 0,
    injured_body_parts text[] DEFAULT '{}'::text[] NOT NULL,
    injuries text[] DEFAULT '{}'::text[] NOT NULL,
    esocial_date timestamp with time zone,
    sesmt_involved boolean DEFAULT false,
    sesmt_date timestamp with time zone,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    is_active boolean DEFAULT true,
    "cancel_reason" text,
    CONSTRAINT "acidentes_diasDebitados_check" CHECK (("debited_days" >= (0)::numeric)),
    CONSTRAINT "acidentes_diasPerdidos_check" CHECK (("lost_days" >= (0)::numeric)),
    CONSTRAINT acidentes_hht_check CHECK ((hht_value >= (0)::numeric))
);

CREATE TABLE public.stock_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "material_id" uuid NOT NULL,
    quantity numeric(14,2) NOT NULL,
    "entry_date" timestamp with time zone NOT NULL,
    "responsible_user" uuid,
    stock_center_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status uuid DEFAULT '82f86834-5b97-4bf0-9801-1372b6d1bd37'::uuid,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by_user_id uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT entradas_quantidade_check CHECK ((quantity > (0)::numeric))
);

CREATE TABLE public.hht_monthly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month_ref date NOT NULL,
    service_center_id uuid NOT NULL,
    people_count integer DEFAULT 0 NOT NULL,
    base_month_hours numeric(10,2) DEFAULT 0 NOT NULL,
    scale_factor numeric(10,4) DEFAULT 1 NOT NULL,
    leave_hours numeric(10,2) DEFAULT 0 NOT NULL,
    vacation_hours numeric(10,2) DEFAULT 0 NOT NULL,
    training_hours numeric(10,2) DEFAULT 0 NOT NULL,
    other_discount_hours numeric(10,2) DEFAULT 0 NOT NULL,
    overtime_hours numeric(10,2) DEFAULT 0 NOT NULL,
    mode text DEFAULT 'simples'::text NOT NULL,
    reported_hht numeric(12,2),
    calculated_hht numeric(12,2) DEFAULT 0 NOT NULL,
    final_hht numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    hht_status_id uuid DEFAULT '3a9aec3f-a1d2-40fd-9ec8-917d88dc2353'::uuid NOT NULL,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT hht_mensal_escala_factor_check CHECK ((scale_factor >= (0)::numeric)),
    CONSTRAINT hht_mensal_hht_informado_check CHECK (((reported_hht IS NULL) OR (reported_hht >= (0)::numeric))),
    CONSTRAINT hht_mensal_hht_informado_only_manual CHECK (((reported_hht IS NULL) OR (mode = 'manual'::text))),
    CONSTRAINT hht_mensal_horas_afastamento_check CHECK ((leave_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_horas_extras_check CHECK ((overtime_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_horas_ferias_check CHECK ((vacation_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_horas_mes_base_check CHECK ((base_month_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_horas_outros_descontos_check CHECK ((other_discount_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_horas_treinamento_check CHECK ((training_hours >= (0)::numeric)),
    CONSTRAINT hht_mensal_mes_ref_primeiro_dia CHECK ((EXTRACT(day FROM month_ref) = (1)::numeric)),
    CONSTRAINT hht_mensal_modo_check CHECK ((mode = ANY (ARRAY['manual'::text, 'simples'::text, 'completo'::text]))),
    CONSTRAINT hht_mensal_qtd_pessoas_check CHECK ((people_count >= 0))
);

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    login_name text,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    is_active boolean DEFAULT true,
    credential uuid,
    page_permissions text[] DEFAULT '{}'::text[],
    plan_id uuid,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    status_plan uuid,
    payment_status uuid,
    parent_user_id uuid,
    perm_version integer DEFAULT 1
);

CREATE TABLE public.job_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT cargos_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT centros_custo_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.service_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_center_id uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT centros_servico_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    registration_number text NOT NULL,
    "created_by_user_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by_user_id" uuid,
    "updated_at" timestamp with time zone DEFAULT now(),
    "hire_date" timestamp with time zone DEFAULT now() NOT NULL,
    service_center_id uuid NOT NULL,
    department_id uuid NOT NULL,
    job_role_id uuid NOT NULL,
    cost_center_id uuid NOT NULL,
    execution_type_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "termination_date" timestamp with time zone,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    notes text,
    CONSTRAINT pessoas_matricula_not_blank CHECK ((length(TRIM(BOTH FROM registration_number)) > 0))
);

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_center_id uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT setores_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.execution_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tipo_execucao_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.stock_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "material_id" uuid NOT NULL,
    "person_id" uuid NOT NULL,
    quantity numeric(14,2) NOT NULL,
    "delivered_at" timestamp with time zone NOT NULL,
    "exchange_at" timestamp with time zone,
    status uuid NOT NULL,
    "responsible_user" uuid,
    cost_center_id uuid NOT NULL,
    service_center uuid NOT NULL,
    stock_center_id uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "updated_by_user_id" uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    "is_exchange" boolean DEFAULT false NOT NULL,
    "exchange_from_output_id" uuid,
    "exchange_sequence" integer DEFAULT 0 NOT NULL,
    CONSTRAINT saidas_quantidade_check CHECK ((quantity > (0)::numeric))
);

CREATE TABLE public.accident_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acidente_agentes_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.accident_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    acidente_id uuid NOT NULL,
    edited_at timestamp with time zone DEFAULT now() NOT NULL,
    responsible_user text DEFAULT ''::text NOT NULL,
    changed_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    edited_by_user_id uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.accident_injuries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agente_id uuid,
    CONSTRAINT acidente_lesoes_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.accident_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acidente_locais_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.accident_body_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    grupo text DEFAULT ''::text NOT NULL,
    subgrupo text DEFAULT ''::text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acidente_partes_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.accident_body_part_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order smallint
);

CREATE TABLE public.accident_body_part_subgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    grupo_id uuid
);

CREATE TABLE public.accident_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agente_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acidente_tipos_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.api_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'api'::text NOT NULL,
    service text DEFAULT 'api'::text NOT NULL,
    method text,
    path text,
    status integer,
    code text,
    edited_by_user_id uuid,
    message text NOT NULL,
    stack text,
    context jsonb,
    severity text DEFAULT 'error'::text NOT NULL,
    fingerprint text NOT NULL
);

CREATE TABLE public.app_credentials_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    label text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    level smallint DEFAULT '2'::smallint
);

CREATE TABLE public.app_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'app'::text NOT NULL,
    page text DEFAULT ''::text NOT NULL,
    edited_by_user_id uuid,
    message text NOT NULL,
    stack text,
    context jsonb,
    severity text DEFAULT 'error'::text NOT NULL,
    fingerprint text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text
);

CREATE TABLE public.app_user_credential_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edited_by_user_id uuid NOT NULL,
    user_username text,
    changed_by uuid,
    changed_by_username text,
    before_credential text,
    after_credential text,
    before_pages text[] DEFAULT '{}'::text[],
    after_pages text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    action text DEFAULT 'update'::text,
    target_auth_user_id uuid,
    owner_user_id uuid,
    target_dependent_id uuid
);

CREATE TABLE public.app_user_dependents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    username text,
    display_name text,
    email text,
    credential uuid,
    page_permissions text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ppe_characteristics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    characteristic text NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.stock_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_name text,
    cost_center_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.stock_entry_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    material_snapshot jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "responsible_user" uuid,
    entry_id uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer text NOT NULL,
    is_active boolean DEFAULT true,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.material_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grupos_material_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.material_group_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grupos_material_itens_nome_not_blank CHECK ((length(btrim(name)) > 0))
);

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name uuid NOT NULL,
    manufacturer uuid NOT NULL,
    "shelf_life_days" integer NOT NULL,
    ca_code text,
    "unit_price" numeric(14,2) NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "created_by_user_id" uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by_user_id" uuid,
    "updated_at" timestamp with time zone DEFAULT now(),
    description text,
    "material_group_id" uuid NOT NULL,
    "shoe_size_id" uuid,
    "clothing_size_id" uuid,
    "specific_size" text,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    base_hash text,
    full_hash text,
    CONSTRAINT materiais_estoque_minimo_check CHECK (("min_stock" >= 0)),
    CONSTRAINT materiais_validade_dias_check CHECK (("shelf_life_days" > 0)),
    CONSTRAINT materiais_valor_unitario_check CHECK (("unit_price" >= (0)::numeric))
);

CREATE TABLE public.material_ppe_characteristics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    ppe_characteristic_id uuid NOT NULL,
    account_owner_id uuid NOT NULL
);

CREATE TABLE public.material_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    color_id uuid NOT NULL,
    account_owner_id uuid NOT NULL
);

CREATE TABLE public.shoe_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    size text NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.clothing_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    size_label text NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.ppe_classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_name text NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.hht_monthly_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hht_monthly_id uuid NOT NULL,
    action text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    before jsonb NOT NULL,
    after jsonb,
    reason text,
    hht_status_name text,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT hht_mensal_hist_acao_check CHECK ((action = ANY (ARRAY['UPDATE'::text, 'DELETE'::text])))
);

CREATE TABLE public.hht_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.material_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "material_id" uuid NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "responsible_user" text DEFAULT 'sistema'::text NOT NULL,
    changed_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL,
    CONSTRAINT precos_historico_valor_unitario_check CHECK (("unit_price" >= (0)::numeric))
);

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.people_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pessoa_id uuid NOT NULL,
    edited_at timestamp with time zone DEFAULT now() NOT NULL,
    responsible_user uuid NOT NULL,
    changed_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.user_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    planos character varying,
    description text,
    price numeric,
    billing_period character varying,
    max_clients integer,
    max_orders integer,
    max_users integer,
    features json,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.stock_output_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    output_id uuid,
    material_id uuid,
    material_snapshot jsonb,
    "responsible_user" uuid,
    account_owner_id uuid DEFAULT public.my_owner_id() NOT NULL
);

CREATE TABLE public.stock_entry_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text,
    is_active boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.stock_output_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true
);

CREATE TABLE public.user_permission_overrides (
    edited_by_user_id uuid NOT NULL,
    permission_key text NOT NULL,
    allowed boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
    edited_by_user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_parent_user_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.accidents OWNER TO postgres;

ALTER TABLE public.stock_entries OWNER TO postgres;

ALTER TABLE public.hht_monthly OWNER TO postgres;

ALTER TABLE public.app_users OWNER TO postgres;

ALTER TABLE public.job_roles OWNER TO postgres;

ALTER TABLE public.cost_centers OWNER TO postgres;

ALTER TABLE public.service_centers OWNER TO postgres;

ALTER TABLE public.people OWNER TO postgres;

ALTER TABLE public.departments OWNER TO postgres;

ALTER TABLE public.execution_types OWNER TO postgres;

ALTER TABLE public.stock_outputs OWNER TO postgres;

ALTER TABLE public.accident_agents OWNER TO postgres;

ALTER TABLE public.accident_history OWNER TO postgres;

ALTER TABLE public.accident_injuries OWNER TO postgres;

ALTER TABLE public.accident_locations OWNER TO postgres;

ALTER TABLE public.accident_body_parts OWNER TO postgres;

ALTER TABLE public.accident_body_part_groups OWNER TO postgres;

ALTER TABLE public.accident_body_part_subgroups OWNER TO postgres;

ALTER TABLE public.accident_types OWNER TO postgres;

ALTER TABLE public.api_errors OWNER TO postgres;

ALTER TABLE public.app_credentials_catalog OWNER TO postgres;

ALTER TABLE public.app_errors OWNER TO postgres;

ALTER TABLE public.app_user_credential_history OWNER TO postgres;

ALTER TABLE public.app_user_dependents OWNER TO postgres;

ALTER TABLE public.ppe_characteristics OWNER TO postgres;

ALTER TABLE public.stock_centers OWNER TO postgres;

ALTER TABLE public.colors OWNER TO postgres;

ALTER TABLE public.stock_entry_history OWNER TO postgres;

ALTER TABLE public.manufacturers OWNER TO postgres;

ALTER TABLE public.material_groups OWNER TO postgres;

ALTER TABLE public.material_group_items OWNER TO postgres;

ALTER TABLE public.materials OWNER TO postgres;

ALTER TABLE public.material_ppe_characteristics OWNER TO postgres;

ALTER TABLE public.material_colors OWNER TO postgres;

ALTER TABLE public.shoe_sizes OWNER TO postgres;

ALTER TABLE public.clothing_sizes OWNER TO postgres;

ALTER TABLE public.ppe_classes OWNER TO postgres;

ALTER TABLE public.hht_monthly_history OWNER TO postgres;

ALTER TABLE public.hht_statuses OWNER TO postgres;

ALTER TABLE public.material_price_history OWNER TO postgres;

ALTER TABLE public.permissions OWNER TO postgres;

ALTER TABLE public.people_history OWNER TO postgres;

ALTER TABLE public.user_plans OWNER TO postgres;

ALTER TABLE public.role_permissions OWNER TO postgres;

ALTER TABLE public.roles OWNER TO postgres;

ALTER TABLE public.stock_output_history OWNER TO postgres;

ALTER TABLE public.stock_entry_statuses OWNER TO postgres;

ALTER TABLE public.stock_output_statuses OWNER TO postgres;

ALTER TABLE public.user_permission_overrides OWNER TO postgres;

ALTER TABLE public.user_roles OWNER TO postgres;

ALTER TABLE public.materials DISABLE TRIGGER impedir_material_duplicado;

ALTER TABLE public.stock_outputs DISABLE TRIGGER trg_set_owner_saidas;

ALTER TABLE public.stock_outputs DISABLE TRIGGER trg_set_saida_troca_meta;

COMMENT ON COLUMN public.app_users.credential IS 'Credencial do usuario (ex.: admin, operador, visitante).';

COMMENT ON COLUMN public.app_users.page_permissions IS 'Lista de rotas/paginas que o usuario pode acessar. Quando vazia, segue o padrao da credencial.';

COMMENT ON TABLE public.api_errors IS 'Registros de erros do backend/API';

COMMENT ON COLUMN public.api_errors.environment IS 'Ambiente: api/dev/prod/homolog';

COMMENT ON COLUMN public.api_errors.service IS 'Servico ou modulo que gerou o log';

COMMENT ON COLUMN public.api_errors.path IS 'Path/rota da requisicao';

COMMENT ON COLUMN public.api_errors.context IS 'Contexto adicional em JSON';

COMMENT ON COLUMN public.api_errors.fingerprint IS 'Hash simples para deduplicar erros semelhantes';

COMMENT ON TABLE public.app_errors IS 'Registros de erros do app';

COMMENT ON COLUMN public.app_errors.environment IS 'Ambiente: app/dev/prod/homolog';

COMMENT ON COLUMN public.app_errors.page IS 'Pagina ou rota onde ocorreu o erro';

COMMENT ON COLUMN public.app_errors.context IS 'Contexto adicional em JSON';

COMMENT ON COLUMN public.app_errors.fingerprint IS 'Hash simples para deduplicar erros semelhantes';

COMMENT ON COLUMN public.app_errors.status IS 'Estado do erro: open/ignored/resolved';

COMMENT ON TABLE public.app_user_credential_history IS 'Historico de alteracoes de credential/page_permissions para app_users.';

COMMENT ON COLUMN public.app_user_credential_history.action IS 'Tipo da action (ex.: update, password_reset).';

COMMENT ON COLUMN public.app_user_credential_history.target_auth_user_id IS 'o id do login no auth.users (titular ou dependente). É o identificador universal do usuário que sofreu a ação.';

COMMENT ON COLUMN public.app_user_credential_history.owner_user_id IS 'o id do titular em app_users. Só é preenchido quando o alvo é um dependente; serve para saber quem é o “pai”.';

COMMENT ON COLUMN public.app_user_credential_history.target_dependent_id IS 'o id da linha do dependente em app_users_dependentes. Também só faz sentido quando o alvo é dependente; permite auditar exatamente qual dependente (caso precise mais detalhes da linha).';

COMMENT ON TABLE public.material_price_history IS 'Histórico de edições dos materiais.';

COMMENT ON COLUMN public.material_price_history.changed_fields IS 'Lista de campos alterados em cada edição.';
