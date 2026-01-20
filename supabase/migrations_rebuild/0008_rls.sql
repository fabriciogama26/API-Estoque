ALTER TABLE ONLY public.app_users FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_agents FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_injuries FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_locations FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_body_parts FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_body_part_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_body_part_subgroups FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.accident_types FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.api_errors FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.app_credentials_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.app_errors FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.app_user_credential_history FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.app_user_dependents FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.ppe_characteristics FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.colors FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.material_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.material_group_items FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.material_ppe_characteristics FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.material_colors FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.shoe_sizes FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.clothing_sizes FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.ppe_classes FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.hht_statuses FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.user_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.role_permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.stock_entry_statuses FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.stock_output_statuses FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.user_permission_overrides FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.accident_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_agentes_select_public ON public.accident_agents FOR SELECT USING (true);

ALTER TABLE public.accident_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_historico_insert_owner ON public.accident_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.write'::text))));

CREATE POLICY acidente_historico_select_owner ON public.accident_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.read'::text) OR public.has_permission('acidentes.write'::text))));

ALTER TABLE public.accident_injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_lesoes_select_public ON public.accident_injuries FOR SELECT USING (true);

ALTER TABLE public.accident_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_locais_select_public ON public.accident_locations FOR SELECT USING (true);

ALTER TABLE public.accident_body_parts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accident_body_part_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_partes_grupo_select_public ON public.accident_body_part_groups FOR SELECT USING (true);

CREATE POLICY acidente_partes_select_public ON public.accident_body_parts FOR SELECT USING (true);

ALTER TABLE public.accident_body_part_subgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_partes_sub_grupo_select_public ON public.accident_body_part_subgroups FOR SELECT USING (true);

ALTER TABLE public.accident_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidente_tipos_select_public ON public.accident_types FOR SELECT USING (true);

ALTER TABLE public.accidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY acidentes_insert_owner ON public.accidents FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.write'::text))));

CREATE POLICY acidentes_select_owner ON public.accidents FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.read'::text) OR public.has_permission('acidentes.write'::text))));

CREATE POLICY acidentes_update_owner ON public.accidents FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('acidentes.write'::text))));

ALTER TABLE public.api_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_errors_insert_service_role ON public.api_errors FOR INSERT TO service_role WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY api_errors_select_service_role ON public.api_errors FOR SELECT TO service_role USING ((auth.role() = 'service_role'::text));

ALTER TABLE public.app_credentials_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_credentials_catalog_block_insert ON public.app_credentials_catalog FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY app_credentials_catalog_block_update ON public.app_credentials_catalog FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY app_credentials_catalog_select ON public.app_credentials_catalog FOR SELECT TO authenticated USING (true);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_errors_insert_authenticated ON public.app_errors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY app_errors_select_master ON public.app_errors FOR SELECT TO authenticated USING (public.is_master());

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_user_credential_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_credential_history_insert_scope ON public.app_user_credential_history FOR INSERT TO authenticated WITH CHECK ((public.is_master() OR (public.has_permission('credentials.manage'::text) AND (COALESCE(owner_user_id, edited_by_user_id) = public.current_account_owner_id()))));

CREATE POLICY app_users_credential_history_select_scope ON public.app_user_credential_history FOR SELECT TO authenticated USING ((public.is_master() OR (COALESCE(owner_user_id, edited_by_user_id) = public.current_account_owner_id())));

ALTER TABLE public.app_user_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_dependentes_insert_scope ON public.app_user_dependents FOR INSERT TO authenticated WITH CHECK ((public.is_master() OR (public.has_permission('users.manage'::text) AND (owner_user_id = public.current_account_owner_id()))));

CREATE POLICY app_users_dependentes_select_scope ON public.app_user_dependents FOR SELECT TO authenticated USING ((public.is_master() OR (owner_user_id = public.current_account_owner_id()) OR (auth_user_id = auth.uid())));

CREATE POLICY app_users_dependentes_update_scope ON public.app_user_dependents FOR UPDATE TO authenticated USING ((public.is_master() OR (public.has_permission('users.manage'::text) AND (owner_user_id = public.current_account_owner_id())))) WITH CHECK ((public.is_master() OR (public.has_permission('users.manage'::text) AND (owner_user_id = public.current_account_owner_id()))));

CREATE POLICY app_users_select_scope ON public.app_users FOR SELECT TO authenticated USING ((public.is_master() OR (id = auth.uid()) OR (COALESCE(parent_user_id, id) = public.current_account_owner_id())));

CREATE POLICY app_users_update_scope ON public.app_users FOR UPDATE TO authenticated USING ((public.is_master() OR (id = auth.uid()) OR (public.has_permission('users.manage'::text) AND (COALESCE(parent_user_id, id) = public.current_account_owner_id())))) WITH CHECK ((public.is_master() OR (id = auth.uid()) OR (public.has_permission('users.manage'::text) AND (COALESCE(parent_user_id, id) = public.current_account_owner_id()))));

