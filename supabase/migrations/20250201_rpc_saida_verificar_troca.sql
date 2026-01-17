-- Verifica se ja existe saida ativa (nao cancelada) para a mesma pessoa/material.
-- Retorna o ultimo registro e a proxima sequencia de troca (count de saidas ativas).

drop function if exists public.rpc_saida_verificar_troca(uuid, uuid);

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
begin
  if p_material_id is null or p_pessoa_id is null then
    return;
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
       and (v_owner is null or s.account_owner_id = v_owner)
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
