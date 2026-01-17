-- Garante trocaSequencia default e evita NULL na insercao via RPC.

alter table if exists public.saidas
  alter column "trocaSequencia" set default 0;

create or replace function public.rpc_saidas_create_full(
  p_pessoa_id uuid,
  p_material_id uuid,
  p_quantidade numeric,
  p_centro_estoque uuid,
  p_centro_custo uuid,
  p_centro_servico uuid,
  p_data_entrega timestamptz,
  p_status uuid,
  p_usuario_id uuid default null,
  p_is_troca boolean default false,
  p_troca_de_saida uuid default null,
  p_troca_sequencia integer default null
) returns setof public.saidas
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_id uuid;
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('estoque.saidas'::text);
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  insert into public.saidas (
    "pessoaId",
    "materialId",
    quantidade,
    centro_estoque,
    centro_custo,
    centro_servico,
    "dataEntrega",
    status,
    "usuarioResponsavel",
    "isTroca",
    "trocaDeSaida",
    "trocaSequencia",
    account_owner_id
  ) values (
    p_pessoa_id,
    p_material_id,
    p_quantidade,
    p_centro_estoque,
    p_centro_custo,
    p_centro_servico,
    p_data_entrega,
    p_status,
    v_user,
    coalesce(p_is_troca, false),
    p_troca_de_saida,
    coalesce(p_troca_sequencia, 0),
    v_owner
  ) returning id into v_id;

  return query
    select *
      from public.saidas s
     where s.id = v_id
       and (v_is_master or s.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_saidas_create_full(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) from public;

grant execute on function public.rpc_saidas_create_full(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  uuid,
  boolean,
  uuid,
  integer
) to authenticated;
