-- Cria tabela de histórico de saídas (plural) e ajusta a RPC para usá-la
DO $$
BEGIN
  -- Tabela de histórico
  CREATE TABLE IF NOT EXISTS public.saidas_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    saida_id uuid NOT NULL REFERENCES public.saidas (id) ON DELETE CASCADE,
    material_id uuid NOT NULL REFERENCES public.materiais (id),
    material_saida jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    "usuarioResponsavel" text NULL
  );

  CREATE INDEX IF NOT EXISTS idx_saidas_historico_saida_id ON public.saidas_historico (saida_id);
  CREATE INDEX IF NOT EXISTS idx_saidas_historico_material_id ON public.saidas_historico (material_id);

  -- Ajusta RPC para usar a tabela criada
  EXECUTE 'DROP FUNCTION IF EXISTS public.rpc_saida_historico(uuid)';

  EXECUTE $func$
    create or replace function public.rpc_saida_historico(p_saida_id uuid)
    returns table (
      id uuid,
      saida_id uuid,
      material_id uuid,
      material_saida jsonb,
      created_at timestamptz,
      usuario_responsavel text,
      usuario jsonb
    ) language plpgsql security definer
    set search_path = public as $$
    begin
      if p_saida_id is null then
        raise exception 'Saida invalida.' using errcode = '22023';
      end if;
      return query
      select
        sh.id,
        sh.saida_id,
        sh.material_id,
        sh.material_saida,
        sh.created_at,
        sh."usuarioResponsavel",
        json_build_object(
          ''id'', u.id,
          ''display_name'', u.display_name,
          ''username'', u.username,
          ''email'', u.email
        ) as usuario
      from public.saidas_historico sh
      left join public.app_users u on u.id = sh."usuarioResponsavel"::uuid
      where sh.saida_id = p_saida_id
      order by sh.created_at desc;
    end;
    $$;
  $func$;

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.saidas_historico TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.rpc_saida_historico(uuid) TO anon, authenticated, service_role;
END
$$;
