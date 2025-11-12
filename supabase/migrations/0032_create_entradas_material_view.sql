-- View que expõe apenas materiais que possuem registros na tabela de entradas.
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS public.entradas_material_view CASCADE';

  EXECUTE $sql$
    CREATE VIEW public.entradas_material_view AS
    SELECT mv.*
    FROM public.materiais_view AS mv
    WHERE EXISTS (
      SELECT 1
      FROM public.entradas AS e
      WHERE e."materialId" = mv.id
    );
  $sql$;

  EXECUTE 'GRANT SELECT ON public.entradas_material_view TO authenticated, anon, service_role';
END
$$;
