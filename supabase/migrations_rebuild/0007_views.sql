CREATE VIEW public.people_view WITH (security_invoker='on') AS
 SELECT p.id,
    p.name,
    p.registration_number,
    p.service_center_id,
    cs.name AS service_center_name,
    p.cost_center_id,
    cc.name AS cost_center_name,
    COALESCE(cs.name, cc.name) AS location_name,
    p.department_id,
    st.name AS department_name,
    p.job_role_id,
    cg.name AS job_role,
    p.execution_type_id,
    te.name AS execution_type,
    p.hire_date,
    p.termination_date,
    p.is_active,
    p.created_by_user_id,
    COALESCE(uc.username, uc.display_name, uc.email, (p.created_by_user_id)::text) AS created_by_name,
    uc.username AS created_by_username,
    p.updated_by_user_id,
    COALESCE(ue.username, ue.display_name, ue.email, (p.updated_by_user_id)::text) AS updated_by_name,
    ue.username AS updated_by_username,
    p.created_at,
    p.updated_at
   FROM (((((((public.people p
     LEFT JOIN public.service_centers cs ON ((cs.id = p.service_center_id)))
     LEFT JOIN public.cost_centers cc ON ((cc.id = p.cost_center_id)))
     LEFT JOIN public.departments st ON ((st.id = p.department_id)))
     LEFT JOIN public.job_roles cg ON ((cg.id = p.job_role_id)))
     LEFT JOIN public.execution_types te ON ((te.id = p.execution_type_id)))
     LEFT JOIN public.app_users uc ON ((uc.id = p.created_by_user_id)))
     LEFT JOIN public.app_users ue ON ((ue.id = p.updated_by_user_id)));

