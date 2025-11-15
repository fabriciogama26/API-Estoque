-- Cria a RPC para listar o historico de saidas sem limite de 1000 registros
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
    sh.usuarioResponsavel,
    json_build_object(
      'id', u.id,
      'display_name', u.display_name,
      'username', u.username,
      'email', u.email
    ) as usuario
  from public.saida_historico sh
  left join public.app_users u on u.id = sh."usuarioResponsavel"::uuid
  where sh.saida_id = p_saida_id
  order by sh.created_at desc;
end;
$$;

grant execute on function public.rpc_saida_historico(uuid) to anon, authenticated, service_role;