-- Validacao do saldo unico de estoque (executar em PostgreSQL local descartavel, apos os stubs e as migrations).
-- Tudo roda dentro de uma transacao e termina em ROLLBACK.

\set ON_ERROR_STOP on
begin;

create schema estoque_test;
grant usage on schema estoque_test to public;

create function estoque_test.ok(p_condicao boolean, p_caso text)
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

create function estoque_test.erro(p_sql text, p_trecho text, p_caso text)
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

create function estoque_test.login(p_user uuid, p_role text default 'authenticated')
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
-- Tenant A: owner + aprovador (filho) + visitante sem permissao de estoque. Tenant B isolado.
insert into public.app_users (id, username, credential, parent_user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner_a', 'admin', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aprovador_a', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'visitante_a', 'visitante', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'owner_b', 'admin', null);

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from (values
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'admin'),
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'admin'),
    ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'visitante'),
    ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'admin')
  ) as u(id, role_name)
  join public.roles r on r.name = u.role_name;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.name = 'admin' and p.key = 'estoque.read'
on conflict do nothing;

insert into public.status_entrada (id, status) values
  ('5e000000-0000-0000-0000-000000000001', 'ATIVO'),
  ('5e000000-0000-0000-0000-000000000002', 'CANCELADO');
insert into public.status_saida (id, status) values
  ('55000000-0000-0000-0000-000000000001', 'ENTREGUE'),
  ('55000000-0000-0000-0000-000000000002', 'CANCELADO');

