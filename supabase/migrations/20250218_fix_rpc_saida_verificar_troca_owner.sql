-- Ajusta rpc_saida_verificar_troca para considerar owner legado (NULL) e escopo master.

create or replace function public.rpc_saida_verificar_troca(
  p_material_id uuid,
  p_pessoa_id uuid
)
returns table (
  tem_saida boolean,
  ultima_saida_id uuid,
  troca_sequencia integer
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_owner uuid := public.my_owner_id();
  v_is_master boolean := public.is_master();
begin
  if p_material_id is null or p_pessoa_id is null then
    return;
  end if;

  if v_owner is null and not v_is_master then
    select account_owner_id into v_owner
      from public.pessoas
     where id = p_pessoa_id
     limit 1;

    if v_owner is null then
      select account_owner_id into v_owner
        from public.materiais
       where id = p_material_id
       limit 1;
    end if;
  end if;

  select id into v_status_cancelado_id
    from public.status_saida
   where lower(status) = v_status_cancelado_nome
   limit 1;

  with base as (
    select s.id
      from public.saidas s
      left join public.status_saida st on st.id = s.status
     where s."materialId" = p_material_id
       and s."pessoaId" = p_pessoa_id
       and (
         v_is_master
         or s.account_owner_id = v_owner
         or (v_owner is not null and s.account_owner_id is null)
       )
       and not (
         (v_status_cancelado_id is not null and s.status = v_status_cancelado_id)
         or lower(coalesce(st.status::text, '')) = v_status_cancelado_nome
       )
     order by s."dataEntrega" desc nulls last, s."criadoEm" desc nulls last, s.id desc
  )
  select
    count(*) > 0,
    (select id from base limit 1),
    count(*)::int
  into tem_saida, ultima_saida_id, troca_sequencia
  from base;

  return next;
end;
$$;

revoke all on function public.rpc_saida_verificar_troca(uuid, uuid) from public;
grant execute on function public.rpc_saida_verificar_troca(uuid, uuid) to anon, authenticated, service_role;