CREATE VIEW public.materials_view WITH (security_invoker='on') AS
 WITH caracteristica_bruta AS (
         SELECT mgce.material_id,
            (ce.id)::text AS caracteristica_id,
            ce.characteristic
           FROM (public.material_ppe_characteristics mgce
             LEFT JOIN public.ppe_characteristics ce ON (((ce.id)::text = (mgce.ppe_characteristic_id)::text)))
          WHERE (ce.characteristic IS NOT NULL)
        ), caracteristicas_ord AS (
         SELECT DISTINCT ON (caracteristica_bruta.material_id, (lower(TRIM(BOTH FROM caracteristica_bruta.characteristic)))) caracteristica_bruta.material_id,
            caracteristica_bruta.caracteristica_id,
            caracteristica_bruta.characteristic
           FROM caracteristica_bruta
          ORDER BY caracteristica_bruta.material_id, (lower(TRIM(BOTH FROM caracteristica_bruta.characteristic)))
        ), caracteristicas AS (
         SELECT caracteristicas_ord.material_id,
            array_agg(caracteristicas_ord.caracteristica_id) AS caracteristicas_ids,
            array_agg(caracteristicas_ord.characteristic) AS caracteristicas_nome
           FROM caracteristicas_ord
          GROUP BY caracteristicas_ord.material_id
        ), cor_bruta AS (
         SELECT mgc.material_id,
            (c.id)::text AS cor_id,
            c.name
           FROM (public.material_colors mgc
             LEFT JOIN public.colors c ON (((c.id)::text = (mgc.color_id)::text)))
          WHERE (c.name IS NOT NULL)
        ), cores_ord AS (
         SELECT DISTINCT ON (cor_bruta.material_id, (lower(TRIM(BOTH FROM cor_bruta.name)))) cor_bruta.material_id,
            cor_bruta.cor_id,
            cor_bruta.name
           FROM cor_bruta
          ORDER BY cor_bruta.material_id, (lower(TRIM(BOTH FROM cor_bruta.name)))
        ), cores AS (
         SELECT cores_ord.material_id,
            array_agg(cores_ord.cor_id) AS cores_ids,
            array_agg(cores_ord.name) AS cores_nome
           FROM cores_ord
          GROUP BY cores_ord.material_id
        )
 SELECT m.id,
    m.name,
    gmi.name AS material_item_name,
    m.manufacturer,
    fab.manufacturer AS manufacturer_name,
    m."shelf_life_days",
    m.ca_code,
    m."unit_price",
    m."min_stock",
    m.is_active,
    m.description,
    m."material_group_id",
    gm.name AS material_group_name,
    m."shoe_size_id",
    mc.size AS shoe_size_label,
    m."clothing_size_id",
    mv.size_label AS clothing_size_label,
    m."specific_size",
    cores.cores_ids AS color_ids,
    cores.cores_nome AS color_names,
    COALESCE(array_to_string(cores.cores_nome, '; '::text), ''::text) AS color_text,
    caracteristicas.caracteristicas_ids AS characteristic_ids,
    caracteristicas.caracteristicas_nome AS characteristic_names,
    COALESCE(array_to_string(caracteristicas.caracteristicas_nome, '; '::text), ''::text) AS characteristic_text,
    m."created_by_user_id",
    COALESCE(uc.display_name, uc.username) AS created_by_name,
    uc.username AS created_by_username,
    m."updated_by_user_id",
    COALESCE(ua.display_name, ua.username) AS updated_by_name,
    ua.username AS updated_by_username,
    m.created_at,
    m."updated_at"
   FROM (((((((((public.materials m
     LEFT JOIN public.material_group_items gmi ON (((gmi.id)::text = (m.name)::text)))
     LEFT JOIN public.manufacturers fab ON (((fab.id)::text = (m.manufacturer)::text)))
     LEFT JOIN public.material_groups gm ON (((gm.id)::text = (m."material_group_id")::text)))
     LEFT JOIN public.shoe_sizes mc ON (((mc.id)::text = (m."shoe_size_id")::text)))
     LEFT JOIN public.clothing_sizes mv ON (((mv.id)::text = (m."clothing_size_id")::text)))
     LEFT JOIN public.app_users uc ON (((uc.id)::text = (m."created_by_user_id")::text)))
     LEFT JOIN public.app_users ua ON (((ua.id)::text = (m."updated_by_user_id")::text)))
     LEFT JOIN caracteristicas ON ((caracteristicas.material_id = m.id)))
     LEFT JOIN cores ON ((cores.material_id = m.id)));

CREATE VIEW public.stock_entry_materials_view WITH (security_invoker='on') AS
 SELECT DISTINCT ON (mv.id, e.stock_center_id) mv.id,
    mv.name,
    mv.material_item_name,
    mv.manufacturer,
    mv.manufacturer_name,
    mv."shelf_life_days",
    mv.ca_code,
    mv."unit_price",
    mv."min_stock",
    mv.is_active,
    mv.description,
    mv."material_group_id",
    mv.material_group_name,
    mv."shoe_size_id",
    mv.shoe_size_label,
    mv."clothing_size_id",
    mv.clothing_size_label,
    mv."specific_size",
    mv.color_ids,
    mv.color_names,
    mv.color_text,
    mv.characteristic_ids,
    mv.characteristic_names,
    mv.characteristic_text,
    mv."created_by_user_id",
    mv.created_by_name,
    mv.created_by_username,
    mv."updated_by_user_id",
    mv.updated_by_name,
    mv.updated_by_username,
    mv.created_at,
    mv."updated_at",
    e.stock_center_id,
    ce.warehouse_name AS stock_center_name
   FROM ((public.stock_entries e
     JOIN public.materials_view mv ON ((mv.id = e."material_id")))
     LEFT JOIN public.stock_centers ce ON ((ce.id = e.stock_center_id)))
  ORDER BY mv.id, e.stock_center_id, e."entry_date" DESC NULLS LAST;

