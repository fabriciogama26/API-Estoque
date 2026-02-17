CREATE INDEX acidente_agentes_ordem_idx ON public.accident_agents USING btree (is_active DESC, sort_order, name);

CREATE INDEX acidente_historico_acidente_idx ON public.accident_history USING btree (acidente_id, edited_at DESC);

CREATE INDEX acidente_historico_user_id_fkey_idx ON public.accident_history USING btree (edited_by_user_id);

CREATE INDEX acidente_historico_usuario_responsavel_fkey_idx ON public.accident_history USING btree (responsible_user);

CREATE INDEX acidente_lesoes_ordem_idx ON public.accident_injuries USING btree (agente_id, sort_order, name);

CREATE INDEX acidente_locais_ordem_idx ON public.accident_locations USING btree (is_active DESC, sort_order, name);

CREATE INDEX acidente_partes_ordem_idx ON public.accident_body_parts USING btree (grupo, subgrupo, sort_order, name);

CREATE INDEX acidente_partes_sub_grupo_grupo_id_fkey_idx ON public.accident_body_part_subgroups USING btree (grupo_id);

CREATE UNIQUE INDEX acidente_partes_unique_idx ON public.accident_body_parts USING btree (grupo, subgrupo, name);

CREATE INDEX acidente_tipos_agente_idx ON public.accident_types USING btree (agente_id, is_active DESC, sort_order, name);

CREATE INDEX acidentes_matricula_idx ON public.accidents USING btree (lower(registration_number), accident_date DESC);

CREATE INDEX api_errors_created_at_idx ON public.api_errors USING btree (created_at DESC);

CREATE INDEX api_errors_fingerprint_idx ON public.api_errors USING btree (fingerprint);

CREATE INDEX api_errors_path_idx ON public.api_errors USING btree (path);

CREATE INDEX api_errors_service_idx ON public.api_errors USING btree (service);

CREATE INDEX api_errors_status_created_idx ON public.api_errors USING btree (status, created_at DESC);

CREATE INDEX api_errors_user_id_fkey_idx ON public.api_errors USING btree (edited_by_user_id);

CREATE INDEX app_errors_created_at_idx ON public.app_errors USING btree (created_at DESC);

CREATE UNIQUE INDEX app_errors_fingerprint_uidx ON public.app_errors USING btree (fingerprint);

CREATE INDEX app_errors_page_idx ON public.app_errors USING btree (page);

CREATE INDEX app_errors_status_created_idx ON public.app_errors USING btree (status, created_at DESC);

CREATE INDEX app_errors_user_id_fkey_idx ON public.app_errors USING btree (edited_by_user_id);

CREATE INDEX app_users_cred_hist_owner_app_user_idx ON public.app_user_credential_history USING btree (owner_user_id);

CREATE INDEX app_users_cred_hist_target_auth_idx ON public.app_user_credential_history USING btree (target_auth_user_id);

CREATE INDEX app_users_credential_fkey_idx ON public.app_users USING btree (credential);

CREATE INDEX app_users_credential_history_user_id_fkey_idx ON public.app_user_credential_history USING btree (edited_by_user_id);

CREATE INDEX app_users_dependentes_auth_user_id_fkey_idx ON public.app_user_dependents USING btree (auth_user_id);

CREATE INDEX app_users_dependentes_credential_fkey_idx ON public.app_user_dependents USING btree (credential);

CREATE INDEX app_users_dependentes_owner_idx ON public.app_user_dependents USING btree (owner_user_id);

CREATE INDEX app_users_parent_user_idx ON public.app_users USING btree (parent_user_id);

CREATE UNIQUE INDEX app_users_login_name_unique ON public.app_users USING btree (lower(login_name));

CREATE INDEX app_users_plan_id_fkey_idx ON public.app_users USING btree (plan_id);

CREATE INDEX cargos_ordem_idx ON public.job_roles USING btree (is_active DESC, sort_order, name);

CREATE INDEX centros_custo_ordem_idx ON public.cost_centers USING btree (is_active DESC, sort_order, name);

CREATE INDEX centros_estoque_centro_custo_fkey_idx ON public.stock_centers USING btree (cost_center_id);

CREATE INDEX centros_servico_centro_custo_id_fkey_idx ON public.service_centers USING btree (cost_center_id);

CREATE INDEX centros_servico_ordem_idx ON public.service_centers USING btree (is_active DESC, sort_order, name);

CREATE INDEX entrada_historico_entrada_id_idx ON public.stock_entry_history USING btree (entry_id);

CREATE INDEX entrada_historico_material_id_fkey_idx ON public.stock_entry_history USING btree (material_id);

CREATE INDEX "entrada_historico_usuarioResponsavel_fkey_idx" ON public.stock_entry_history USING btree ("responsible_user");

CREATE INDEX entradas_centro_estoque_fkey_idx ON public.stock_entries USING btree (stock_center_id);

CREATE INDEX entradas_material_idx ON public.stock_entries USING btree ("material_id", "entry_date" DESC);

CREATE INDEX entradas_status_fkey_idx ON public.stock_entries USING btree (status);

CREATE INDEX "entradas_usuarioResponsavel_fkey_idx" ON public.stock_entries USING btree ("responsible_user");

CREATE INDEX entradas_usuario_edicao_fkey_idx ON public.stock_entries USING btree (updated_by_user_id);

CREATE INDEX grupos_material_itens_grupo_idx ON public.material_group_items USING btree (grupo_id, sort_order, name);

CREATE INDEX grupos_material_ordem_idx ON public.material_groups USING btree (is_active DESC, sort_order, name);

