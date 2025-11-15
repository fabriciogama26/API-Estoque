-- Ajusta função validar_saldo_saida para tipos uuid/texto no campo status

create or replace function public.validar_saldo_saida()
returns trigger as $$
declare
  v_saldo numeric;
  v_quantidade numeric := coalesce(new.quantidade, 0);
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
begin
  select id into v_status_cancelado_id
    from public.status_saida
   where lower(status) = v_status_cancelado_nome
   limit 1;

  if v_quantidade <= 0
     or (v_status_cancelado_id is not null and new.status = v_status_cancelado_id)
     or lower(coalesce(new.status::text, '')) = v_status_cancelado_nome then
    return new;
  end if;

  with entradas as (
    select coalesce(sum(quantidade), 0) as total
    from public.entradas
    where "materialId" = new."materialId"
  ),
  saidas as (
    select coalesce(sum(quantidade), 0) as total
    from public.saidas
    where "materialId" = new."materialId"
      and not (
        (v_status_cancelado_id is not null and status = v_status_cancelado_id)
        or lower(coalesce(status::text, '')) = v_status_cancelado_nome
      )
      and (old.id is null or id <> old.id)
  )
  select e.total - s.total into v_saldo
  from entradas e, saidas s;

  if v_quantidade > v_saldo then
    raise exception 'Quantidade % excede estoque disponivel (%) para o material %.', v_quantidade, v_saldo, new."materialId"
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;
