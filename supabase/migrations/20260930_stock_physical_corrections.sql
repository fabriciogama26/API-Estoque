-- Correcoes de estoque fisico com aprovacao e bloqueio por material/centro.
-- Toda alteracao de saldo deve utilizar calcular_saldo_estoque para que ajustes
-- aprovados nunca sejam classificados como consumo.
-- IMPORTANTE: esta migration usa o schema operacional legado em portugues
-- (materiais, centros_estoque, entradas e saidas), e nao o migrations_rebuild.

create table if not exists public.stock_correction_requests (
  id uuid primary key default gen_random_uuid(),
  account_owner_id uuid not null default public.current_account_owner_id(),
  material_id uuid not null references public.materiais(id),
  stock_center_id uuid not null references public.centros_estoque(id),
  system_balance numeric(14,2) not null,
  physical_quantity numeric(14,2) not null check (physical_quantity >= 0),
  difference numeric(14,2) not null,
  reason text not null default 'Correção de Saldo',
  notes text,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO')),
  requested_by uuid not null references public.app_users(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references public.app_users(id),
  approved_at timestamptz,
  rejected_by uuid references public.app_users(id),
  rejected_at timestamptz,
  rejection_reason text,
  cancelled_by uuid references public.app_users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint stock_correction_difference_check
    check (difference = physical_quantity - system_balance),
  constraint stock_correction_resolution_check check (
    (status = 'PENDENTE' and approved_by is null and rejected_by is null and cancelled_by is null)
    or (status = 'APROVADO' and approved_by is not null and approved_at is not null)
    or (status = 'REJEITADO' and rejected_by is not null and rejected_at is not null
        and nullif(btrim(rejection_reason), '') is not null)
    or (status = 'CANCELADO' and cancelled_by is not null and cancelled_at is not null)
  )
);

create unique index if not exists stock_correction_one_pending_idx
  on public.stock_correction_requests (account_owner_id, material_id, stock_center_id)
  where status = 'PENDENTE';
create index if not exists stock_correction_requests_list_idx
  on public.stock_correction_requests (account_owner_id, status, requested_at desc);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.stock_correction_requests(id),
  account_owner_id uuid not null,
  material_id uuid not null references public.materiais(id),
  stock_center_id uuid not null references public.centros_estoque(id),
  adjustment_quantity numeric(14,2) not null check (adjustment_quantity <> 0),
  reason text not null default 'Correção de Saldo',
  created_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);
create index if not exists stock_adjustments_balance_idx
  on public.stock_adjustments (account_owner_id, material_id, stock_center_id);

insert into public.permissions (key, description)
values
  ('estoque.correcao.read', 'Consultar correções de estoque físico'),
  ('estoque.correcao.solicitar', 'Solicitar correção de estoque físico'),
  ('estoque.correcao.aprovar', 'Aprovar ou rejeitar correções de estoque físico')
on conflict (key) do update set description = excluded.description, updated_at = now();

-- Administradores recebem as novas capacidades. Demais perfis são configurados
-- explicitamente pela tela de permissões.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where lower(r.name) in ('master', 'admin')
  and p.key in ('estoque.correcao.read', 'estoque.correcao.solicitar', 'estoque.correcao.aprovar')
on conflict do nothing;

create or replace function public.calcular_saldo_estoque(
  p_account_owner_id uuid,
  p_material_id uuid,
  p_stock_center_id uuid
) returns numeric
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select
    coalesce((
      select sum(e.quantidade)
      from public.entradas e
      left join public.status_entrada st on st.id = e.status
      where e.account_owner_id = p_account_owner_id
        and e."materialId" = p_material_id
        and e.centro_estoque = p_stock_center_id
        and lower(coalesce(st.status, '')) <> 'cancelado'
    ), 0)
    - coalesce((
      select sum(o.quantidade)
      from public.saidas o
      left join public.status_saida st on st.id = o.status
      where o.account_owner_id = p_account_owner_id
        and o."materialId" = p_material_id
        and o.centro_estoque = p_stock_center_id
        and lower(coalesce(st.status, '')) <> 'cancelado'
    ), 0)
    + coalesce((
      select sum(a.adjustment_quantity)
      from public.stock_adjustments a
      where a.account_owner_id = p_account_owner_id
        and a.material_id = p_material_id
        and a.stock_center_id = p_stock_center_id
    ), 0);
$$;

