-- Trigger para impedir saidas com quantidade superior ao estoque disponivel

create or replace function public.validar_saldo_saida()
returns trigger as $$
declare
  v_saldo numeric;
  v_quantidade numeric := coalesce(new.quantidade, 0);
  v_saida_atual numeric := 0;
begin
  if v_quantidade <= 0 or new.status = 'cancelado' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(quantidade, 0) into v_saida_atual from public.saidas where id = old.id;
  end if;

  with entradas as (
    select coalesce(sum(quantidade), 0) as total
    from public.entradas
    where "materialId" = new."materialId"
      and status is distinct from 'cancelado'
  ),
  saidas as (
    select coalesce(sum(quantidade), 0) as total
    from public.saidas
    where "materialId" = new."materialId"
      and status is distinct from 'cancelado'
      and id <> coalesce(old.id, '00000000-0000-0000-0000-000000000000')
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

drop trigger if exists trg_validar_saldo_saida on public.saidas;

create trigger trg_validar_saldo_saida
before insert or update of "quantidade","materialId","status"
on public.saidas
for each row
execute function public.validar_saldo_saida();