CREATE VIEW public.hht_monthly_view WITH (security_invoker='on') AS
 SELECT hm.id,
    hm.month_ref,
    hm.service_center_id,
    cs.name AS service_center_name,
    hm.hht_status_id,
    sh.status AS status_name,
    hm.people_count,
    hm.base_month_hours,
    hm.scale_factor,
    hm.leave_hours,
    hm.vacation_hours,
    hm.training_hours,
    hm.other_discount_hours,
    hm.overtime_hours,
    hm.mode,
    hm.reported_hht,
    hm.calculated_hht,
    hm.final_hht,
    hm.created_at,
    hm.created_by,
    u_created.display_name AS created_by_name,
    u_created.username AS created_by_username,
    hm.updated_at,
    hm.updated_by,
    u_updated.display_name AS updated_by_name,
    u_updated.username AS updated_by_username
   FROM ((((public.hht_monthly hm
     LEFT JOIN public.service_centers cs ON ((cs.id = hm.service_center_id)))
     LEFT JOIN public.hht_statuses sh ON ((sh.id = hm.hht_status_id)))
     LEFT JOIN public.app_users u_created ON ((u_created.id = hm.created_by)))
     LEFT JOIN public.app_users u_updated ON ((u_updated.id = hm.updated_by)));

CREATE VIEW public.unique_materials_view WITH (security_invoker='on') AS
 WITH cores_agg AS (
         SELECT mgc.material_id,
            array_agg(DISTINCT lower(TRIM(BOTH FROM c.name)) ORDER BY (lower(TRIM(BOTH FROM c.name)))) AS cores_array,
            array_to_string(array_agg(DISTINCT lower(TRIM(BOTH FROM c.name)) ORDER BY (lower(TRIM(BOTH FROM c.name)))), ';'::text) AS cores_string
           FROM (public.material_colors mgc
             LEFT JOIN public.colors c ON (((c.id)::text = (mgc.color_id)::text)))
          GROUP BY mgc.material_id
        ), caracteristicas_agg AS (
         SELECT mgce.material_id,
            array_agg(DISTINCT lower(TRIM(BOTH FROM ce.characteristic)) ORDER BY (lower(TRIM(BOTH FROM ce.characteristic)))) AS caracteristicas_array,
            array_to_string(array_agg(DISTINCT lower(TRIM(BOTH FROM ce.characteristic)) ORDER BY (lower(TRIM(BOTH FROM ce.characteristic)))), ';'::text) AS caracteristicas_string
           FROM (public.material_ppe_characteristics mgce
             LEFT JOIN public.ppe_characteristics ce ON (((ce.id)::text = (mgce.ppe_characteristic_id)::text)))
          GROUP BY mgce.material_id
        )
 SELECT m.id,
    m.manufacturer,
    m."material_group_id",
    m."specific_size",
    m."unit_price",
    m.ca_code,
    COALESCE(cores_agg.cores_array, ARRAY[]::text[]) AS cores_array,
    COALESCE(caracteristicas_agg.caracteristicas_array, ARRAY[]::text[]) AS caracteristicas_array,
    md5(lower(concat_ws('|'::text, COALESCE((m.manufacturer)::text, ''::text), COALESCE((m."material_group_id")::text, ''::text), COALESCE(m."specific_size", ''::text), COALESCE(to_char(m."unit_price", 'FM999999990.00'::text), ''::text), COALESCE(NULLIF(m.ca_code, ''::text), ''::text), COALESCE(cores_agg.cores_string, ''::text), COALESCE(caracteristicas_agg.caracteristicas_string, ''::text)))) AS hash_unico
   FROM ((public.materials m
     LEFT JOIN cores_agg ON ((cores_agg.material_id = m.id)))
     LEFT JOIN caracteristicas_agg ON ((caracteristicas_agg.material_id = m.id)));

