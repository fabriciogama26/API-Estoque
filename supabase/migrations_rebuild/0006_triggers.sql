CREATE TRIGGER acidente_historico_set_account_owner_id BEFORE INSERT ON public.accident_history FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER acidentes_set_account_owner_id BEFORE INSERT ON public.accidents FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER app_users_dependentes_sync AFTER INSERT OR DELETE OR UPDATE ON public.app_user_dependents FOR EACH ROW EXECUTE FUNCTION public.sync_app_users_from_dependentes();

CREATE TRIGGER caracteristica_epi_set_account_owner_id BEFORE INSERT ON public.ppe_characteristics FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER cargos_set_account_owner_id BEFORE INSERT ON public.job_roles FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER centros_custo_set_account_owner_id BEFORE INSERT ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER centros_estoque_set_account_owner_id BEFORE INSERT ON public.stock_centers FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER centros_servico_set_account_owner_id BEFORE INSERT ON public.service_centers FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER cor_set_account_owner_id BEFORE INSERT ON public.colors FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER entrada_historico_set_account_owner_id BEFORE INSERT ON public.stock_entry_history FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER entradas_set_account_owner_id BEFORE INSERT ON public.stock_entries FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER fabricantes_set_account_owner_id BEFORE INSERT ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER grupos_material_itens_set_account_owner_id BEFORE INSERT ON public.material_group_items FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER grupos_material_set_account_owner_id BEFORE INSERT ON public.material_groups FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER hht_mensal_apply_calcs_trigger BEFORE INSERT OR UPDATE ON public.hht_monthly FOR EACH ROW EXECUTE FUNCTION public.hht_mensal_apply_calcs();

CREATE TRIGGER hht_mensal_hist_set_account_owner_id BEFORE INSERT ON public.hht_monthly_history FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER hht_mensal_hist_trigger_delete BEFORE DELETE ON public.hht_monthly FOR EACH ROW EXECUTE FUNCTION public.hht_mensal_log_update_delete();

CREATE TRIGGER hht_mensal_hist_trigger_update AFTER UPDATE ON public.hht_monthly FOR EACH ROW EXECUTE FUNCTION public.hht_mensal_log_update_delete();

CREATE TRIGGER hht_mensal_prevent_inactivation_trigger BEFORE DELETE OR UPDATE ON public.hht_monthly FOR EACH ROW EXECUTE FUNCTION public.hht_mensal_prevent_inactivation();

CREATE TRIGGER hht_mensal_set_account_owner_id BEFORE INSERT ON public.hht_monthly FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER impedir_material_duplicado BEFORE INSERT ON public.materials FOR EACH ROW EXECUTE FUNCTION public.evitar_duplicidade_material();

CREATE TRIGGER impedir_material_duplicado_caracteristica AFTER INSERT OR DELETE OR UPDATE ON public.material_ppe_characteristics FOR EACH ROW EXECUTE FUNCTION public.verificar_duplicidade_material_relacionado();

CREATE TRIGGER impedir_material_duplicado_cor AFTER INSERT OR DELETE OR UPDATE ON public.material_colors FOR EACH ROW EXECUTE FUNCTION public.verificar_duplicidade_material_relacionado();

CREATE TRIGGER impedir_material_duplicado_update BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.evitar_duplicidade_material_update();

CREATE TRIGGER impedir_pessoa_duplicada BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.evitar_duplicidade_pessoa();

CREATE TRIGGER materiais_set_account_owner_id BEFORE INSERT ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER pessoas_historico_set_account_owner_id BEFORE INSERT ON public.people_history FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER pessoas_set_account_owner_id BEFORE INSERT ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER revalidar_material_caracteristicas AFTER INSERT OR DELETE OR UPDATE ON public.material_ppe_characteristics FOR EACH ROW EXECUTE FUNCTION public.revalidar_material_hash();

CREATE TRIGGER revalidar_material_cores AFTER INSERT OR DELETE OR UPDATE ON public.material_colors FOR EACH ROW EXECUTE FUNCTION public.revalidar_material_hash();

CREATE TRIGGER saidas_historico_set_account_owner_id BEFORE INSERT ON public.stock_output_history FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER saidas_set_account_owner_id BEFORE INSERT ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER setores_set_account_owner_id BEFORE INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER status_entrada_set_account_owner_id BEFORE INSERT ON public.stock_entry_statuses FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER status_hht_set_account_owner_id BEFORE INSERT ON public.hht_statuses FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER status_saida_set_account_owner_id BEFORE INSERT ON public.stock_output_statuses FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER tipo_execucao_set_account_owner_id BEFORE INSERT ON public.execution_types FOR EACH ROW EXECUTE FUNCTION public.set_account_owner_id_default();

CREATE TRIGGER trg_pessoas_force_inativo BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.pessoas_force_inativo_on_demissao();

CREATE TRIGGER trg_pessoas_sync_referencias BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.sync_pessoas_referencias();

CREATE TRIGGER trg_recalc_troca AFTER INSERT OR UPDATE OF "person_id", "material_id", "delivered_at", "exchange_at" ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_troca();

CREATE TRIGGER trg_set_data_troca BEFORE INSERT OR UPDATE OF "delivered_at", "material_id" ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.set_data_troca();

CREATE TRIGGER trg_set_owner_materiais BEFORE INSERT OR UPDATE OF account_owner_id ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_owner_materiais();

CREATE TRIGGER trg_set_owner_material_grupo_carac BEFORE INSERT OR UPDATE OF material_id, account_owner_id ON public.material_ppe_characteristics FOR EACH ROW EXECUTE FUNCTION public.set_owner_material_relacionado();

CREATE TRIGGER trg_set_owner_material_grupo_cor BEFORE INSERT OR UPDATE OF material_id, account_owner_id ON public.material_colors FOR EACH ROW EXECUTE FUNCTION public.set_owner_material_relacionado();

CREATE TRIGGER trg_set_owner_saidas BEFORE INSERT ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.set_owner_saidas();

CREATE TRIGGER trg_set_saida_troca_meta BEFORE INSERT ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.set_saida_troca_meta();

CREATE TRIGGER trg_validar_cancelamento_entrada BEFORE UPDATE OF status ON public.stock_entries FOR EACH ROW EXECUTE FUNCTION public.validar_cancelamento_entrada();

CREATE TRIGGER trg_validar_saldo_saida BEFORE INSERT OR UPDATE OF quantity, "material_id", status ON public.stock_outputs FOR EACH ROW EXECUTE FUNCTION public.validar_saldo_saida();

CREATE TRIGGER user_perm_overrides_bump_perm_version AFTER INSERT OR DELETE OR UPDATE ON public.user_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.bump_perm_version();

CREATE TRIGGER user_roles_bump_perm_version AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.bump_perm_version();
