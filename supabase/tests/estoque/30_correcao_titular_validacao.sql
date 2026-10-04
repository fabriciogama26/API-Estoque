-- Validacao da aprovacao de correcoes de estoque fisico (20261009_stock_correction_titular_aprova_propria).
-- Executar em PostgreSQL local descartavel, apos os stubs e as migrations. Termina em ROLLBACK.

\set ON_ERROR_STOP on
begin;

create schema correcao_test;
grant usage on schema correcao_test to public;

create function correcao_test.ok(p_condicao boolean, p_caso text)
returns void
language plpgsql
as $$
begin
  if p_condicao is distinct from true then
    raise exception 'FALHOU: %', p_caso;
  end if;
  raise notice 'ok - %', p_caso;
end;
$$;

create function correcao_test.erro(p_sql text, p_trecho text, p_caso text)
returns void
language plpgsql
as $$
declare
  v_msg text;
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    if position(lower(p_trecho) in lower(v_msg)) > 0 or v_state = p_trecho then
      raise notice 'ok - % (erro esperado: %)', p_caso, v_msg;
      return;
    end if;
    raise exception 'FALHOU: % (erro inesperado: % / %)', p_caso, v_state, v_msg;
  end;
  raise exception 'FALHOU: % (nenhum erro gerado)', p_caso;
end;
$$;

create function correcao_test.login(p_user uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(p_role, ''), true);
  if p_role in ('authenticated', 'service_role', 'anon') then
    execute format('set local role %I', p_role);
  end if;
end;
$$;

-- Dados -----------------------------------------------------------------------------------------
-- Tenant A: titular e um dependente com credencial admin (parent_user_id preenchido).
insert into public.app_users (id, username, display_name, credential, parent_user_id) values
  ('a3000000-0000-0000-0000-000000000001', 'titular_a', 'Admin', 'admin', null),
  ('a3000000-0000-0000-0000-000000000002', 'dependente_a', 'Admin', 'admin', 'a3000000-0000-0000-0000-000000000001');

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from (values
    ('a3000000-0000-0000-0000-000000000001'::uuid, 'admin'),
    ('a3000000-0000-0000-0000-000000000002'::uuid, 'admin')
  ) as u(id, role_name)
  join public.roles r on r.name = u.role_name;

insert into public.status_entrada (id, status) values ('5e300000-0000-0000-0000-000000000001', 'REGISTRADO');
insert into public.centros_estoque (id, almox, account_owner_id) values
  ('ce300000-0000-0000-0000-000000000001', 'Almox Central', 'a3000000-0000-0000-0000-000000000001');
insert into public.materiais (id, nome, account_owner_id) values
  ('a7300000-0000-0000-0000-000000000001', 'Luva', 'a3000000-0000-0000-0000-000000000001'),
  ('a7300000-0000-0000-0000-000000000002', 'Botina', 'a3000000-0000-0000-0000-000000000001'),
  ('a7300000-0000-0000-0000-000000000003', 'Capacete', 'a3000000-0000-0000-0000-000000000001'),
  ('a7300000-0000-0000-0000-000000000004', 'Oculos', 'a3000000-0000-0000-0000-000000000001');
insert into public.entradas ("materialId", quantidade, "dataEntrada", centro_estoque, status, account_owner_id)
select m.id, 10, now() - interval '5 days', 'ce300000-0000-0000-0000-000000000001',
       '5e300000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001'
  from public.materiais m
 where m.account_owner_id = 'a3000000-0000-0000-0000-000000000001';

-- Titular aprova e rejeita a propria correcao ---------------------------------------------------
select correcao_test.login('a3000000-0000-0000-0000-000000000001');

select correcao_test.ok(
  (public.rpc_stock_correction_request('a7300000-0000-0000-0000-000000000001', 'ce300000-0000-0000-0000-000000000001', 7)).status = 'PENDENTE',
  'titular solicita correcao da Luva (10 -> 7)');

select correcao_test.ok(
  (select (public.rpc_stock_correction_approve(r.id)).status = 'APROVADO'
     from public.stock_correction_requests r
    where r.material_id = 'a7300000-0000-0000-0000-000000000001' and r.status = 'PENDENTE'),
  'titular aprova a propria correcao');

select correcao_test.ok(
  public.rpc_stock_correction_balance('a7300000-0000-0000-0000-000000000001', 'ce300000-0000-0000-0000-000000000001') = 7,
  'saldo da Luva passa a 7 com o ajuste aprovado pelo titular');

select correcao_test.ok(
  (select approved_by = requested_by from public.stock_correction_requests
    where material_id = 'a7300000-0000-0000-0000-000000000001'),
  'aprovacao registra o titular como solicitante e aprovador');

select public.rpc_stock_correction_request('a7300000-0000-0000-0000-000000000002', 'ce300000-0000-0000-0000-000000000001', 4);
select correcao_test.ok(
  (select (public.rpc_stock_correction_reject(r.id, 'Contagem refeita')).status = 'REJEITADO'
     from public.stock_correction_requests r
    where r.material_id = 'a7300000-0000-0000-0000-000000000002' and r.status = 'PENDENTE'),
  'titular rejeita a propria correcao');

-- Dependente com credencial admin nao aprova a propria --------------------------------------------
select correcao_test.login('a3000000-0000-0000-0000-000000000002');

select public.rpc_stock_correction_request('a7300000-0000-0000-0000-000000000003', 'ce300000-0000-0000-0000-000000000001', 12);
select correcao_test.erro(
  $sql$select public.rpc_stock_correction_approve(r.id) from public.stock_correction_requests r
        where r.material_id = 'a7300000-0000-0000-0000-000000000003' and r.status = 'PENDENTE'$sql$,
  'O solicitante não pode aprovar a própria solicitação',
  'dependente admin nao aprova a propria correcao');

select correcao_test.ok(
  (select status = 'PENDENTE' from public.stock_correction_requests
    where material_id = 'a7300000-0000-0000-0000-000000000003'),
  'correcao do dependente continua pendente apos a tentativa');

-- Aprovacoes cruzadas continuam valendo -----------------------------------------------------------
select correcao_test.login('a3000000-0000-0000-0000-000000000001');
select correcao_test.ok(
  (select (public.rpc_stock_correction_approve(r.id)).status = 'APROVADO'
     from public.stock_correction_requests r
    where r.material_id = 'a7300000-0000-0000-0000-000000000003' and r.status = 'PENDENTE'),
  'titular aprova a correcao do dependente');

select public.rpc_stock_correction_request('a7300000-0000-0000-0000-000000000004', 'ce300000-0000-0000-0000-000000000001', 9);
select correcao_test.login('a3000000-0000-0000-0000-000000000002');
select correcao_test.ok(
  (select (public.rpc_stock_correction_approve(r.id)).status = 'APROVADO'
     from public.stock_correction_requests r
    where r.material_id = 'a7300000-0000-0000-0000-000000000004' and r.status = 'PENDENTE'),
  'dependente aprova a correcao do titular');

rollback;
