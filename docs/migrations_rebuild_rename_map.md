# Migrations Rebuild - Rename Map (Draft)

Validated mapping per latest choices.

## Tables
- acidente_agentes -> accident_agents
- acidente_historico -> accident_history
- acidente_lesoes -> accident_injuries
- acidente_locais -> accident_locations
- acidente_partes -> accident_body_parts
- acidente_partes_grupo -> accident_body_part_groups
- acidente_partes_sub_grupo -> accident_body_part_subgroups
- acidente_tipos -> accident_types
- acidentes -> accidents
- api_errors -> api_errors
- app_credentials_catalog -> app_credentials_catalog
- app_errors -> app_errors
- app_users -> app_users
- app_users_credential_history -> app_user_credential_history
- app_users_dependentes -> app_user_dependents
- caracteristica_epi -> ppe_characteristics
- cargos -> job_roles
- centros_custo -> cost_centers
- centros_estoque -> stock_centers
- centros_servico -> service_centers
- cor -> colors
- entrada_historico -> stock_entry_history
- entradas -> stock_entries
- epi_classe -> ppe_classes
- fabricantes -> manufacturers
- grupos_material -> material_groups
- grupos_material_itens -> material_group_items
- hht_mensal -> hht_monthly
- hht_mensal_hist -> hht_monthly_history
- materiais -> materials
- material_grupo_caracteristica_epi -> material_ppe_characteristics
- material_grupo_cor -> material_colors
- material_price_history -> material_price_history
- medidas_calcado -> shoe_sizes
- medidas_vestimentas -> clothing_sizes
- permissions -> permissions
- pessoas -> people
- pessoas_historico -> people_history
- planos_users -> user_plans
- role_permissions -> role_permissions
- roles -> roles
- saidas -> stock_outputs
- saidas_historico -> stock_output_history
- setores -> departments
- status_entrada -> stock_entry_statuses
- status_hht -> hht_statuses
- status_saida -> stock_output_statuses
- tipo_execucao -> execution_types
- user_permission_overrides -> user_permission_overrides
- user_roles -> user_roles

## Columns
### acidente_agentes
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### acidente_historico
- acidente_id -> accident_id
- campos_alterados -> changed_fields
- data_edicao -> edited_at
- user_id -> edited_by_user_id
- usuario_responsavel -> responsible_user

### acidente_lesoes
- agente_id -> agent_id
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### acidente_locais
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### acidente_partes
- ativo -> is_active
- criado_em -> created_at
- grupo -> group_name
- nome -> name
- ordem -> sort_order
- subgrupo -> subgroup_name

### acidente_partes_grupo
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### acidente_partes_sub_grupo
- ativo -> is_active
- criado_em -> created_at
- grupo_id -> group_id
- nome -> name

### acidente_tipos
- agente_id -> agent_id
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### acidentes
- agente -> accident_agent
- ativo -> is_active
- atualizadoEm -> updated_at
- atualizadoPor -> updated_by_username
- cancel_motivo text -> cancel_reason
- cargo -> job_role
- cat -> cat_number
- centro_servico -> service_center
- cid -> icd_code
- criadoEm -> created_at
- data -> accident_date
- data_esocial -> esocial_date
- data_sesmt -> sesmt_date
- diasDebitados -> debited_days
- diasPerdidos -> lost_days
- hht -> hht_value
- lesoes -> injuries
- local -> location_name
- matricula -> registration_number
- nome -> name
- observacao -> notes
- partes_lesionadas -> injured_body_parts
- registradoPor -> created_by_username
- sesmt -> sesmt_involved
- tipo -> accident_type

### app_credentials_catalog
- id_text -> code

### app_users
- ativo -> is_active
- status_plan -> plan_status

### app_users_credential_history
- after_pages -> after_permissions
- before_pages -> before_permissions
- changed_by -> changed_by_user_id
- owner_app_user_id -> owner_user_id
- user_username -> target_username

### app_users_dependentes
- ativo -> is_active
- owner_app_user_id -> owner_user_id

### caracteristica_epi
- ativo -> is_active
- caracteristica_material -> characteristic

### cargos
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### centros_custo
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### centros_estoque
- almox -> warehouse_name
- ativo -> is_active
- centro_custo -> cost_center_id

### centros_servico
- ativo -> is_active
- centro_custo_id -> cost_center_id
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### cor
- ativo -> is_active
- cor -> name

### entrada_historico
- entrada_id -> entry_id
- material_ent -> material_snapshot
- usuarioResponsavel -> responsible_user

### entradas
- atualizado_em -> updated_at
- centro_estoque -> stock_center_id
- create_at -> created_at
- dataEntrada -> entry_date
- materialId -> material_id
- quantidade -> quantity
- usuarioResponsavel -> responsible_user
- usuario_edicao -> updated_by_user_id

### epi_classe
- ativo -> is_active
- class_epi -> class_name

### fabricantes
- ativo -> is_active
- fabricante -> manufacturer

### grupos_material
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### grupos_material_itens
- ativo -> is_active
- criado_em -> created_at
- grupo_id -> group_id
- nome -> name
- ordem -> sort_order

