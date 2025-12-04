-- Atualiza a RPC de histórico de saídas para usar a tabela existente saidas_historico
-- Recria a função rpc_saida_historico apontando para public.saidas_historico (já existente)
DROP FUNCTION IF EXISTS public.rpc_saida_historico(uuid);

CREATE OR REPLACE FUNCTION public.rpc_saida_historico(p_saida_id uuid)
RETURNS TABLE (
  id uuid,
  saida_id uuid,
  material_id uuid,
  material_saida jsonb,
  created_at timestamptz,
  usuario_responsavel uuid,
  usuario jsonb
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF p_saida_id IS NULL THEN
    RAISE EXCEPTION 'Saida invalida.' USING errcode = '22023';
  END IF;
  RETURN QUERY
  SELECT
    sh.id,
    sh.saida_id,
    sh.material_id,
    sh.material_saida,
    sh.created_at,
    sh."usuarioResponsavel" AS usuario_responsavel,
    json_build_object(
      'id', u.id,
      'display_name', u.display_name,
      'username', u.username,
      'email', u.email
    )::jsonb AS usuario
  FROM public.saidas_historico sh
  LEFT JOIN public.app_users u ON u.id = sh."usuarioResponsavel"::uuid
  WHERE sh.saida_id = p_saida_id
  ORDER BY sh.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_saida_historico(uuid) TO anon, authenticated, service_role;
