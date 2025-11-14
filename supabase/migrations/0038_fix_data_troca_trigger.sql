-- Ajusta trigger de dataTroca para usar o nome correto da coluna validadeDias

create or replace function public.set_data_troca()
returns trigger as $$
declare
  v_validade integer;
begin
  select coalesce("validadeDias", 0)
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
