-- Politica de reposicao - entrega 4: RPC dedicada ao minimo cadastrado (materiais."estoqueMinimo").
-- Depende de: 20260926_create_inventory_policy.sql.
--
-- Antes: a tela Estoque atual alterava o minimo via atualizacao generica do material
-- (`material_update_full`), que regrava todos os campos a partir do payload e nao deixa historico.
-- Depois: `rpc_material_estoque_minimo_update` altera somente "estoqueMinimo", valida tenant e
-- permissao (master ou `estoque.write`) e grava antes/depois, motivo e ator em
-- `inventory_policy_history` (entidade `minimo_cadastrado`). Usada pela tela Estoque atual e pela
-- fila de revisao da aba Compra.

alter table public.inventory_policy_history
  drop constraint if exists inventory_policy_history_entidade_check;

alter table public.inventory_policy_history
  add constraint inventory_policy_history_entidade_check
  check (entidade in ('politica', 'override', 'minimo_cadastrado'));

create or replace function public.rpc_material_estoque_minimo_update(
  p_material_id uuid,
  p_estoque_minimo integer,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := public.my_owner_id();
  v_material_owner uuid;
  v_anterior integer;
  v_ator uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if p_material_id is null then
    raise exception 'Material obrigatorio.' using errcode = '22023';
  end if;

  if p_estoque_minimo is null or p_estoque_minimo < 0 then
    raise exception 'O minimo cadastrado deve ser um inteiro maior ou igual a zero.' using errcode = '22023';
  end if;

  if not v_is_service and not (public.is_master() or public.has_permission('estoque.write'::text)) then
    raise exception 'Sem permissao para alterar o minimo cadastrado.' using errcode = '42501';
  end if;

  select m.account_owner_id, m."estoqueMinimo"
    into v_material_owner, v_anterior
  from public.materiais m
  where m.id = p_material_id
  for update;

  if not found then
    raise exception 'Material nao encontrado.' using errcode = 'P0002';
  end if;

  if not v_is_service and not public.is_master() then
    if v_owner is null then
      raise exception 'Owner da sessao nao resolvido.' using errcode = '42501';
    end if;
    if v_material_owner is distinct from v_owner then
      raise exception 'Material nao pertence ao tenant da sessao.' using errcode = '42501';
    end if;
  end if;

  if v_anterior is not distinct from p_estoque_minimo then
    return jsonb_build_object(
      'material_id', p_material_id,
      'estoque_minimo', p_estoque_minimo,
      'alterado', false
    );
  end if;

  update public.materiais
  set "estoqueMinimo" = p_estoque_minimo,
      "atualizadoEm" = now(),
      "usuarioAtualizacao" = case
        when v_ator is not null and exists (select 1 from public.app_users u where u.id = v_ator) then v_ator
        else "usuarioAtualizacao"
      end
  where id = p_material_id;

  insert into public.inventory_policy_history (
    account_owner_id, entidade, registro_id, acao, antes, depois, motivo, ator_user_id
  ) values (
    v_material_owner,
    'minimo_cadastrado',
    p_material_id::text,
    'alterado',
    jsonb_build_object('estoqueMinimo', v_anterior),
    jsonb_build_object('estoqueMinimo', p_estoque_minimo),
    nullif(btrim(coalesce(p_motivo, '')), ''),
    v_ator
  );

  return jsonb_build_object(
    'material_id', p_material_id,
    'estoque_minimo', p_estoque_minimo,
    'estoque_minimo_anterior', v_anterior,
    'alterado', true
  );
end;
$$;

revoke all on function public.rpc_material_estoque_minimo_update(uuid, integer, text) from public, anon;
grant execute on function public.rpc_material_estoque_minimo_update(uuid, integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';
