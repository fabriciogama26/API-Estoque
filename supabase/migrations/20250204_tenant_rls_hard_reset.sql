-- Hard reset das policies RLS para tabelas tenant (account_owner_id).
-- Remove todas as policies existentes e recria somente o conjunto owner + authenticated.

DO $$
DECLARE
  r record;
  v_tables text[] := ARRAY[
    'acidente_historico',
    'acidentes',
    'cargos',
    'centros_custo',
    'centros_estoque',
    'centros_servico',
    'entrada_historico',
    'entradas',
    'fabricantes',
    'hht_mensal',
    'hht_mensal_hist',
    'materiais',
    'material_grupo_caracteristica_epi',
    'material_grupo_cor',
    'material_price_history',
    'pessoas',
    'pessoas_historico',
    'saidas',
    'saidas_historico',
    'setores'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (v_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Pessoas
create policy pessoas_select_owner
  on public.pessoas
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy pessoas_insert_owner
  on public.pessoas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('pessoas.write'::text))
  );

create policy pessoas_update_owner
  on public.pessoas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('pessoas.write'::text))
  );

-- Historico pessoas
create policy pessoas_historico_select_owner
  on public.pessoas_historico
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy pessoas_historico_insert_owner
  on public.pessoas_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Acidentes
create policy acidentes_select_owner
  on public.acidentes
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy acidentes_insert_owner
  on public.acidentes
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

create policy acidentes_update_owner
  on public.acidentes
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('acidentes.write'::text))
  );

-- Historico acidentes
create policy acidente_hist_select_owner
  on public.acidente_historico
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy acidente_hist_insert_owner
  on public.acidente_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- HHT mensal
create policy hht_mensal_select_owner
  on public.hht_mensal
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy hht_mensal_insert_owner
  on public.hht_mensal
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('hht.write'::text))
  );

create policy hht_mensal_update_owner
  on public.hht_mensal
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('hht.write'::text))
  );

-- Historico HHT
create policy hht_hist_select_owner
  on public.hht_mensal_hist
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy hht_hist_insert_owner
  on public.hht_mensal_hist
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Entradas
create policy entradas_select_owner
  on public.entradas
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy entradas_insert_owner
  on public.entradas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

create policy entradas_update_owner
  on public.entradas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

-- Historico entradas
create policy entrada_hist_select_owner
  on public.entrada_historico
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy entrada_hist_insert_owner
  on public.entrada_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Materiais
create policy materiais_select_owner
  on public.materiais
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy materiais_insert_owner
  on public.materiais
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  );

create policy materiais_update_owner
  on public.materiais
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (public.is_master() or public.has_permission('estoque.write'::text))
  );

-- Historico preco material
create policy mat_price_hist_select_owner
  on public.material_price_history
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy mat_price_hist_insert_owner
  on public.material_price_history
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Saidas
create policy saidas_select_owner
  on public.saidas
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy saidas_insert_owner
  on public.saidas
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );

create policy saidas_update_owner
  on public.saidas
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
      or public.has_permission('estoque.saidas'::text)
    )
  );

-- Historico saidas
create policy saidas_hist_select_owner
  on public.saidas_historico
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy saidas_hist_insert_owner
  on public.saidas_historico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

-- Tabelas de configuracao (tenant)
create policy cargos_select_owner
  on public.cargos
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy cargos_insert_owner
  on public.cargos
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy cargos_update_owner
  on public.cargos
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy cargos_delete_owner
  on public.cargos
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_custo_select_owner
  on public.centros_custo
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy centros_custo_insert_owner
  on public.centros_custo
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_custo_update_owner
  on public.centros_custo
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_custo_delete_owner
  on public.centros_custo
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_estoque_select_owner
  on public.centros_estoque
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy centros_estoque_insert_owner
  on public.centros_estoque
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_estoque_update_owner
  on public.centros_estoque
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_estoque_delete_owner
  on public.centros_estoque
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_servico_select_owner
  on public.centros_servico
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy centros_servico_insert_owner
  on public.centros_servico
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_servico_update_owner
  on public.centros_servico
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy centros_servico_delete_owner
  on public.centros_servico
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy fabricantes_select_owner
  on public.fabricantes
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy fabricantes_insert_owner
  on public.fabricantes
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy fabricantes_update_owner
  on public.fabricantes
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy fabricantes_delete_owner
  on public.fabricantes
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy setores_select_owner
  on public.setores
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and ativo is true
  );

create policy setores_insert_owner
  on public.setores
  for insert
  to authenticated
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy setores_update_owner
  on public.setores
  for update
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id())
  with check (public.is_master() or account_owner_id = public.my_owner_id());

create policy setores_delete_owner
  on public.setores
  for delete
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

-- Relacoes materiais (cores / caracteristicas)
create policy material_grupo_cor_select_owner
  on public.material_grupo_cor
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy material_grupo_cor_insert_owner
  on public.material_grupo_cor
  for insert
  to authenticated
  with check (
    public.is_master()
    or (
      public.has_permission('estoque.write'::text)
      and exists (
        select 1
        from public.materiais m
        where m.id = material_grupo_cor.material_id
          and m.account_owner_id = public.my_owner_id()
      )
    )
  );

create policy material_grupo_cor_update_owner
  on public.material_grupo_cor
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

create policy material_grupo_cor_delete_owner
  on public.material_grupo_cor
  for delete
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

create policy material_grupo_carac_select_owner
  on public.material_grupo_caracteristica_epi
  for select
  to authenticated
  using (public.is_master() or account_owner_id = public.my_owner_id());

create policy material_grupo_carac_insert_owner
  on public.material_grupo_caracteristica_epi
  for insert
  to authenticated
  with check (
    public.is_master()
    or (
      public.has_permission('estoque.write'::text)
      and exists (
        select 1
        from public.materiais m
        where m.id = material_grupo_caracteristica_epi.material_id
          and m.account_owner_id = public.my_owner_id()
      )
    )
  );

create policy material_grupo_carac_update_owner
  on public.material_grupo_caracteristica_epi
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );

create policy material_grupo_carac_delete_owner
  on public.material_grupo_caracteristica_epi
  for delete
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and public.has_permission('estoque.write'::text)
  );
