-- Ajusta RLS de status_saida para leitura publica e evita RLS em triggers de saida.

alter table if exists public.status_saida enable row level security;
alter table if exists public.status_saida force row level security;

drop policy if exists status_saida_public_select on public.status_saida;
drop policy if exists status_saida_select_all on public.status_saida;
create policy status_saida_select_all
  on public.status_saida
  for select
  to public
  using (true);

drop policy if exists status_saida_no_insert on public.status_saida;
create policy status_saida_no_insert
  on public.status_saida
  for insert
  with check (false);

drop policy if exists status_saida_no_update on public.status_saida;
create policy status_saida_no_update
  on public.status_saida
  for update
  using (false)
  with check (false);

drop policy if exists status_saida_no_delete on public.status_saida;
create policy status_saida_no_delete
  on public.status_saida
  for delete
  using (false);

-- Garante que triggers que consultam status_saida nao quebrem por RLS.
create or replace function public.validar_saldo_saida()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
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
$$;

create or replace function public.validar_cancelamento_entrada()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_status_saida_cancelado_id uuid;
  v_total_saidas numeric := 0;
  v_total_entradas_restantes numeric := 0;
begin
  select id into v_status_cancelado_id
    from public.status_entrada
   where lower(status) = v_status_cancelado_nome
   limit 1;

  if not (
    (v_status_cancelado_id is not null and new.status = v_status_cancelado_id)
    or lower(coalesce(new.status::text, '')) = v_status_cancelado_nome
  ) then
    return new;
  end if;

  if (v_status_cancelado_id is not null and old.status = v_status_cancelado_id)
     or lower(coalesce(old.status::text, '')) = v_status_cancelado_nome then
    return new;
  end if;

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
$$;