CREATE INDEX hht_mensal_centro_mes_idx ON public.hht_monthly USING btree (service_center_id, month_ref DESC);

CREATE INDEX hht_mensal_hist_hht_idx ON public.hht_monthly_history USING btree (hht_monthly_id, changed_at DESC);

CREATE UNIQUE INDEX hht_mensal_mes_centro_unique ON public.hht_monthly USING btree (month_ref, service_center_id) WHERE (hht_status_id IS DISTINCT FROM 'e6c084ae-2c89-4a94-b8f8-1ad7b794e9d5'::uuid);

CREATE INDEX hht_mensal_mes_ref_idx ON public.hht_monthly USING btree (month_ref DESC);

CREATE INDEX materiais_ca_norm_idx ON public.materials USING btree (public.fn_normalize_any(ca_code)) WHERE ((ca_code IS NOT NULL) AND (length(TRIM(BOTH FROM ca_code)) > 0));

CREATE INDEX materiais_fabricante_fkey_idx ON public.materials USING btree (manufacturer);

CREATE INDEX "materiais_grupoMaterial_fkey_idx" ON public.materials USING btree ("material_group_id");

CREATE INDEX materiais_nome_fkey_idx ON public.materials USING btree (name);

CREATE INDEX "materiais_numeroCalcado_fkey_idx" ON public.materials USING btree ("shoe_size_id");

CREATE INDEX "materiais_numeroVestimenta_fkey_idx" ON public.materials USING btree ("clothing_size_id");

CREATE INDEX "materiais_usuarioAtualizacao_fkey_idx" ON public.materials USING btree ("updated_by_user_id");

CREATE INDEX "materiais_usuarioCadastro_fkey_idx" ON public.materials USING btree ("created_by_user_id");

CREATE INDEX material_grupo_carac_owner_idx ON public.material_ppe_characteristics USING btree (account_owner_id);

CREATE INDEX material_grupo_caracteristica_epi_gurpo_caracteristica_epi_fkey ON public.material_ppe_characteristics USING btree (ppe_characteristic_id);

CREATE INDEX material_grupo_caracteristica_epi_material_id_fkey_idx ON public.material_ppe_characteristics USING btree (material_id);

CREATE INDEX material_grupo_cor_gurpo_material_cor_fkey_idx ON public.material_colors USING btree (color_id);

CREATE INDEX material_grupo_cor_material_id_fkey_idx ON public.material_colors USING btree (material_id);

CREATE INDEX material_grupo_cor_owner_idx ON public.material_colors USING btree (account_owner_id);

CREATE INDEX material_price_history_material_idx ON public.material_price_history USING btree ("material_id", "created_at" DESC);

CREATE INDEX pessoas_cargo_id_idx ON public.people USING btree (job_role_id);

CREATE INDEX pessoas_centro_custo_id_idx ON public.people USING btree (cost_center_id);

CREATE INDEX pessoas_centro_servico_id_idx ON public.people USING btree (service_center_id);

CREATE INDEX pessoas_historico_pessoa_idx ON public.people_history USING btree (pessoa_id, edited_at DESC);

CREATE INDEX pessoas_historico_usuario_responsavel_fkey_idx ON public.people_history USING btree (responsible_user);

CREATE UNIQUE INDEX pessoas_matricula_unique_idx ON public.people USING btree (lower(registration_number));

CREATE INDEX pessoas_setor_id_idx ON public.people USING btree (department_id);

CREATE INDEX pessoas_tipo_execucao_id_idx ON public.people USING btree (execution_type_id);

CREATE INDEX pessoas_usuario_cadastro_fk_idx ON public.people USING btree ("created_by_user_id");

CREATE INDEX pessoas_usuario_edicao_fk_idx ON public.people USING btree ("updated_by_user_id");

CREATE INDEX saidas_centro_custo_fkey_idx ON public.stock_outputs USING btree (cost_center_id);

CREATE INDEX saidas_centro_estoque_fkey_idx ON public.stock_outputs USING btree (stock_center_id);

CREATE INDEX saidas_centro_servico_fkey_idx ON public.stock_outputs USING btree (service_center);

CREATE INDEX saidas_historico_material_id_fkey_idx ON public.stock_output_history USING btree (material_id);

CREATE INDEX "saidas_historico_usuarioResponsavel_fkey_idx" ON public.stock_output_history USING btree ("responsible_user");

CREATE INDEX saidas_material_idx ON public.stock_outputs USING btree ("material_id", "delivered_at" DESC);

CREATE INDEX saidas_pessoa_idx ON public.stock_outputs USING btree ("person_id", "delivered_at" DESC);

CREATE INDEX saidas_status_fkey_idx ON public.stock_outputs USING btree (status);

CREATE INDEX "saidas_usuarioEdicao_fkey_idx" ON public.stock_outputs USING btree ("updated_by_user_id");

CREATE INDEX "saidas_usuarioResponsavel_fkey_idx" ON public.stock_outputs USING btree ("responsible_user");

CREATE INDEX setores_centro_servico_id_fkey_idx ON public.departments USING btree (service_center_id);

CREATE INDEX setores_ordem_idx ON public.departments USING btree (is_active DESC, sort_order, name);

CREATE INDEX status_hht_id_idx ON public.hht_monthly USING btree (hht_status_id);

CREATE INDEX user_permission_overrides_user_idx ON public.user_permission_overrides USING btree (edited_by_user_id);

CREATE INDEX user_roles_role_idx ON public.user_roles USING btree (role_id);

CREATE INDEX user_roles_user_idx ON public.user_roles USING btree (edited_by_user_id);
