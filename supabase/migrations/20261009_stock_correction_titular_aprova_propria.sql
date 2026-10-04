-- Correcao de estoque fisico: o titular da conta (app_users sem parent_user_id e fora de
-- app_users_dependentes) pode aprovar a propria solicitacao. Dependentes continuam precisando
-- da aprovacao de outro usuario. O criterio e a conta, nao o nome nem a credencial: um
-- dependente com credencial admin nao aprova a propria correcao.
-- Rejeitar e cancelar a propria solicitacao ja eram permitidos e nao mudam.
-- Unica mudanca em relacao a 20261001_fix_stock_correction_balance_owner.sql: a checagem do solicitante.

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
  -- current_account_owner_id() so devolve o proprio usuario para o titular da conta.
  if v_req.requested_by = auth.uid() and v_session_owner is distinct from auth.uid() then
    raise exception 'O solicitante não pode aprovar a própria solicitação. Somente o titular da conta aprova a própria correção.' using errcode='42501';
  end if;
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

comment on function public.rpc_stock_correction_approve(uuid) is
  'Aprova uma correcao de estoque fisico pendente. O titular da conta pode aprovar a propria solicitacao; dependentes nao.';

revoke all on function public.rpc_stock_correction_approve(uuid) from public, anon;
grant execute on function public.rpc_stock_correction_approve(uuid) to authenticated;