ALTER TABLE public.ppe_characteristics ENABLE ROW LEVEL SECURITY;

CREATE POLICY caracteristica_epi_select_public ON public.ppe_characteristics FOR SELECT USING (true);

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY cargos_insert_owner ON public.job_roles FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

CREATE POLICY cargos_select_owner ON public.job_roles FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text))));

CREATE POLICY cargos_update_owner ON public.job_roles FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY centros_custo_insert_owner ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_custo_select_owner ON public.cost_centers FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_custo_update_owner ON public.cost_centers FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text))));

ALTER TABLE public.stock_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY centros_estoque_insert_owner ON public.stock_centers FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_estoque_select_owner ON public.stock_centers FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_estoque_update_owner ON public.stock_centers FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text))));

ALTER TABLE public.service_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY centros_servico_insert_owner ON public.service_centers FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_servico_select_owner ON public.service_centers FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY centros_servico_update_owner ON public.service_centers FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text) OR public.has_permission('estoque.write'::text))));

ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY cor_select_public ON public.colors FOR SELECT USING (true);

ALTER TABLE public.stock_entry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY entrada_historico_insert_owner ON public.stock_entry_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.entradas'::text))));

CREATE POLICY entrada_historico_select_owner ON public.stock_entry_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY entradas_insert_owner ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.entradas'::text))));

CREATE POLICY entradas_select_owner ON public.stock_entries FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY entradas_update_owner ON public.stock_entries FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.entradas'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.entradas'::text))));

ALTER TABLE public.ppe_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY epi_classe_select_public ON public.ppe_classes FOR SELECT USING (true);

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY fabricantes_insert_owner ON public.manufacturers FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY fabricantes_select_owner ON public.manufacturers FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY fabricantes_update_owner ON public.manufacturers FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

ALTER TABLE public.material_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.material_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY grupos_material_itens_select_public ON public.material_group_items FOR SELECT USING (true);

CREATE POLICY grupos_material_select_public ON public.material_groups FOR SELECT USING (true);

ALTER TABLE public.hht_monthly ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hht_monthly_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY hht_mensal_hist_insert_owner ON public.hht_monthly_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.write'::text))));

CREATE POLICY hht_mensal_hist_select_owner ON public.hht_monthly_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.read'::text) OR public.has_permission('hht_value.write'::text))));

CREATE POLICY hht_mensal_insert_owner ON public.hht_monthly FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.write'::text))));

CREATE POLICY hht_mensal_select_owner ON public.hht_monthly FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.read'::text) OR public.has_permission('hht_value.write'::text))));

CREATE POLICY hht_mensal_update_owner ON public.hht_monthly FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('hht_value.write'::text))));

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY materiais_insert_owner ON public.materials FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY materiais_select_owner ON public.materials FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY materiais_update_owner ON public.materials FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

ALTER TABLE public.material_ppe_characteristics ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_grupo_caracteristica_epi_insert_owner ON public.material_ppe_characteristics FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_grupo_caracteristica_epi_select_owner ON public.material_ppe_characteristics FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_grupo_caracteristica_epi_update_owner ON public.material_ppe_characteristics FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

ALTER TABLE public.material_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_grupo_cor_insert_owner ON public.material_colors FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_grupo_cor_select_owner ON public.material_colors FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_grupo_cor_update_owner ON public.material_colors FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

ALTER TABLE public.material_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_price_history_insert_owner ON public.material_price_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_price_history_select_owner ON public.material_price_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

CREATE POLICY material_price_history_update_owner ON public.material_price_history FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.materiais'::text))));

ALTER TABLE public.shoe_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY medidas_calcado_select_public ON public.shoe_sizes FOR SELECT USING (true);

ALTER TABLE public.clothing_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY medidas_vestimentas_select_public ON public.clothing_sizes FOR SELECT USING (true);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY permissions_block_delete ON public.permissions FOR DELETE TO authenticated USING (false);

CREATE POLICY permissions_block_insert ON public.permissions FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY permissions_block_update ON public.permissions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY permissions_select_authenticated ON public.permissions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.people_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pessoas_historico_insert_owner ON public.people_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

CREATE POLICY pessoas_historico_select_owner ON public.people_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text))));

CREATE POLICY pessoas_insert_owner ON public.people FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

CREATE POLICY pessoas_select_owner ON public.people FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text))));

CREATE POLICY pessoas_update_owner ON public.people FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY planos_users_block_insert ON public.user_plans FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY planos_users_block_update ON public.user_plans FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY planos_users_select_authenticated ON public.user_plans FOR SELECT TO authenticated USING (true);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_block_delete ON public.role_permissions FOR DELETE TO authenticated USING (false);

