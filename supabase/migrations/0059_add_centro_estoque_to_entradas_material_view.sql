-- Adiciona coluna centro_estoque na view entradas_material_view para filtrar materiais por almoxarifado
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS public.entradas_material_view CASCADE';

  EXECUTE $sql$
    CREATE VIEW public.entradas_material_view AS
    SELECT DISTINCT ON (mv.id, e.centro_estoque)
      mv.*,
      e.centro_estoque AS centro_estoque,
      ce.almox AS centro_estoque_nome
    FROM public.entradas AS e
    JOIN public.materiais_view AS mv
      ON mv.id = e."materialId"
    LEFT JOIN public.centros_estoque AS ce
      ON ce.id = e.centro_estoque
    ORDER BY mv.id, e.centro_estoque, e."dataEntrada" DESC NULLS LAST;
  $sql$;

  EXECUTE 'GRANT SELECT ON public.entradas_material_view TO authenticated, anon, service_role';
END
$$;