create or replace function public.lock_stock_position(
  p_account_owner_id uuid, p_material_id uuid, p_stock_center_id uuid
) returns void language plpgsql volatile security definer
set search_path = public set row_security = off as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_account_owner_id::text || ':' || p_material_id::text || ':' || p_stock_center_id::text, 0
  ));
end;
$$;

create or replace function public.assert_stock_position_unlocked(
  p_account_owner_id uuid, p_material_id uuid, p_stock_center_id uuid
) returns void language plpgsql stable security definer
set search_path = public set row_security = off as $$
declare v_request public.stock_correction_requests%rowtype; v_user text;
begin
  select * into v_request
  from public.stock_correction_requests
  where account_owner_id = p_account_owner_id and material_id = p_material_id
    and stock_center_id = p_stock_center_id and status = 'PENDENTE'
  limit 1;
  if found then
    select coalesce(display_name, username, v_request.requested_by::text) into v_user
    from public.app_users where id = v_request.requested_by;
    raise exception 'Este material possui uma correção de estoque físico pendente para este centro de estoque. A movimentação está bloqueada até a aprovação, rejeição ou cancelamento da solicitação.'
      using errcode = 'P0001',
        detail = format('Solicitação %s; saldo do sistema: %s; quantidade física: %s; solicitante: %s; data: %s',
          v_request.id, v_request.system_balance, v_request.physical_quantity,
          coalesce(v_user, v_request.requested_by::text), v_request.requested_at),
        hint = 'Analise a solicitação de correção pendente.';
  end if;
end;
$$;

create or replace function public.trg_block_pending_stock_correction()
returns trigger language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_old_active boolean := false; v_new_active boolean := false; v_status text;
begin
  if tg_op <> 'INSERT' then
    execute format('select lower(coalesce(status, '''')) from public.%I where id = $1',
      case when tg_table_name = 'entradas' then 'status_entrada' else 'status_saida' end)
      into v_status using old.status;
    v_old_active := v_status <> 'cancelado';
    if v_old_active then
      perform public.lock_stock_position(old.account_owner_id, old."materialId", old.centro_estoque);
      perform public.assert_stock_position_unlocked(old.account_owner_id, old."materialId", old.centro_estoque);
    end if;
  end if;
  if tg_op <> 'DELETE' then
    execute format('select lower(coalesce(status, '''')) from public.%I where id = $1',
      case when tg_table_name = 'entradas' then 'status_entrada' else 'status_saida' end)
      into v_status using new.status;
    v_new_active := v_status <> 'cancelado';
    if v_new_active then
      perform public.lock_stock_position(new.account_owner_id, new."materialId", new.centro_estoque);
      perform public.assert_stock_position_unlocked(new.account_owner_id, new."materialId", new.centro_estoque);
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_block_pending_correction_entries on public.entradas;
create trigger trg_block_pending_correction_entries
before insert or update or delete on public.entradas for each row
execute function public.trg_block_pending_stock_correction();
drop trigger if exists trg_block_pending_correction_outputs on public.saidas;
create trigger trg_block_pending_correction_outputs
before insert or update or delete on public.saidas for each row
execute function public.trg_block_pending_stock_correction();

drop trigger if exists trg_validar_saldo_saida on public.saidas;
create trigger trg_validar_saldo_saida
before insert or update of quantidade, "materialId", centro_estoque, status on public.saidas
for each row execute function public.validar_saldo_saida();

-- Substitui a validação antiga, que agregava o material globalmente e não
-- considerava centro, tenant nem correções aprovadas.
create or replace function public.validar_saldo_saida() returns trigger
language plpgsql security definer set search_path = public set row_security = off as $$
declare v_saldo numeric; v_status text; v_old_quantity numeric := 0;
begin
  select lower(coalesce(status, '')) into v_status from public.status_saida where id = new.status;
  if coalesce(new.quantidade, 0) <= 0 or v_status = 'cancelado' then return new; end if;
  perform public.lock_stock_position(new.account_owner_id, new."materialId", new.centro_estoque);
  perform public.assert_stock_position_unlocked(new.account_owner_id, new."materialId", new.centro_estoque);
  v_saldo := public.calcular_saldo_estoque(new.account_owner_id, new."materialId", new.centro_estoque);
  if tg_op = 'UPDATE' and old.account_owner_id = new.account_owner_id
     and old."materialId" = new."materialId" and old.centro_estoque = new.centro_estoque then
    select case when lower(coalesce(s.status, '')) = 'cancelado' then 0 else old.quantidade end
      into v_old_quantity from public.status_saida s where s.id = old.status;
    v_saldo := v_saldo + coalesce(v_old_quantity, 0);
  end if;
  if new.quantidade > v_saldo then
    raise exception 'Quantidade % excede estoque disponível (%) para o material % neste centro.',
      new.quantidade, v_saldo, new."materialId" using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.validar_cancelamento_entrada() returns trigger
