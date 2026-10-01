-- Corrige saldo zerado para usuarios master/administradores que operam materiais
-- pertencentes a um account_owner_id diferente do proprio usuario autenticado.

create or replace function public.resolve_stock_position_owner(
  p_material_id uuid, p_stock_center_id uuid
) returns uuid language plpgsql stable security definer
set search_path = public set row_security = off as $$
declare v_owner uuid; v_session_owner uuid := public.current_account_owner_id();
begin
  select m.account_owner_id into v_owner
    from public.materiais m
    join public.centros_estoque c on c.id = p_stock_center_id
      and c.account_owner_id = m.account_owner_id
   where m.id = p_material_id;
  if v_owner is null then
    raise exception 'Material ou centro de estoque não encontrado no mesmo tenant.' using errcode='42501';
  end if;
  if not public.is_master() and v_owner <> v_session_owner then
    raise exception 'Material ou centro de estoque não pertence ao tenant atual.' using errcode='42501';
  end if;
  return v_owner;
end;
$$;

create or replace function public.rpc_stock_correction_request(
  p_material_id uuid, p_stock_center_id uuid, p_physical_quantity numeric, p_notes text default null
) returns public.stock_correction_requests
language plpgsql security definer set search_path = public set row_security = off as $$
declare v_owner uuid; v_balance numeric; v_row public.stock_correction_requests;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.solicitar')) then
    raise exception 'Sem permissão para solicitar correção de estoque.' using errcode = '42501';
  end if;
  if p_physical_quantity is null or p_physical_quantity < 0 then
    raise exception 'A quantidade física deve ser maior ou igual a zero.' using errcode = '22023';
  end if;
  v_owner := public.resolve_stock_position_owner(p_material_id, p_stock_center_id);
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
declare v_owner uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.read')
      or public.has_permission('estoque.correcao.solicitar') or public.has_permission('estoque.correcao.aprovar')) then
    raise exception 'Sem permissão para consultar o saldo.' using errcode='42501';
  end if;
  v_owner := public.resolve_stock_position_owner(p_material_id, p_stock_center_id);
  return public.calcular_saldo_estoque(v_owner, p_material_id, p_stock_center_id);
end;
$$;

create or replace function public.rpc_stock_balance(p_material_id uuid, p_stock_center_id uuid)
returns numeric language plpgsql stable security definer
set search_path = public set row_security = off as $$
declare v_owner uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.read')
      or public.has_permission('estoque.write') or public.has_permission('estoque.atual')
      or public.has_permission('estoque.saidas') or public.has_permission('estoque.entradas')
      or public.has_permission('estoque.correcao.read') or public.has_permission('estoque.correcao.solicitar')) then
    raise exception 'Sem permissão para consultar o saldo.' using errcode='42501';
  end if;
  v_owner := public.resolve_stock_position_owner(p_material_id, p_stock_center_id);
  return public.calcular_saldo_estoque(v_owner, p_material_id, p_stock_center_id);
end;
$$;

create or replace function public.rpc_stock_correction_approve(p_request_id uuid)
returns public.stock_correction_requests language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_session_owner uuid := public.current_account_owner_id(); v_owner uuid; v_req public.stock_correction_requests; v_balance numeric;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.aprovar')) then
    raise exception 'Sem permissão para aprovar correção de estoque.' using errcode = '42501';
  end if;
  select * into v_req from public.stock_correction_requests
   where id=p_request_id and (public.is_master() or account_owner_id=v_session_owner) for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode='P0002'; end if;
  if v_req.status <> 'PENDENTE' then raise exception 'A solicitação não está pendente.'; end if;
  if v_req.requested_by = auth.uid() then raise exception 'O solicitante não pode aprovar a própria solicitação.' using errcode='42501'; end if;
  v_owner := v_req.account_owner_id;
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
declare v_session_owner uuid := public.current_account_owner_id(); v_owner uuid; v_req public.stock_correction_requests;
begin
  if not (public.is_master() or public.has_permission('estoque.correcao.aprovar')) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Informe o motivo da rejeição.' using errcode='22023'; end if;
  select * into v_req from public.stock_correction_requests where id=p_request_id and (public.is_master() or account_owner_id=v_session_owner) for update;
  if not found or v_req.status <> 'PENDENTE' then raise exception 'Solicitação pendente não encontrada.'; end if;
  v_owner := v_req.account_owner_id;
  perform public.lock_stock_position(v_owner, v_req.material_id, v_req.stock_center_id);
  update public.stock_correction_requests set status='REJEITADO', rejected_by=auth.uid(), rejected_at=now(), rejection_reason=btrim(p_reason)
   where id=v_req.id returning * into v_req;
  return v_req;
end;
$$;

create or replace function public.rpc_stock_correction_cancel(p_request_id uuid, p_reason text default null)
returns public.stock_correction_requests language plpgsql security definer
set search_path = public set row_security = off as $$
declare v_session_owner uuid := public.current_account_owner_id(); v_owner uuid; v_req public.stock_correction_requests;
begin
  select * into v_req from public.stock_correction_requests where id=p_request_id and (public.is_master() or account_owner_id=v_session_owner) for update;
  if not found or v_req.status <> 'PENDENTE' then raise exception 'Solicitação pendente não encontrada.'; end if;
  if v_req.requested_by <> auth.uid() and not public.is_master()
     and not public.has_permission('estoque.correcao.aprovar') then raise exception 'Sem permissão para cancelar.' using errcode='42501'; end if;
  v_owner := v_req.account_owner_id;
  perform public.lock_stock_position(v_owner, v_req.material_id, v_req.stock_center_id);
  update public.stock_correction_requests set status='CANCELADO', cancelled_by=auth.uid(), cancelled_at=now(), cancellation_reason=nullif(btrim(p_reason), '')
   where id=v_req.id returning * into v_req;
  return v_req;
end;
$$;

revoke all on function public.resolve_stock_position_owner(uuid,uuid) from public, anon, authenticated;
revoke all on function public.rpc_stock_balance(uuid,uuid) from public, anon;
grant execute on function public.rpc_stock_balance(uuid,uuid) to authenticated;