CREATE VIEW public.current_user_view WITH (security_invoker='on') AS
 WITH base AS (
         SELECT u.id AS edited_by_user_id,
            u.parent_user_id,
            public.my_owner_id(u.id) AS owner_id,
            COALESCE(u.perm_version, 1) AS perm_version
           FROM public.app_users u
          WHERE (u.id = auth.uid())
        ), roles_agg AS (
         SELECT ur.edited_by_user_id,
            array_agg(DISTINCT r.name) AS roles
           FROM (public.user_roles ur
             JOIN public.roles r ON ((r.id = ur.role_id)))
          WHERE (ur.edited_by_user_id = auth.uid())
          GROUP BY ur.edited_by_user_id
        ), is_master AS (
         SELECT (EXISTS ( SELECT 1
                   FROM (public.user_roles ur
                     JOIN public.roles r ON ((r.id = ur.role_id)))
                  WHERE ((ur.edited_by_user_id = auth.uid()) AND (lower(r.name) = 'master'::text)))) AS master_flag
        ), perms AS (
         SELECT public.resolve_user_permissions(auth.uid()) AS permissions
        )
 SELECT b.edited_by_user_id,
    b.owner_id,
    b.parent_user_id,
    COALESCE(ra.roles, '{}'::text[]) AS roles,
    perms.permissions,
    b.perm_version,
    ( SELECT is_master.master_flag
           FROM is_master) AS is_master
   FROM ((base b
     LEFT JOIN roles_agg ra ON ((ra.edited_by_user_id = b.edited_by_user_id)))
     CROSS JOIN perms);