language plpgsql security definer set search_path = public set row_security = off as $$
declare v_old_status text; v_new_status text; v_saldo numeric;
begin
  select lower(coalesce(status, '')) into v_old_status from public.status_entrada where id=old.status;
  select lower(coalesce(status, '')) into v_new_status from public.status_entrada where id=new.status;
  if v_old_status <> 'cancelado' and v_new_status = 'cancelado' then
    perform public.lock_stock_position(old.account_owner_id, old."materialId", old.centro_estoque);
    perform public.assert_stock_position_unlocked(old.account_owner_id, old."materialId", old.centro_estoque);
    v_saldo := public.calcular_saldo_estoque(old.account_owner_id, old."materialId", old.centro_estoque) - old.quantidade;
    if v_saldo < 0 then
      raise exception 'Não é possível cancelar esta entrada: o estoque do material no centro ficaria negativo (%).', v_saldo
        using errcode='P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.rpc_stock_correction_request(
  p_material_id uuid, p_stock_center_id uuid, p_physical_quantity numeric, p_notes text default null
) returns public.stock_correction_requests
language plpgsql security definer set search_path = public set row_security = off as $$
declare v_owner uuid := public.current_account_owner_id(); v_balance numeric; v_row public.stock_correction_requests;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.solicitar')) then
    raise exception 'Sem permissão para solicitar correção de estoque.' using errcode = '42501';
  end if;
  if p_physical_quantity is null or p_physical_quantity < 0 then
    raise exception 'A quantidade física deve ser maior ou igual a zero.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.materiais where id=p_material_id and account_owner_id=v_owner)
     or not exists (select 1 from public.centros_estoque where id=p_stock_center_id and account_owner_id=v_owner) then
    raise exception 'Material ou centro de estoque não pertence ao tenant atual.' using errcode = '42501';
  end if;
  perform public.lock_stock_position(v_owner, p_material_id, p_stock_center_id);
  perform public.assert_stock_position_unlocked(v_owner, p_material_id, p_stock_center_id);
  v_balance := public.calcular_saldo_estoque(v_owner, p_material_id, p_stock_center_id);
  insert into public.stock_correction_requests
    (account_owner_id, material_id, stock_center_id, system_balance, physical_quantity,
     difference, notes, requested_by)
  values (v_owner, p_material_id, p_stock_center_id, v_balance, p_physical_quantity,
    p_physical_quantity-v_balance, nullif(btrim(p_notes), ''), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.rpc_stock_correction_balance(p_material_id uuid, p_stock_center_id uuid)
returns numeric language plpgsql stable security definer
set search_path = public set row_security = off as $$
declare v_owner uuid := public.current_account_owner_id();
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.read')
      or public.has_permission('estoque.correcao.solicitar') or public.has_permission('estoque.correcao.aprovar')) then
    raise exception 'Sem permissão para consultar o saldo.' using errcode='42501';
  end if;
  if not exists (select 1 from public.materiais where id=p_material_id and account_owner_id=v_owner)
     or not exists (select 1 from public.centros_estoque where id=p_stock_center_id and account_owner_id=v_owner) then
    raise exception 'Material ou centro de estoque não pertence ao tenant atual.' using errcode='42501';
  end if;
  return public.calcular_saldo_estoque(v_owner, p_material_id, p_stock_center_id);
end;
$$;

create or replace function public.rpc_stock_correction_approve(p_request_id uuid)
returns public.stock_correction_requests language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_owner uuid := public.current_account_owner_id(); v_req public.stock_correction_requests; v_balance numeric;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.aprovar')) then
    raise exception 'Sem permissão para aprovar correção de estoque.' using errcode = '42501';
  end if;
  select * into v_req from public.stock_correction_requests
   where id=p_request_id and account_owner_id=v_owner for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode='P0002'; end if;
  if v_req.status <> 'PENDENTE' then raise exception 'A solicitação não está pendente.'; end if;
  if v_req.requested_by = auth.uid() then raise exception 'O solicitante não pode aprovar a própria solicitação.' using errcode='42501'; end if;
  perform public.lock_stock_position(v_owner, v_req.material_id, v_req.stock_center_id);
  v_balance := public.calcular_saldo_estoque(v_owner, v_req.material_id, v_req.stock_center_id);
  if v_balance <> v_req.system_balance then
    raise exception 'O saldo atual (%) diverge do saldo conferido (%). Rejeite e refaça a conferência.', v_balance, v_req.system_balance;
  end if;
  if v_balance + v_req.difference < 0 then raise exception 'A correção deixaria o estoque negativo.'; end if;
  if v_req.difference <> 0 then
    insert into public.stock_adjustments
      (request_id, account_owner_id, material_id, stock_center_id, adjustment_quantity, reason, created_by)
    values (v_req.id, v_owner, v_req.material_id, v_req.stock_center_id, v_req.difference, v_req.reason, auth.uid());
  end if;
  update public.stock_correction_requests set status='APROVADO', approved_by=auth.uid(), approved_at=now()
   where id=v_req.id returning * into v_req;
  return v_req;
