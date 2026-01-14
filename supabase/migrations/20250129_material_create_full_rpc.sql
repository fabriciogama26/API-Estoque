-- RPC para cadastrar material com vinculos de cores/caracteristicas em uma unica transacao.
-- Mantem triggers de deduplicacao como protecao adicional.

drop function if exists public.material_create_full(jsonb, uuid[], uuid[]);

create or replace function public.material_create_full(
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
  v_id uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.write'::text)) then
    raise exception 'Sem permissao para criar material.';
  end if;

  insert into public.materiais (
    nome,
    fabricante,
    "validadeDias",
    ca,
    "valorUnitario",
    "estoqueMinimo",
    ativo,
    descricao,
    "grupoMaterial",
    "numeroCalcado",
    "numeroVestimenta",
    "numeroEspecifico",
    "usuarioCadastro",
    "dataCadastro",
    "usuarioAtualizacao",
    "atualizadoEm",
    account_owner_id
  )
  values (
    nullif(p_material->>'nome', '')::uuid,
    nullif(p_material->>'fabricante', '')::uuid,
    nullif(p_material->>'validadeDias', '')::int,
    coalesce(p_material->>'ca', ''),
    coalesce(nullif(p_material->>'valorUnitario', '')::numeric, 0),
    coalesce(nullif(p_material->>'estoqueMinimo', '')::int, 0),
    coalesce(nullif(p_material->>'ativo', '')::boolean, true),
    coalesce(p_material->>'descricao', ''),
    nullif(p_material->>'grupoMaterial', '')::uuid,
    nullif(p_material->>'numeroCalcado', '')::uuid,
    nullif(p_material->>'numeroVestimenta', '')::uuid,
    coalesce(p_material->>'numeroEspecifico', ''),
    nullif(p_material->>'usuarioCadastro', '')::uuid,
    coalesce(nullif(p_material->>'dataCadastro', '')::timestamptz, now()),
    nullif(p_material->>'usuarioAtualizacao', '')::uuid,
    coalesce(nullif(p_material->>'atualizadoEm', '')::timestamptz, now()),
    v_owner
  )
  returning materiais.id into v_id;

  if p_cores_ids is not null then
    insert into public.material_grupo_cor (material_id, grupo_material_cor, account_owner_id)
    select v_id, cor_id, v_owner
    from unnest(p_cores_ids) as cor_id
    where cor_id is not null;
  end if;

  if p_caracteristicas_ids is not null then
    insert into public.material_grupo_caracteristica_epi (material_id, grupo_caracteristica_epi, account_owner_id)
    select v_id, carac_id, v_owner
    from unnest(p_caracteristicas_ids) as carac_id
    where carac_id is not null;
  end if;

  return query select v_id;
end;
$$;

revoke all on function public.material_create_full(jsonb, uuid[], uuid[]) from public;
grant execute on function public.material_create_full(jsonb, uuid[], uuid[]) to anon, authenticated, service_role;
