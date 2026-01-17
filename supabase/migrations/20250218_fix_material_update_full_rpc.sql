-- Corrige referencia ambigua de id na RPC de update de materiais.

create or replace function public.material_update_full(
  p_material_id uuid,
  p_material jsonb,
  p_cores_ids uuid[] default null,
  p_caracteristicas_ids uuid[] default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid := public.my_owner_id();
  v_material_owner uuid;
  v_owner_effective uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.write'::text)) then
    raise exception 'Sem permissao para atualizar material.';
  end if;

  select m.account_owner_id
    into v_material_owner
    from public.materiais m
   where m.id = p_material_id;

  if v_material_owner is null and v_owner is null then
    raise exception 'Material sem owner; nao pode atualizar.';
  end if;

  if not public.is_master() and v_material_owner is distinct from v_owner then
    raise exception 'Material fora do escopo do owner.';
  end if;

  v_owner_effective := coalesce(v_material_owner, v_owner);

  update public.materiais as m
     set nome = nullif(p_material->>'nome', '')::uuid,
         fabricante = nullif(p_material->>'fabricante', '')::uuid,
         "validadeDias" = nullif(p_material->>'validadeDias', '')::int,
         ca = coalesce(p_material->>'ca', ''),
         "valorUnitario" = coalesce(nullif(p_material->>'valorUnitario', '')::numeric, 0),
         "estoqueMinimo" = coalesce(nullif(p_material->>'estoqueMinimo', '')::int, 0),
         ativo = coalesce(nullif(p_material->>'ativo', '')::boolean, true),
         descricao = coalesce(p_material->>'descricao', ''),
         "grupoMaterial" = nullif(p_material->>'grupoMaterial', '')::uuid,
         "numeroCalcado" = nullif(p_material->>'numeroCalcado', '')::uuid,
         "numeroVestimenta" = nullif(p_material->>'numeroVestimenta', '')::uuid,
         "numeroEspecifico" = coalesce(p_material->>'numeroEspecifico', ''),
         "usuarioAtualizacao" = nullif(p_material->>'usuarioAtualizacao', '')::uuid,
         "atualizadoEm" = coalesce(nullif(p_material->>'atualizadoEm', '')::timestamptz, now())
   where m.id = p_material_id;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;

  if p_cores_ids is not null then
    delete from public.material_grupo_cor
     where material_id = p_material_id;

    insert into public.material_grupo_cor (material_id, grupo_material_cor, account_owner_id)
    select p_material_id, cor_id, v_owner_effective
    from unnest(p_cores_ids) as cor_id
    where cor_id is not null;
  end if;

  if p_caracteristicas_ids is not null then
    delete from public.material_grupo_caracteristica_epi
     where material_id = p_material_id;

    insert into public.material_grupo_caracteristica_epi (material_id, grupo_caracteristica_epi, account_owner_id)
    select p_material_id, carac_id, v_owner_effective
    from unnest(p_caracteristicas_ids) as carac_id
    where carac_id is not null;
  end if;

  return query select p_material_id;
end;
$$;

revoke all on function public.material_update_full(uuid, jsonb, uuid[], uuid[]) from public;
grant execute on function public.material_update_full(uuid, jsonb, uuid[], uuid[]) to anon, authenticated, service_role;