CREATE VIEW public.accident_indicators_view WITH (security_invoker='on') AS
 WITH acidentes_norm AS (
         SELECT a.id,
            (date_part('year'::text, a.accident_date))::integer AS ano,
            to_char(date_trunc('month'::text, a.accident_date), 'YYYY-MM'::text) AS periodo,
            COALESCE(NULLIF(TRIM(BOTH FROM a.service_center), ''::text), 'Nao informado'::text) AS unidade,
            lower(TRIM(BOTH FROM COALESCE(NULLIF(a.service_center, ''::text), 'Nao informado'::text))) AS unidade_key,
            COALESCE(NULLIF(TRIM(BOTH FROM a.job_role), ''::text), 'Nao informado'::text) AS job_role,
            COALESCE(NULLIF(array_remove(ARRAY( SELECT TRIM(BOTH FROM valor.valor) AS btrim
                   FROM unnest(regexp_split_to_array(COALESCE(NULLIF(a.accident_type, ''::text), 'Nao informado'::text), '\s*[;,]\s*'::text)) valor(valor)), ''::text), '{}'::text[]), ARRAY['Nao informado'::text]) AS tipos_array,
            COALESCE(NULLIF(array_remove(ARRAY( SELECT TRIM(BOTH FROM valor.valor) AS btrim
                   FROM unnest(regexp_split_to_array(COALESCE(NULLIF(a.accident_agent, ''::text), 'Nao informado'::text), '\s*[;,]\s*'::text)) valor(valor)), ''::text), '{}'::text[]), ARRAY['Nao informado'::text]) AS agentes_array,
            COALESCE(NULLIF(
                CASE
                    WHEN (COALESCE(array_length(a.injured_body_parts, 1), 0) > 0) THEN array_remove(ARRAY( SELECT TRIM(BOTH FROM valor.valor) AS btrim
                       FROM unnest(a.injured_body_parts) valor(valor)), ''::text)
                    WHEN (pl.parte_legacy IS NOT NULL) THEN ARRAY[pl.parte_legacy]
                    ELSE ARRAY['Nao informado'::text]
                END, '{}'::text[]), ARRAY['Nao informado'::text]) AS partes_array,
            COALESCE(NULLIF(
                CASE
                    WHEN (COALESCE(array_length(a.injuries, 1), 0) > 0) THEN array_remove(ARRAY( SELECT TRIM(BOTH FROM valor.valor) AS btrim
                       FROM unnest(a.injuries) valor(valor)), ''::text)
                    WHEN (pl.lesao_legacy IS NOT NULL) THEN ARRAY[pl.lesao_legacy]
                    ELSE ARRAY['Nao informado'::text]
                END, '{}'::text[]), ARRAY['Nao informado'::text]) AS lesoes_array,
            COALESCE(NULLIF(lower(TRIM(BOTH FROM a.registration_number)), ''::text), NULLIF(lower(TRIM(BOTH FROM a.name)), ''::text), (a.id)::text) AS pessoa_chave,
            GREATEST(COALESCE(a."lost_days", (0)::numeric), (0)::numeric) AS dias_perdidos,
            GREATEST(COALESCE(a."debited_days", (0)::numeric), (0)::numeric) AS dias_debitados
           FROM (public.accidents a
             CROSS JOIN LATERAL ( SELECT NULLIF(TRIM(BOTH FROM COALESCE((to_jsonb(a.*) ->> 'parteLesionada'::text), (to_jsonb(a.*) ->> 'parte_lesionada'::text))), ''::text) AS parte_legacy,
                    NULLIF(TRIM(BOTH FROM COALESCE((to_jsonb(a.*) ->> 'lesao'::text), ''::text)), ''::text) AS lesao_legacy) pl)
          WHERE (a.accident_date IS NOT NULL)
        ), hht_norm AS (
         SELECT to_char(date_trunc('month'::text, (hm.month_ref)::timestamp with time zone), 'YYYY-MM'::text) AS periodo,
            lower(TRIM(BOTH FROM cs.name)) AS unidade_key,
            sum(COALESCE(hm.final_hht, (0)::numeric)) AS hht_total
           FROM ((public.hht_monthly hm
             JOIN public.service_centers cs ON ((cs.id = hm.service_center_id)))
             LEFT JOIN public.hht_statuses sh ON ((sh.id = hm.hht_status_id)))
          WHERE (COALESCE(lower(TRIM(BOTH FROM sh.status)), 'is_active'::text) <> 'cancelado'::text)
          GROUP BY (to_char(date_trunc('month'::text, (hm.month_ref)::timestamp with time zone), 'YYYY-MM'::text)), (lower(TRIM(BOTH FROM cs.name)))
        ), acidentes_por_periodo AS (
         SELECT acidentes_norm.ano,
            acidentes_norm.periodo,
            acidentes_norm.unidade,
            acidentes_norm.unidade_key,
            count(*) AS total_acidentes,
            sum(acidentes_norm.dias_perdidos) AS dias_perdidos,
            sum(acidentes_norm.dias_debitados) AS dias_debitados
           FROM acidentes_norm
          GROUP BY acidentes_norm.ano, acidentes_norm.periodo, acidentes_norm.unidade, acidentes_norm.unidade_key
        ), resumo AS (
         SELECT ap.ano,
            count(*) AS total_acidentes,
            count(*) FILTER (WHERE (ap.dias_perdidos > (0)::numeric)) AS total_acidentes_afastamento,
            count(*) FILTER (WHERE (COALESCE(ap.dias_perdidos, (0)::numeric) = (0)::numeric)) AS total_acidentes_sem_afastamento,
            COALESCE(sum(ap.dias_perdidos), (0)::numeric) AS dias_perdidos,
            COALESCE(sum(ap.dias_debitados), (0)::numeric) AS dias_debitados,
            COALESCE(sum(hp.hht_total), (0)::numeric) AS hht_total
           FROM (acidentes_por_periodo ap
             LEFT JOIN hht_norm hp ON (((hp.periodo = ap.periodo) AND (hp.unidade_key = ap.unidade_key))))
          GROUP BY ap.ano
        ), pessoas_totais AS (
         SELECT (count(*))::numeric AS total_trabalhadores
           FROM public.people p
          WHERE (p.is_active IS TRUE)
        ), resumo_metricas AS (
         SELECT r.ano,
            r.total_acidentes,
            r.total_acidentes_afastamento,
            r.total_acidentes_sem_afastamento,
            r.dias_perdidos,
            r.dias_debitados,
            r.hht_total,
                CASE
                    WHEN (r.hht_total > (0)::numeric) THEN round((((r.total_acidentes)::numeric * (1000000)::numeric) / r.hht_total), 2)
                    ELSE (0)::numeric
                END AS taxa_frequencia_total,
                CASE
                    WHEN (r.hht_total > (0)::numeric) THEN round((((r.total_acidentes_afastamento)::numeric * (1000000)::numeric) / r.hht_total), 2)
                    ELSE (0)::numeric
                END AS taxa_frequencia_afastamento,
                CASE
                    WHEN (r.hht_total > (0)::numeric) THEN round((((r.total_acidentes_sem_afastamento)::numeric * (1000000)::numeric) / r.hht_total), 2)
                    ELSE (0)::numeric
                END AS taxa_frequencia_sem_afastamento,
                CASE
                    WHEN (r.hht_total > (0)::numeric) THEN round(((r.dias_perdidos * (1000000)::numeric) / r.hht_total), 2)
                    ELSE (0)::numeric
                END AS taxa_gravidade_total
           FROM resumo r
        ), tendencia_detalhe AS (
         SELECT ap.ano,
            ap.periodo,
            sum(ap.total_acidentes) AS total_acidentes,
            sum(ap.dias_perdidos) AS dias_perdidos,
            sum(ap.dias_debitados) AS dias_debitados,
            COALESCE(sum(hp.hht_total), (0)::numeric) AS hht_total
           FROM (acidentes_por_periodo ap
             LEFT JOIN hht_norm hp ON (((hp.periodo = ap.periodo) AND (hp.unidade_key = ap.unidade_key))))
          GROUP BY ap.ano, ap.periodo
        ), tendencia AS (
         SELECT td.ano,
            jsonb_agg(jsonb_build_object('periodo', td.periodo, 'total_acidentes', td.total_acidentes, 'dias_perdidos', td.dias_perdidos, 'dias_debitados', td.dias_debitados, 'hht_total', td.hht_total, 'taxa_frequencia',
                CASE
                    WHEN (td.hht_total > (0)::numeric) THEN round(((td.total_acidentes * (1000000)::numeric) / td.hht_total), 2)
                    ELSE (0)::numeric
                END, 'taxa_gravidade',
                CASE
                    WHEN (td.hht_total > (0)::numeric) THEN round((((td.dias_perdidos + td.dias_debitados) * (1000000)::numeric) / td.hht_total), 2)
                    ELSE (0)::numeric
                END) ORDER BY td.periodo) AS tendencia
           FROM tendencia_detalhe td
          GROUP BY td.ano
        ), tipos AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('accident_type', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS tipos
           FROM ( SELECT an.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text) AS label,
                    count(*) AS total
                   FROM (acidentes_norm an
                     CROSS JOIN LATERAL unnest(an.tipos_array) valor(valor))
                  GROUP BY an.ano, COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        ), agentes AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('accident_agent', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS agentes
           FROM ( SELECT an.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text) AS label,
                    count(*) AS total
                   FROM (acidentes_norm an
                     CROSS JOIN LATERAL unnest(an.agentes_array) valor(valor))
                  GROUP BY an.ano, COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        ), partes AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('parte_lesionada', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS injured_body_parts
           FROM ( SELECT an.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text) AS label,
                    count(*) AS total
                   FROM (acidentes_norm an
                     CROSS JOIN LATERAL unnest(an.partes_array) valor(valor))
                  GROUP BY an.ano, COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        ), injuries AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('lesao', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS injuries
           FROM ( SELECT an.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text) AS label,
                    count(*) AS total
                   FROM (acidentes_norm an
                     CROSS JOIN LATERAL unnest(an.lesoes_array) valor(valor))
                  GROUP BY an.ano, COALESCE(NULLIF(TRIM(BOTH FROM valor.valor), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        ), cargos AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('job_role', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS cargos
           FROM ( SELECT acidentes_norm.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM acidentes_norm.job_role), ''::text), 'Nao informado'::text) AS label,
                    count(*) AS total
                   FROM acidentes_norm
                  GROUP BY acidentes_norm.ano, COALESCE(NULLIF(TRIM(BOTH FROM acidentes_norm.job_role), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        ), pessoas_centro AS (
         SELECT item.ano,
            jsonb_agg(jsonb_build_object('service_center', item.label, 'total', item.total) ORDER BY item.total DESC, item.label) AS pessoas_por_centro
           FROM ( SELECT acidentes_norm.ano,
                    COALESCE(NULLIF(TRIM(BOTH FROM acidentes_norm.unidade), ''::text), 'Nao informado'::text) AS label,
                    count(DISTINCT acidentes_norm.pessoa_chave) AS total
                   FROM acidentes_norm
                  WHERE (acidentes_norm.pessoa_chave IS NOT NULL)
                  GROUP BY acidentes_norm.ano, COALESCE(NULLIF(TRIM(BOTH FROM acidentes_norm.unidade), ''::text), 'Nao informado'::text)) item
          GROUP BY item.ano
        )
 SELECT rm.ano,
    'todas'::text AS unidade,
    jsonb_build_object('ano', rm.ano, 'periodo', (rm.ano)::text, 'periodo_label', concat('Ano ', rm.ano), 'total_acidentes', rm.total_acidentes, 'total_acidentes_afastamento', rm.total_acidentes_afastamento, 'total_acidentes_sem_afastamento', rm.total_acidentes_sem_afastamento, 'dias_perdidos', rm.dias_perdidos, 'dias_debitados', rm.dias_debitados, 'hht_total', rm.hht_total, 'taxa_frequencia', rm.taxa_frequencia_total, 'taxa_frequencia_afastamento', rm.taxa_frequencia_afastamento, 'taxa_frequencia_sem_afastamento', rm.taxa_frequencia_sem_afastamento, 'taxa_gravidade', rm.taxa_gravidade_total, 'indice_acidentados', round(((rm.taxa_frequencia_total + rm.taxa_gravidade_total) / (100)::numeric), 2), 'indice_avaliacao_gravidade',
        CASE
            WHEN (rm.total_acidentes_afastamento > 0) THEN round(((rm.dias_perdidos + rm.dias_debitados) / (rm.total_acidentes_afastamento)::numeric), 2)
            ELSE (0)::numeric
        END, 'total_trabalhadores', COALESCE(pt.total_trabalhadores, (0)::numeric), 'indice_relativo_acidentes',
        CASE
            WHEN (COALESCE(pt.total_trabalhadores, (0)::numeric) > (0)::numeric) THEN round((((rm.total_acidentes_afastamento)::numeric * (1000)::numeric) / pt.total_trabalhadores), 2)
            ELSE (0)::numeric
        END) AS resumo,
    COALESCE(t.tendencia, '[]'::jsonb) AS tendencia,
    COALESCE(tp.tipos, '[]'::jsonb) AS tipos,
    COALESCE(pa.injured_body_parts, '[]'::jsonb) AS injured_body_parts,
    COALESCE(ls.injuries, '[]'::jsonb) AS injuries,
    COALESCE(cg.cargos, '[]'::jsonb) AS cargos,
    COALESCE(ag.agentes, '[]'::jsonb) AS agentes,
    COALESCE(pc.pessoas_por_centro, '[]'::jsonb) AS pessoas_por_centro
   FROM ((((((((resumo_metricas rm
     CROSS JOIN pessoas_totais pt)
     LEFT JOIN tendencia t ON ((t.ano = rm.ano)))
     LEFT JOIN tipos tp ON ((tp.ano = rm.ano)))
     LEFT JOIN partes pa ON ((pa.ano = rm.ano)))
     LEFT JOIN injuries ls ON ((ls.ano = rm.ano)))
     LEFT JOIN cargos cg ON ((cg.ano = rm.ano)))
     LEFT JOIN agentes ag ON ((ag.ano = rm.ano)))
     LEFT JOIN pessoas_centro pc ON ((pc.ano = rm.ano)))
  ORDER BY rm.ano DESC;
