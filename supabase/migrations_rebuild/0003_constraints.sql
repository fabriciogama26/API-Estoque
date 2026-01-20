ALTER TABLE ONLY public.accident_agents
    ADD CONSTRAINT acidente_agentes_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.accident_agents
    ADD CONSTRAINT acidente_agentes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_history
    ADD CONSTRAINT acidente_historico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_injuries
    ADD CONSTRAINT acidente_lesoes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_injuries
    ADD CONSTRAINT acidente_lesoes_unique UNIQUE (agente_id, name);

ALTER TABLE ONLY public.accident_locations
    ADD CONSTRAINT acidente_locais_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.accident_locations
    ADD CONSTRAINT acidente_locais_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_body_part_groups
    ADD CONSTRAINT acidente_partes_grupo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_body_parts
    ADD CONSTRAINT acidente_partes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_body_part_subgroups
    ADD CONSTRAINT acidente_partes_sub_grupo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_types
    ADD CONSTRAINT acidente_tipos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accident_types
    ADD CONSTRAINT acidente_tipos_unique UNIQUE (agente_id, name);

ALTER TABLE ONLY public.accidents
    ADD CONSTRAINT acidentes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_errors
    ADD CONSTRAINT api_errors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_credentials_catalog
    ADD CONSTRAINT app_credentials_catalog_id_text_key UNIQUE (code);

ALTER TABLE ONLY public.app_credentials_catalog
    ADD CONSTRAINT app_credentials_catalog_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_user_credential_history
    ADD CONSTRAINT app_users_credential_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_user_dependents
    ADD CONSTRAINT app_users_dependentes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_username_key UNIQUE (username);

ALTER TABLE ONLY public.ppe_characteristics
    ADD CONSTRAINT caracteristica_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.job_roles
    ADD CONSTRAINT cargos_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.job_roles
    ADD CONSTRAINT cargos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT centros_custo_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT centros_custo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_centers
    ADD CONSTRAINT centros_estoque_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_centers
    ADD CONSTRAINT centros_servico_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.service_centers
    ADD CONSTRAINT centros_servico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT cor_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_entry_history
    ADD CONSTRAINT entrada_historico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ppe_classes
    ADD CONSTRAINT epi_classe_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT fabricantes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT grupos_material_itens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT grupos_material_itens_unique UNIQUE (grupo_id, name);

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT grupos_material_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT grupos_material_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hht_monthly_history
    ADD CONSTRAINT hht_mensal_hist_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hht_monthly
    ADD CONSTRAINT hht_mensal_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materiais_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_ppe_characteristics
    ADD CONSTRAINT material_grupo_caracteristica_epi_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_colors
    ADD CONSTRAINT material_grupo_cor_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shoe_sizes
    ADD CONSTRAINT medidas_numero_calcado_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clothing_sizes
    ADD CONSTRAINT medidas_roupa_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.people_history
    ADD CONSTRAINT pessoas_historico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_plans
    ADD CONSTRAINT planos_users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT precos_historico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_output_history
    ADD CONSTRAINT saida_historico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT setores_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT setores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_entry_statuses
    ADD CONSTRAINT status_entrada_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hht_statuses
    ADD CONSTRAINT status_hht_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_output_statuses
    ADD CONSTRAINT status_saida_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.execution_types
    ADD CONSTRAINT tipo_execucao_nome_unique UNIQUE (name);

ALTER TABLE ONLY public.execution_types
    ADD CONSTRAINT tipo_execucao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (edited_by_user_id, permission_key);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (edited_by_user_id, role_id, scope_parent_user_id);

ALTER TABLE ONLY public.accident_history
    ADD CONSTRAINT acidente_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.accident_history
    ADD CONSTRAINT acidente_historico_acidente_id_fkey FOREIGN KEY (acidente_id) REFERENCES public.accidents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accident_history
    ADD CONSTRAINT acidente_historico_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.accident_history
    ADD CONSTRAINT acidente_historico_usuario_responsavel_fkey FOREIGN KEY (responsible_user) REFERENCES public.app_users(username);

ALTER TABLE ONLY public.accident_injuries
    ADD CONSTRAINT acidente_lesoes_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.accident_agents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accident_body_part_subgroups
    ADD CONSTRAINT acidente_partes_sub_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.accident_body_part_groups(id);