CREATE POLICY role_permissions_block_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY role_permissions_block_update ON public.role_permissions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY role_permissions_select_authenticated ON public.role_permissions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_block_insert ON public.roles FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY roles_block_update ON public.roles FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true);

ALTER TABLE public.stock_outputs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_output_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY saidas_historico_insert_owner ON public.stock_output_history FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.saidas'::text))));

CREATE POLICY saidas_historico_select_owner ON public.stock_output_history FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY saidas_insert_owner ON public.stock_outputs FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.saidas'::text))));

CREATE POLICY saidas_select_owner ON public.stock_outputs FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.read'::text) OR public.has_permission('estoque.write'::text))));

CREATE POLICY saidas_update_owner ON public.stock_outputs FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.saidas'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('estoque.write'::text) OR public.has_permission('estoque.saidas'::text))));

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY setores_insert_owner ON public.departments FOR INSERT TO authenticated WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

CREATE POLICY setores_select_owner ON public.departments FOR SELECT TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.read'::text) OR public.has_permission('pessoas.write'::text))));

CREATE POLICY setores_update_owner ON public.departments FOR UPDATE TO authenticated USING (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text)))) WITH CHECK (((public.is_master() OR (account_owner_id = public.my_owner_id())) AND (public.is_master() OR public.has_permission('pessoas.write'::text))));

ALTER TABLE public.stock_entry_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY status_entrada_select_public ON public.stock_entry_statuses FOR SELECT USING (true);

ALTER TABLE public.hht_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY status_hht_select_public ON public.hht_statuses FOR SELECT USING (true);

ALTER TABLE public.stock_output_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY status_saida_block_delete ON public.stock_output_statuses FOR DELETE TO authenticated USING (false);

CREATE POLICY status_saida_block_insert ON public.stock_output_statuses FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY status_saida_block_update ON public.stock_output_statuses FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY status_saida_select_all ON public.stock_output_statuses FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY status_saida_select_public ON public.stock_output_statuses FOR SELECT USING (true);

ALTER TABLE public.execution_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipo_execucao_block_delete ON public.execution_types FOR DELETE TO authenticated USING (false);

CREATE POLICY tipo_execucao_block_insert ON public.execution_types FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY tipo_execucao_block_update ON public.execution_types FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY tipo_execucao_select_all ON public.execution_types FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permission_overrides_delete_scope ON public.user_permission_overrides FOR DELETE TO authenticated USING ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (EXISTS ( SELECT 1
   FROM public.app_users u
  WHERE ((u.id = user_permission_overrides.edited_by_user_id) AND (COALESCE(u.parent_user_id, u.id) = public.current_account_owner_id())))))));

CREATE POLICY user_permission_overrides_insert_scope ON public.user_permission_overrides FOR INSERT TO authenticated WITH CHECK ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (EXISTS ( SELECT 1
   FROM public.app_users u
  WHERE ((u.id = user_permission_overrides.edited_by_user_id) AND (COALESCE(u.parent_user_id, u.id) = public.current_account_owner_id())))))));

CREATE POLICY user_permission_overrides_select_scope ON public.user_permission_overrides FOR SELECT TO authenticated USING ((public.is_master() OR (edited_by_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_users u
  WHERE ((u.id = user_permission_overrides.edited_by_user_id) AND (COALESCE(u.parent_user_id, u.id) = public.current_account_owner_id()))))));

CREATE POLICY user_permission_overrides_update_scope ON public.user_permission_overrides FOR UPDATE TO authenticated USING ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (EXISTS ( SELECT 1
   FROM public.app_users u
  WHERE ((u.id = user_permission_overrides.edited_by_user_id) AND (COALESCE(u.parent_user_id, u.id) = public.current_account_owner_id()))))))) WITH CHECK ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (EXISTS ( SELECT 1
   FROM public.app_users u
  WHERE ((u.id = user_permission_overrides.edited_by_user_id) AND (COALESCE(u.parent_user_id, u.id) = public.current_account_owner_id())))))));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_insert_scope ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (scope_parent_user_id = public.current_account_owner_id()))));

CREATE POLICY user_roles_select_scope ON public.user_roles FOR SELECT TO authenticated USING ((public.is_master() OR (scope_parent_user_id = public.current_account_owner_id()) OR (edited_by_user_id = auth.uid())));

CREATE POLICY user_roles_update_scope ON public.user_roles FOR UPDATE TO authenticated USING ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (scope_parent_user_id = public.current_account_owner_id())))) WITH CHECK ((public.is_master() OR (public.has_permission('rbac.manage'::text) AND (scope_parent_user_id = public.current_account_owner_id()))));