insert into public.centros_estoque (id, almox, account_owner_id) values
  ('c1000000-0000-0000-0000-000000000001', 'Almox Central', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000001', 'Almox Obra', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cb000000-0000-0000-0000-000000000001', 'Almox B', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.materiais (id, nome, "valorUnitario", account_owner_id) values
  ('11111111-0000-0000-0000-000000000001', 'Luva', 10, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000002', 'Bota', 50, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000003', 'Capacete', 30, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000004', 'Mascara', 2, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-0000000000b1', 'Luva B', 10, 'bbbbbbbb-0000-0000-0000-000000000001');

-- Luva: 10 no Central, 5 na Obra, 3 cancelada no Central.
insert into public.entradas ("materialId", quantidade, "dataEntrada", centro_estoque, status, account_owner_id) values
  ('11111111-0000-0000-0000-000000000001', 10, now() - interval '30 days', 'c1000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000001', 5, now() - interval '20 days', 'c2000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000001', 3, now() - interval '10 days', 'c1000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001'),
  -- Bota: entrada com data futura (a politica antiga ignorava; a Saida sempre considerou).
  ('11111111-0000-0000-0000-000000000002', 4, now() + interval '1 day', 'c1000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  -- Mascara: volume acima do antigo limite de 1000 linhas.
  ('11111111-0000-0000-0000-000000000004', 2000, now() - interval '60 days', 'c1000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-0000000000b1', 100, now() - interval '30 days', 'cb000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.saidas ("materialId", quantidade, "dataEntrega", centro_estoque, status, account_owner_id) values
  ('11111111-0000-0000-0000-000000000001', 2, now() - interval '5 days', 'c1000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000001', 1, now() - interval '4 days', 'c1000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.saidas ("materialId", quantidade, "dataEntrega", centro_estoque, status, account_owner_id)
select '11111111-0000-0000-0000-000000000004', 1, now() - interval '50 days' + make_interval(mins => g),
       'c1000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'
  from generate_series(1, 1500) g;

-- Saida legada sem centro (o trigger atual nao deixaria gravar; simula dado antigo).
set local session_replication_role = replica;
insert into public.saidas ("materialId", quantidade, "dataEntrega", centro_estoque, status, account_owner_id) values
  ('11111111-0000-0000-0000-000000000001', 1, now() - interval '3 days', null, '55000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
set local session_replication_role = origin;

-- Correcao aprovada: Luva na Obra, sistema 5, fisico 7 (+2).
insert into public.stock_correction_requests
  (id, account_owner_id, material_id, stock_center_id, system_balance, physical_quantity, difference,
   status, requested_by, approved_by, approved_at)
values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001', 5, 7, 2, 'APROVADO',
   'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '1 day');
insert into public.stock_adjustments
  (request_id, account_owner_id, material_id, stock_center_id, adjustment_quantity, created_by, created_at)
values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001', 2, 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '1 day');

-- rpc_estoque_saldos ----------------------------------------------------------------------------
select estoque_test.login('aaaaaaaa-0000-0000-0000-000000000001');

select estoque_test.ok(
  (select saldo = 8 and total_entradas = 10 and total_saidas = 2 and total_ajustes = 0 and qtd_saidas = 1
     from public.rpc_estoque_saldos()
    where material_id = '11111111-0000-0000-0000-000000000001'
      and centro_estoque_id = 'c1000000-0000-0000-0000-000000000001'),
  'Luva no Almox Central: 10 - 2 = 8, ignorando entrada e saida canceladas');

select estoque_test.ok(
  (select saldo = 7 and total_ajustes = 2 and centro_estoque_nome = 'Almox Obra'
     from public.rpc_estoque_saldos()
    where material_id = '11111111-0000-0000-0000-000000000001'
      and centro_estoque_id = 'c2000000-0000-0000-0000-000000000001'),
  'Luva no Almox Obra: 5 + correcao aprovada de 2 = 7, com nome do centro');

select estoque_test.ok(
  (select saldo = -1 and centro_estoque_nome is null
     from public.rpc_estoque_saldos()
    where material_id = '11111111-0000-0000-0000-000000000001'
      and centro_estoque_id is null),
  'saida legada sem centro vira posicao propria (-1), visivel para correcao');

select estoque_test.ok(
  (select sum(saldo) = 14 from public.rpc_estoque_saldos()
    where material_id = '11111111-0000-0000-0000-000000000001'),
  'total da Luva somando os centros = 14 (o que o card deve mostrar)');

select estoque_test.ok(
  (select saldo = 500 and qtd_saidas = 1500 from public.rpc_estoque_saldos()
    where material_id = '11111111-0000-0000-0000-000000000004'),
  'Mascara com 1500 saidas: 2000 - 1500 = 500, sem corte de 1000 linhas');

select estoque_test.ok(
  not exists (select 1 from public.rpc_estoque_saldos() where material_id = '11111111-0000-0000-0000-0000000000b1'),
  'tenant A nao enxerga o estoque do tenant B');

select estoque_test.ok(
  (select count(*) = 3 and bool_and(material_id = '11111111-0000-0000-0000-000000000001')
     from public.rpc_estoque_saldos('11111111-0000-0000-0000-000000000001')),
  'filtro por material devolve so as posicoes daquele material');

select estoque_test.ok(
  (select count(*) = 3
          and sum(saldo) filter (where centro_estoque_id = 'c1000000-0000-0000-0000-000000000001') = -2
          and sum(saldo) filter (where centro_estoque_id = 'c2000000-0000-0000-0000-000000000001') = 7
          and sum(saldo) filter (where centro_estoque_id is null) = -1
     from public.rpc_estoque_saldos(null, now() - interval '25 days', now())),
  'periodo (ultimos 25 dias): so a movimentacao do intervalo, sem entrada futura nem lancamentos antigos');

select estoque_test.login('aaaaaaaa-0000-0000-0000-000000000003');
select estoque_test.erro('select * from public.rpc_estoque_saldos()', '42501', 'usuario sem permissao de estoque e bloqueado');

select estoque_test.login(null, 'anon');
select estoque_test.erro('select * from public.rpc_estoque_saldos()', '42501', 'anon nao executa rpc_estoque_saldos');

select estoque_test.login('aaaaaaaa-0000-0000-0000-000000000001');
select estoque_test.erro(
  'select * from public._estoque_saldos_posicoes(''bbbbbbbb-0000-0000-0000-000000000001''::uuid)',
  '42501',
  'usuario autenticado nao chama a funcao interna com owner arbitrario');

-- Mesma regra da Saida -------------------------------------------------------------------------
select estoque_test.login(null, 'postgres');

select estoque_test.ok(
  (select bool_and(p.saldo = public.calcular_saldo_estoque('aaaaaaaa-0000-0000-0000-000000000001', p.material_id, p.centro_estoque_id))
     from public._estoque_saldos_posicoes('aaaaaaaa-0000-0000-0000-000000000001') p
    where p.centro_estoque_id is not null),
  'saldo por centro = calcular_saldo_estoque (mesmo numero da Saida e do modal de correcao)');

-- Politica de reposicao --------------------------------------------------------------------------
select estoque_test.ok(
  (select (i->>'estoque_atual')::numeric = 14
     from jsonb_array_elements(public._inventory_reposicao_calcular_modo('aaaaaaaa-0000-0000-0000-000000000001', null)->'itens') i
    where i->>'material_id' = '11111111-0000-0000-0000-000000000001'),
  'politica de reposicao: Luva com estoque_atual 14 (inclui a correcao aprovada)');

select estoque_test.ok(
  (select (i->>'estoque_atual')::numeric = 4
     from jsonb_array_elements(public._inventory_reposicao_calcular_modo('aaaaaaaa-0000-0000-0000-000000000001', null)->'itens') i
    where i->>'material_id' = '11111111-0000-0000-0000-000000000002'),
  'politica de reposicao: Bota com entrada de data futura conta no estoque (igual a Saida)');

select estoque_test.ok(
  (select (i->>'estoque_atual')::numeric = 0 and (i->>'consumo_90d')::numeric = 0
     from jsonb_array_elements(public._inventory_reposicao_calcular_modo('aaaaaaaa-0000-0000-0000-000000000001', null)->'itens') i
    where i->>'material_id' = '11111111-0000-0000-0000-000000000003'),
  'politica de reposicao: material sem movimento continua com estoque 0');

select estoque_test.ok(
  (select (i->>'estoque_atual')::numeric = 500 and (i->>'consumo_90d')::numeric = 1500
     from jsonb_array_elements(public._inventory_reposicao_calcular_modo('aaaaaaaa-0000-0000-0000-000000000001', null)->'itens') i
    where i->>'material_id' = '11111111-0000-0000-0000-000000000004'),
  'politica de reposicao: Mascara com estoque 500 e consumo de 90 dias preservado (1500)');

-- Orcamento anual (20261004_orcamento_12m_saldo_unico) --------------------------------------------
insert into public.inventory_forecast (account_owner_id, periodo_base_inicio, periodo_base_fim)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        (date_trunc('month', now()) - interval '12 months')::date,
        (date_trunc('month', now()) - interval '1 day')::date);

select estoque_test.ok(
  (select public.rpc_orcamento_compra_12m_calcular('aaaaaaaa-0000-0000-0000-000000000001', null, '{}'::jsonb)->>'status' = 'ok'),
  'orcamento anual calcula com a previsao do tenant');

-- Antes: Luva 12 (sem a correcao de +2) x 10 + Bota 4 x 50 + Mascara 500 x 2 = 1320.
select estoque_test.ok(
  (select (public.rpc_orcamento_compra_12m_calcular('aaaaaaaa-0000-0000-0000-000000000001', null, '{}'::jsonb)
             ->'composicao'->>'estoque_utilizavel')::numeric = 1340),
  'orcamento anual: estoque utilizavel = Luva 14 x 10 + Bota 4 x 50 + Mascara 500 x 2 = 1340 (inclui a correcao aprovada)');

select estoque_test.ok(
  (select (public.rpc_orcamento_compra_12m_calcular('aaaaaaaa-0000-0000-0000-000000000001', null, '{}'::jsonb)
             ->'composicao'->>'estoque_utilizavel')::numeric
        = (select sum(round(greatest(t.saldo, 0) * m."valorUnitario", 2))
             from (select material_id, sum(saldo) as saldo
                     from public._estoque_saldos_posicoes('aaaaaaaa-0000-0000-0000-000000000001')
                    group by material_id) t
             join public.materiais m on m.id = t.material_id)),
  'orcamento anual usa o mesmo saldo da Saida e do Estoque atual');

select estoque_test.ok(
  (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rpc_orcamento_compra_12m_calcular'),
  'orcamento anual com uma unica assinatura (text, text, jsonb)');

rollback;