ALTER TABLE ONLY public.accident_types
    ADD CONSTRAINT acidente_tipos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.accident_agents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accidents
    ADD CONSTRAINT acidentes_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.api_errors
    ADD CONSTRAINT api_errors_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.app_user_credential_history
    ADD CONSTRAINT app_users_cred_hist_owner_app_user_fkey FOREIGN KEY (owner_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_user_credential_history
    ADD CONSTRAINT app_users_cred_hist_target_auth_fkey FOREIGN KEY (target_auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_user_credential_history
    ADD CONSTRAINT app_users_cred_hist_target_dep_fkey FOREIGN KEY (target_dependent_id) REFERENCES public.app_user_dependents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_credential_fkey FOREIGN KEY (credential) REFERENCES public.app_credentials_catalog(id);

ALTER TABLE ONLY public.app_user_credential_history
    ADD CONSTRAINT app_users_credential_history_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_user_dependents
    ADD CONSTRAINT app_users_dependentes_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_user_dependents
    ADD CONSTRAINT app_users_dependentes_credential_fkey FOREIGN KEY (credential) REFERENCES public.app_credentials_catalog(id);

ALTER TABLE ONLY public.app_user_dependents
    ADD CONSTRAINT app_users_dependentes_owner_app_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.user_plans(id);

ALTER TABLE ONLY public.job_roles
    ADD CONSTRAINT cargos_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT centros_custo_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_centers
    ADD CONSTRAINT centros_estoque_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_centers
    ADD CONSTRAINT centros_estoque_centro_custo_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE ONLY public.service_centers
    ADD CONSTRAINT centros_servico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.service_centers
    ADD CONSTRAINT centros_servico_centro_custo_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE ONLY public.stock_entry_history
    ADD CONSTRAINT entrada_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_entry_history
    ADD CONSTRAINT entrada_historico_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);

ALTER TABLE ONLY public.stock_entry_history
    ADD CONSTRAINT "entrada_historico_usuarioResponsavel_fkey" FOREIGN KEY ("responsible_user") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_centro_estoque_fkey FOREIGN KEY (stock_center_id) REFERENCES public.stock_centers(id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_material_id_fkey FOREIGN KEY ("material_id") REFERENCES public.materials(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_status_fkey FOREIGN KEY (status) REFERENCES public.stock_entry_statuses(id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT "entradas_usuarioResponsavel_fkey" FOREIGN KEY ("responsible_user") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT entradas_usuario_edicao_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT fabricantes_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT grupos_material_itens_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.material_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hht_monthly
    ADD CONSTRAINT hht_mensal_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.hht_monthly
    ADD CONSTRAINT hht_mensal_centro_servico_id_fkey FOREIGN KEY (service_center_id) REFERENCES public.service_centers(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.hht_monthly_history
    ADD CONSTRAINT hht_mensal_hist_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.hht_monthly_history
    ADD CONSTRAINT hht_mensal_hist_hht_mensal_id_fkey FOREIGN KEY (hht_monthly_id) REFERENCES public.hht_monthly(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hht_monthly
    ADD CONSTRAINT hht_mensal_status_fk FOREIGN KEY (hht_status_id) REFERENCES public.hht_statuses(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materiais_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materiais_fabricante_fkey FOREIGN KEY (manufacturer) REFERENCES public.manufacturers(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT "materiais_grupoMaterial_fkey" FOREIGN KEY ("material_group_id") REFERENCES public.material_groups(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materiais_nome_fkey FOREIGN KEY (name) REFERENCES public.material_group_items(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT "materiais_numeroCalcado_fkey" FOREIGN KEY ("shoe_size_id") REFERENCES public.shoe_sizes(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT "materiais_numeroVestimenta_fkey" FOREIGN KEY ("clothing_size_id") REFERENCES public.clothing_sizes(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT "materiais_usuarioAtualizacao_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT "materiais_usuarioCadastro_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.material_ppe_characteristics
    ADD CONSTRAINT material_grupo_carac_owner_fk FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.material_ppe_characteristics
    ADD CONSTRAINT material_grupo_caracteristica_epi_gurpo_caracteristica_epi_fkey FOREIGN KEY (ppe_characteristic_id) REFERENCES public.ppe_characteristics(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.material_ppe_characteristics
    ADD CONSTRAINT material_grupo_caracteristica_epi_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.material_colors
    ADD CONSTRAINT material_grupo_cor_gurpo_material_cor_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.material_colors
    ADD CONSTRAINT material_grupo_cor_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.material_colors
    ADD CONSTRAINT material_grupo_cor_owner_fk FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_cargo_fk FOREIGN KEY (job_role_id) REFERENCES public.job_roles(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_centro_custo_fk FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_centro_servico_fk FOREIGN KEY (service_center_id) REFERENCES public.service_centers(id);

ALTER TABLE ONLY public.people_history
    ADD CONSTRAINT pessoas_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.people_history
    ADD CONSTRAINT pessoas_historico_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.people_history
    ADD CONSTRAINT pessoas_historico_usuario_responsavel_fkey FOREIGN KEY (responsible_user) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_setor_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_tipo_execucao_fk FOREIGN KEY (execution_type_id) REFERENCES public.execution_types(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_usuario_cadastro_fk FOREIGN KEY ("created_by_user_id") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.people
    ADD CONSTRAINT pessoas_usuario_edicao_fk FOREIGN KEY ("updated_by_user_id") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT precos_historico_material_id_fkey FOREIGN KEY ("material_id") REFERENCES public.materials(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_centro_custo_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_centro_estoque_fkey FOREIGN KEY (stock_center_id) REFERENCES public.stock_centers(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_centro_servico_fkey FOREIGN KEY (service_center) REFERENCES public.service_centers(id);

ALTER TABLE ONLY public.stock_output_history
    ADD CONSTRAINT saidas_historico_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_output_history
    ADD CONSTRAINT saidas_historico_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);

ALTER TABLE ONLY public.stock_output_history
    ADD CONSTRAINT "saidas_historico_usuarioResponsavel_fkey" FOREIGN KEY ("responsible_user") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_material_id_fkey FOREIGN KEY ("material_id") REFERENCES public.materials(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_pessoa_id_fkey FOREIGN KEY ("person_id") REFERENCES public.people(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT saidas_status_fkey FOREIGN KEY (status) REFERENCES public.stock_output_statuses(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT "saidas_trocaDeSaida_fkey" FOREIGN KEY ("exchange_from_output_id") REFERENCES public.stock_outputs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT "saidas_usuarioEdicao_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.stock_outputs
    ADD CONSTRAINT "saidas_usuarioResponsavel_fkey" FOREIGN KEY ("responsible_user") REFERENCES public.app_users(id);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT setores_account_owner_id_fkey FOREIGN KEY (account_owner_id) REFERENCES public.app_users(id);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT setores_centro_servico_id_fkey FOREIGN KEY (service_center_id) REFERENCES public.service_centers(id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