end;
$$;

create or replace function public.rpc_stock_correction_reject(p_request_id uuid, p_reason text)
returns public.stock_correction_requests language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_owner uuid := public.current_account_owner_id(); v_req public.stock_correction_requests;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.aprovar')) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Informe o motivo da rejeição.' using errcode='22023'; end if;
  select * into v_req from public.stock_correction_requests where id=p_request_id and account_owner_id=v_owner for update;
  if not found or v_req.status <> 'PENDENTE' then raise exception 'Solicitação pendente não encontrada.'; end if;
  perform public.lock_stock_position(v_owner, v_req.material_id, v_req.stock_center_id);
  update public.stock_correction_requests set status='REJEITADO', rejected_by=auth.uid(), rejected_at=now(), rejection_reason=btrim(p_reason)
   where id=v_req.id returning * into v_req;
  return v_req;
end;
$$;

create or replace function public.rpc_stock_correction_cancel(p_request_id uuid, p_reason text default null)
returns public.stock_correction_requests language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_owner uuid := public.current_account_owner_id(); v_req public.stock_correction_requests;
begin
  select * into v_req from public.stock_correction_requests where id=p_request_id and account_owner_id=v_owner for update;
  if not found or v_req.status <> 'PENDENTE' then raise exception 'Solicitação pendente não encontrada.'; end if;
  if v_req.requested_by <> auth.uid() and not public.is_master()
     and not public.has_permission('estoque.correcao.aprovar') then raise exception 'Sem permissão para cancelar.' using errcode='42501'; end if;
  perform public.lock_stock_position(v_owner, v_req.material_id, v_req.stock_center_id);
  update public.stock_correction_requests set status='CANCELADO', cancelled_by=auth.uid(), cancelled_at=now(), cancellation_reason=nullif(btrim(p_reason), '')
   where id=v_req.id returning * into v_req;
  return v_req;
end;
$$;

alter table public.stock_correction_requests enable row level security;
alter table public.stock_adjustments enable row level security;
create policy stock_correction_requests_select on public.stock_correction_requests for select to authenticated
using ((public.is_master() or account_owner_id=public.current_account_owner_id()) and
 (public.is_master() or public.has_permission('estoque.correcao.read') or public.has_permission('estoque.correcao.solicitar') or public.has_permission('estoque.correcao.aprovar')));
create policy stock_adjustments_select on public.stock_adjustments for select to authenticated
using ((public.is_master() or account_owner_id=public.current_account_owner_id()) and
 (public.is_master() or public.has_permission('estoque.correcao.read') or public.has_permission('estoque.read')));

revoke all on public.stock_correction_requests, public.stock_adjustments from anon, authenticated;
grant select on public.stock_correction_requests, public.stock_adjustments to authenticated;
revoke all on function public.calcular_saldo_estoque(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.lock_stock_position(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.assert_stock_position_unlocked(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.rpc_stock_correction_request(uuid,uuid,numeric,text) from public, anon;
revoke all on function public.rpc_stock_correction_balance(uuid,uuid) from public, anon;
revoke all on function public.rpc_stock_correction_approve(uuid) from public, anon;
revoke all on function public.rpc_stock_correction_reject(uuid,text) from public, anon;
revoke all on function public.rpc_stock_correction_cancel(uuid,text) from public, anon;
grant execute on function public.rpc_stock_correction_request(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.rpc_stock_correction_balance(uuid,uuid) to authenticated;
grant execute on function public.rpc_stock_correction_approve(uuid) to authenticated;
grant execute on function public.rpc_stock_correction_reject(uuid,text) to authenticated;
grant execute on function public.rpc_stock_correction_cancel(uuid,text) to authenticated;
