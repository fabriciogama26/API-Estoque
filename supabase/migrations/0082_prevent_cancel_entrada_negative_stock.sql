-- Bloqueia cancelamento de entrada quando as saídas ativas excedem o estoque restante.

create or replace function public.validar_cancelamento_entrada()
returns trigger as $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_status_saida_cancelado_id uuid;
  v_total_saidas numeric := 0;
  v_total_entradas_restantes numeric := 0;ID: e7cb4098-b2ab-43a7-8a91-f2a322d94fef =13
begin
  select id into v_status_cancelado_id
    from public.status_entrada
   where lower(status) = v_status_cancelado_nome
   limit 1;

  -- Apenas valida quando o novo status é de cancelamento.
  if not (
    (v_status_cancelado_id is not null and new.status = v_status_cancelado_id)
    or lower(coalesce(new.status::text, '')) = v_status_cancelado_nome
  ) then
    return new;
  end if;

  -- Se já estava cancelada, não precisa revalidar.
  if (v_status_cancelado_id is not null and old.status = v_status_cancelado_id)
     or lower(coalesce(old.status::text, '')) = v_status_cancelado_nome then
    return new;
  end if;

  -- Estoque disponível após remover a entrada que está sendo cancelada.
  select coalesce(sum(quantidade), 0) into v_total_entradas_restantes
    from public.entradas e
   where e."materialId" = new."materialId"
     and e.id <> old.id
     and not (
       (v_status_cancelado_id is not null and e.status = v_status_cancelado_id)
       or lower(coalesce(e.status::text, '')) = v_status_cancelado_nome
     );

  select id into v_status_saida_cancelado_id
    from public.status_saida
   where lower(status) = v_status_cancelado_nome
   limit 1;

  -- Soma apenas saídas não canceladas.
  select coalesce(sum(quantidade), 0) into v_total_saidas
    from public.saidas s
   where s."materialId" = new."materialId"
     and not (
       (v_status_saida_cancelado_id is not null and s.status = v_status_saida_cancelado_id)
       or lower(coalesce(s.status::text, '')) = v_status_cancelado_nome
     );

  if v_total_saidas > v_total_entradas_restantes then
    raise exception
      'Nao e possivel cancelar esta entrada: ha % saidas registradas e o estoque ficaria com % apos o cancelamento.',
      v_total_saidas, v_total_entradas_restantes
      using errcode = 'P0001',
            detail = format(
              'Saidas ativas: %s; Entradas apos cancelamento: %s; Entrada id: %s',
              v_total_saidas, v_total_entradas_restantes, new.id
            ),
            hint = 'Estorne ou ajuste as saidas antes de cancelar a entrada.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validar_cancelamento_entrada on public.entradas;

create trigger trg_validar_cancelamento_entrada
before update of status on public.entradas
for each row
execute function public.validar_cancelamento_entrada();
