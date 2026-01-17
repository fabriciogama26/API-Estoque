-- Solid tenant RLS reset (owner scope + RBAC) for all account_owner_id tables.
-- Removes legacy/public policies and recreates authenticated-only policies.

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

-- Ensure RLS is enabled.
ALTER TABLE IF EXISTS public.acidente_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.centros_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.centros_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entrada_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fabricantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hht_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hht_mensal_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.material_grupo_caracteristica_epi ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.material_grupo_cor ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pessoas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saidas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setores ENABLE ROW LEVEL SECURITY;

-- Pessoas
CREATE POLICY pessoas_select_owner
  ON public.pessoas
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY pessoas_insert_owner
  ON public.pessoas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY pessoas_update_owner
  ON public.pessoas
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

-- Historico pessoas
CREATE POLICY pessoas_historico_select_owner
  ON public.pessoas_historico
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY pessoas_historico_insert_owner
  ON public.pessoas_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

-- Pessoas catalogs: setores, cargos
CREATE POLICY setores_select_owner
  ON public.setores
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY setores_insert_owner
  ON public.setores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY setores_update_owner
  ON public.setores
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY cargos_select_owner
  ON public.cargos
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY cargos_insert_owner
  ON public.cargos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

CREATE POLICY cargos_update_owner
  ON public.cargos
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('pessoas.write'::text))
  );

-- Centros (usados em pessoas e estoque)
CREATE POLICY centros_servico_select_owner
  ON public.centros_servico
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_servico_insert_owner
  ON public.centros_servico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_servico_update_owner
  ON public.centros_servico
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_custo_select_owner
  ON public.centros_custo
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.read'::text)
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_custo_insert_owner
  ON public.centros_custo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_custo_update_owner
  ON public.centros_custo
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('pessoas.write'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_estoque_select_owner
  ON public.centros_estoque
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_estoque_insert_owner
  ON public.centros_estoque
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY centros_estoque_update_owner
  ON public.centros_estoque
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('estoque.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('estoque.write'::text))
  );

-- Materiais + relacionados
CREATE POLICY materiais_select_owner
  ON public.materiais
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY materiais_insert_owner
  ON public.materiais
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY materiais_update_owner
  ON public.materiais
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY fabricantes_select_owner
  ON public.fabricantes
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY fabricantes_insert_owner
  ON public.fabricantes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY fabricantes_update_owner
  ON public.fabricantes
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_price_history_select_owner
  ON public.material_price_history
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_price_history_insert_owner
  ON public.material_price_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_price_history_update_owner
  ON public.material_price_history
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_cor_select_owner
  ON public.material_grupo_cor
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_cor_insert_owner
  ON public.material_grupo_cor
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_cor_update_owner
  ON public.material_grupo_cor
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_caracteristica_epi_select_owner
  ON public.material_grupo_caracteristica_epi
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_caracteristica_epi_insert_owner
  ON public.material_grupo_caracteristica_epi
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

CREATE POLICY material_grupo_caracteristica_epi_update_owner
  ON public.material_grupo_caracteristica_epi
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.materiais'::text))
  );

-- Entradas
CREATE POLICY entradas_select_owner
  ON public.entradas
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY entradas_insert_owner
  ON public.entradas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.entradas'::text))
  );

CREATE POLICY entradas_update_owner
  ON public.entradas
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.entradas'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.entradas'::text))
  );

CREATE POLICY entrada_historico_select_owner
  ON public.entrada_historico
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY entrada_historico_insert_owner
  ON public.entrada_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.entradas'::text))
  );

-- Saidas
CREATE POLICY saidas_select_owner
  ON public.saidas
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY saidas_insert_owner
  ON public.saidas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.saidas'::text))
  );

CREATE POLICY saidas_update_owner
  ON public.saidas
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.saidas'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.saidas'::text))
  );

CREATE POLICY saidas_historico_select_owner
  ON public.saidas_historico
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.read'::text)
      OR public.has_permission('estoque.write'::text))
  );

CREATE POLICY saidas_historico_insert_owner
  ON public.saidas_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('estoque.write'::text)
      OR public.has_permission('estoque.saidas'::text))
  );

-- Acidentes
CREATE POLICY acidentes_select_owner
  ON public.acidentes
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('acidentes.read'::text)
      OR public.has_permission('acidentes.write'::text))
  );

CREATE POLICY acidentes_insert_owner
  ON public.acidentes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('acidentes.write'::text))
  );

CREATE POLICY acidentes_update_owner
  ON public.acidentes
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('acidentes.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('acidentes.write'::text))
  );

CREATE POLICY acidente_historico_select_owner
  ON public.acidente_historico
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('acidentes.read'::text)
      OR public.has_permission('acidentes.write'::text))
  );

CREATE POLICY acidente_historico_insert_owner
  ON public.acidente_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('acidentes.write'::text))
  );

-- HHT mensal
CREATE POLICY hht_mensal_select_owner
  ON public.hht_mensal
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('hht.read'::text)
      OR public.has_permission('hht.write'::text))
  );

CREATE POLICY hht_mensal_insert_owner
  ON public.hht_mensal
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('hht.write'::text))
  );

CREATE POLICY hht_mensal_update_owner
  ON public.hht_mensal
  FOR UPDATE
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('hht.write'::text))
  )
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('hht.write'::text))
  );

CREATE POLICY hht_mensal_hist_select_owner
  ON public.hht_mensal_hist
  FOR SELECT
  TO authenticated
  USING (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master()
      OR public.has_permission('hht.read'::text)
      OR public.has_permission('hht.write'::text))
  );

CREATE POLICY hht_mensal_hist_insert_owner
  ON public.hht_mensal_hist
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_master() OR account_owner_id = public.my_owner_id())
    AND (public.is_master() OR public.has_permission('hht.write'::text))
  );

-- Catalogos publicos (sem account_owner_id)
ALTER TABLE IF EXISTS public.status_saida ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tipo_execucao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS status_saida_select_all ON public.status_saida;
DROP POLICY IF EXISTS status_saida_block_insert ON public.status_saida;
DROP POLICY IF EXISTS status_saida_block_update ON public.status_saida;
DROP POLICY IF EXISTS status_saida_block_delete ON public.status_saida;

CREATE POLICY status_saida_select_all
  ON public.status_saida
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY status_saida_block_insert
  ON public.status_saida
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY status_saida_block_update
  ON public.status_saida
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY status_saida_block_delete
  ON public.status_saida
  FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS tipo_execucao_select_all ON public.tipo_execucao;
DROP POLICY IF EXISTS tipo_execucao_block_insert ON public.tipo_execucao;
DROP POLICY IF EXISTS tipo_execucao_block_update ON public.tipo_execucao;
DROP POLICY IF EXISTS tipo_execucao_block_delete ON public.tipo_execucao;

CREATE POLICY tipo_execucao_select_all
  ON public.tipo_execucao
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY tipo_execucao_block_insert
  ON public.tipo_execucao
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY tipo_execucao_block_update
  ON public.tipo_execucao
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY tipo_execucao_block_delete
  ON public.tipo_execucao
  FOR DELETE
  TO authenticated
  USING (false);
