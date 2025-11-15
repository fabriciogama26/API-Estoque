-- Migration: calcula dataTroca automaticamente com base na validade do material

create or replace function public.set_data_troca()
returns trigger as $$
declare
  v_validade integer;
begin
  select coalesce(validade_dias, 0)
    into v_validade
    from public.materiais
   where id = new."materialId";

  if new."dataEntrega" is not null then
    new."dataTroca" := new."dataEntrega" + (v_validade || ' days')::interval;
  else
    new."dataTroca" := null;
  end if;

  return new;
end;
$$ language plpgsql stable;

drop trigger if exists trg_set_data_troca on public.saidas;

create trigger trg_set_data_troca
before insert or update of "dataEntrega","materialId"
on public.saidas
for each row
execute function public.set_data_troca();