### hht_mensal
- centro_servico_id -> service_center_id
- escala_factor -> scale_factor
- hht_calculado -> calculated_hht
- hht_final -> final_hht
- hht_informado -> reported_hht
- horas_afastamento -> leave_hours
- horas_extras -> overtime_hours
- horas_ferias -> vacation_hours
- horas_mes_base -> base_month_hours
- horas_outros_descontos -> other_discount_hours
- horas_treinamento -> training_hours
- mes_ref -> month_ref
- modo -> mode
- qtd_pessoas -> people_count
- status_hht_id -> hht_status_id

### hht_mensal_hist
- acao -> action
- alterado_em -> changed_at
- alterado_por -> changed_by
- antes -> before
- depois -> after
- hht_mensal_id -> hht_monthly_id
- motivo -> reason
- status_hht_nome -> hht_status_name

### materiais
- ativo -> is_active
- atualizadoEm -> updated_at
- ca -> ca_code
- dataCadastro -> created_at
- descricao -> description
- estoqueMinimo -> min_stock
- fabricante -> manufacturer
- grupoMaterial -> material_group_id
- hash_base -> base_hash
- hash_completo -> full_hash
- nome -> name
- numeroCalcado -> shoe_size_id
- numeroEspecifico -> specific_size
- numeroVestimenta -> clothing_size_id
- usuarioAtualizacao -> updated_by_user_id
- usuarioCadastro -> created_by_user_id
- validadeDias -> shelf_life_days
- valorUnitario -> unit_price

### material_grupo_caracteristica_epi
- grupo_caracteristica_epi -> ppe_characteristic_id

### material_grupo_cor
- grupo_material_cor -> color_id

### material_price_history
- campos_alterados -> changed_fields
- criadoEm -> created_at
- materialId -> material_id
- usuarioResponsavel -> responsible_user
- valorUnitario -> unit_price

### medidas_calcado
- ativo -> is_active
- numero_calcado -> size

### medidas_vestimentas
- ativo -> is_active
- medidas -> size_label

### pessoas
- ativo -> is_active
- atualizadoEm -> updated_at
- cargo_id -> job_role_id
- centro_custo_id -> cost_center_id
- centro_servico_id -> service_center_id
- criadoEm -> created_at
- dataAdmissao -> hire_date
- dataDemissao -> termination_date
- matricula -> registration_number
- nome -> name
- observacao -> notes
- setor_id -> department_id
- tipo_execucao_id -> execution_type_id
- usuarioCadastro -> created_by_user_id
- usuarioEdicao -> updated_by_user_id

### pessoas_historico
- campos_alterados -> changed_fields
- data_edicao -> edited_at
- pessoa_id -> person_id
- usuario_responsavel -> responsible_user

### planos_users
- planos -> name

### saidas
- atualizadoEm -> updated_at
- centro_custo -> cost_center_id
- centro_estoque -> stock_center_id
- centro_servico -> service_center
- criadoEm -> created_at
- dataEntrega -> delivered_at
- dataTroca -> exchange_at
- isTroca -> is_exchange
- materialId -> material_id
- pessoaId -> person_id
- quantidade -> quantity
- trocaDeSaida -> exchange_from_output_id
- trocaSequencia -> exchange_sequence
- usuarioEdicao -> updated_by_user_id
- usuarioResponsavel -> responsible_user

### saidas_historico
- material_saida -> material_snapshot
- saida_id -> output_id
- usuarioResponsavel -> responsible_user

### setores
- ativo -> is_active
- centro_servico_id -> service_center_id
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

### tipo_execucao
- ativo -> is_active
- criado_em -> created_at
- nome -> name
- ordem -> sort_order

## Views
- entradas_material_view -> stock_entry_materials_view
- hht_mensal_view -> hht_monthly_view
- materiais_unicos_view -> unique_materials_view
- materiais_view -> materials_view
- pessoas_view -> people_view
- v_me -> current_user_view
- vw_indicadores_acidentes -> accident_indicators_view

## RPCs
- hht_mensal_delete -> hht_monthly_delete
- pessoas_preflight_check -> people_preflight_check
- rpc_acidentes_create_full -> rpc_accidents_create_full
- rpc_acidentes_filtros -> rpc_accident_filters
- rpc_acidentes_update_full -> rpc_accidents_update_full
- rpc_centro_servico_centro_custo -> rpc_service_center_cost_center
- rpc_entradas_create_full -> rpc_stock_entries_create_full
- rpc_entradas_update_full -> rpc_stock_entries_update_full
- rpc_hht_mensal_create_full -> rpc_hht_monthly_create_full
- rpc_hht_mensal_update_full -> rpc_hht_monthly_update_full
- rpc_pessoas_completa -> rpc_people_full
- rpc_pessoas_count_centro -> rpc_people_count_service_center
- rpc_pessoas_create_full -> rpc_people_create_full
- rpc_pessoas_resumo -> rpc_people_summary
- rpc_pessoas_update_full -> rpc_people_update_full
- rpc_saida_historico -> rpc_stock_output_history
- rpc_saida_verificar_troca -> rpc_stock_output_check_exchange
- rpc_saidas_create_full -> rpc_stock_outputs_create_full
- rpc_saidas_update_full -> rpc_stock_outputs_update_full