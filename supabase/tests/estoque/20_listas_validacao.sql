-- Validacao das listas paginadas de Entradas e Saidas (20261005_listas_movimentacoes_paginadas).
-- Executar em PostgreSQL local descartavel, apos os stubs e as migrations. Termina em ROLLBACK.

\set ON_ERROR_STOP on
begin;

create schema listas_test;
grant usage on schema listas_test to public;

create function listas_test.ok(p_condicao boolean, p_caso text)
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

create function listas_test.erro(p_sql text, p_trecho text, p_caso text)
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

create function listas_test.login(p_user uuid, p_role text default 'authenticated')
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
-- Tenant A: titular, subusuario em app_users e um dependente que so existe em app_users_dependentes.
insert into public.app_users (id, username, display_name, credential, parent_user_id) values
  ('a1000000-0000-0000-0000-000000000001', 'owner_a', 'Dono A', 'admin', null),
  ('a1000000-0000-0000-0000-000000000002', 'operador_a', 'Operador A', 'admin', 'a1000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000003', 'visitante_a', null, 'visitante', 'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000001', 'owner_b', null, 'admin', null);
insert into public.app_users_dependentes (auth_user_id, owner_app_user_id, username, display_name) values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'dep_a', 'Dependente A');

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from (values
    ('a1000000-0000-0000-0000-000000000001'::uuid, 'admin'),
    ('a1000000-0000-0000-0000-000000000002'::uuid, 'admin'),
    ('a1000000-0000-0000-0000-000000000003'::uuid, 'visitante'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, 'admin')
  ) as u(id, role_name)
  join public.roles r on r.name = u.role_name;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.name = 'admin' and p.key = 'estoque.read'
on conflict do nothing;

insert into public.status_entrada (id, status) values
  ('5e100000-0000-0000-0000-000000000001', 'REGISTRADO'),
  ('5e100000-0000-0000-0000-000000000002', 'CANCELADO');
insert into public.status_saida (id, status) values
  ('55100000-0000-0000-0000-000000000001', 'ENTREGUE'),
  ('55100000-0000-0000-0000-000000000002', 'CANCELADO');

insert into public.centros_estoque (id, almox, account_owner_id) values
  ('ce100000-0000-0000-0000-000000000001', 'Almox Central', 'a1000000-0000-0000-0000-000000000001'),
  ('ce100000-0000-0000-0000-000000000002', 'Almox Obra', 'a1000000-0000-0000-0000-000000000001'),
  ('ce100000-0000-0000-0000-0000000000b1', 'Almox B', 'b1000000-0000-0000-0000-000000000001');
insert into public.centros_custo (id, nome, account_owner_id) values
  ('cc100000-0000-0000-0000-000000000001', 'Manutenção', 'a1000000-0000-0000-0000-000000000001');
insert into public.centros_servico (id, nome, account_owner_id) values
  ('c5100000-0000-0000-0000-000000000001', 'Elétrica', 'a1000000-0000-0000-0000-000000000001');
insert into public.setores (id, nome, account_owner_id) values
  ('5e700000-0000-0000-0000-000000000001', 'Turno A', 'a1000000-0000-0000-0000-000000000001');
insert into public.cargos (id, nome, account_owner_id) values
  ('ca100000-0000-0000-0000-000000000001', 'Eletricista', 'a1000000-0000-0000-0000-000000000001');
insert into public.pessoas (id, nome, matricula, centro_servico_id, setor_id, cargo_id, centro_custo_id, account_owner_id) values
  ('9e100000-0000-0000-0000-000000000001', 'João da Silva', '123', 'c5100000-0000-0000-0000-000000000001',
   '5e700000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001'),
  ('9e100000-0000-0000-0000-000000000002', 'Maria Souza', '456', null, null, null, null, 'a1000000-0000-0000-0000-000000000001');

insert into public.materiais (id, nome, fabricante, ca, "valorUnitario", account_owner_id) values
  ('a7100000-0000-0000-0000-000000000001', 'Luva Nitrílica', 'Danny', '12345', 10, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000002', 'Botina', 'Bracol', '777', 50, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000003', 'Máscara PFF2', '3M', '999', 2, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-0000000000b1', 'Luva B', 'Danny', '12345', 10, 'b1000000-0000-0000-0000-000000000001');

insert into public.entradas ("materialId", quantidade, "dataEntrada", centro_estoque, status, "usuarioResponsavel", account_owner_id) values
  ('a7100000-0000-0000-0000-000000000001', 10, now() - interval '30 days', 'ce100000-0000-0000-0000-000000000001', '5e100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000002', 5, now() - interval '20 days', 'ce100000-0000-0000-0000-000000000002', '5e100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000001', 3, now() - interval '10 days', 'ce100000-0000-0000-0000-000000000001', '5e100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000003', 2000, now() - interval '90 days', 'ce100000-0000-0000-0000-000000000001', '5e100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-0000000000b1', 100, now() - interval '30 days', 'ce100000-0000-0000-0000-0000000000b1', '5e100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');

-- Saidas com cada faixa de prazo de troca (data de troca em UTC, como o banco grava).
insert into public.saidas ("materialId", "pessoaId", quantidade, "dataEntrega", "dataTroca", centro_estoque, centro_custo, centro_servico,
                           status, "usuarioResponsavel", "isTroca", account_owner_id) values
  ('a7100000-0000-0000-0000-000000000001', '9e100000-0000-0000-0000-000000000001', 2, now() - interval '1 day',
   (current_date - 1)::timestamp at time zone 'UTC', 'ce100000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001',
   'c5100000-0000-0000-0000-000000000001', '55100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', true,
   'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000002', '9e100000-0000-0000-0000-000000000001', 1, now() - interval '2 days',
   current_date::timestamp at time zone 'UTC', 'ce100000-0000-0000-0000-000000000002', null, null,
   '55100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', false, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000001', '9e100000-0000-0000-0000-000000000002', 1, now() - interval '3 days',
   (current_date + 5)::timestamp at time zone 'UTC', 'ce100000-0000-0000-0000-000000000001', null, null,
   '55100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', false, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000002', '9e100000-0000-0000-0000-000000000002', 1, now() - interval '4 days',
   (current_date + 30)::timestamp at time zone 'UTC', 'ce100000-0000-0000-0000-000000000002', null, null,
   '55100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', false, 'a1000000-0000-0000-0000-000000000001'),
  ('a7100000-0000-0000-0000-000000000001', '9e100000-0000-0000-0000-000000000002', 1, now() - interval '5 days',
   null, 'ce100000-0000-0000-0000-000000000001', null, null,
   '55100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', false, 'a1000000-0000-0000-0000-000000000001');

insert into public.saidas ("materialId", "pessoaId", quantidade, "dataEntrega", centro_estoque, status, "usuarioResponsavel", account_owner_id)
select 'a7100000-0000-0000-0000-000000000003', '9e100000-0000-0000-0000-000000000002', 1,
       now() - interval '60 days' + make_interval(mins => g), 'ce100000-0000-0000-0000-000000000001',
       '55100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'
  from generate_series(1, 1500) g;

insert into public.saidas ("materialId", "pessoaId", quantidade, "dataEntrega", centro_estoque, status, "usuarioResponsavel", account_owner_id) values
  ('a7100000-0000-0000-0000-0000000000b1', '9e100000-0000-0000-0000-000000000002', 1, now(), 'ce100000-0000-0000-0000-0000000000b1',
   '55100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');

-- Entradas ----------------------------------------------------------------------------------------
select listas_test.login('a1000000-0000-0000-0000-000000000001');

select listas_test.ok(
  (select count(*) = 4 and bool_and(total_registros = 4) from public.rpc_entradas_listar()),
  'entradas: todas as do tenant (inclusive a cancelada), com total');

select listas_test.ok(
  (select string_agg(distinct usuario_responsavel_nome, ',' order by usuario_responsavel_nome) = 'operador_a,owner_a'
     from public.rpc_entradas_listar()),
  'entradas: registrado por pelo username (titular e subusuario)');

select listas_test.ok(
  (select count(*) = 2 from public.rpc_entradas_listar('{"termo": "nitrilica"}')),
  'entradas: busca sem acento acha "Luva Nitrílica"');

select listas_test.ok(
  (select count(*) = 1 and min(centro_estoque_nome) = 'Almox Obra'
     from public.rpc_entradas_listar('{"centro_estoque_id": "ce100000-0000-0000-0000-000000000002"}')),
  'entradas: filtro por centro de estoque');

select listas_test.ok(
  (select count(*) = 1 and min(status_nome) = 'CANCELADO'
     from public.rpc_entradas_listar('{"status_id": "5e100000-0000-0000-0000-000000000002"}')),
  'entradas: filtro por status');

select listas_test.ok(
  (select count(*) = 1 from public.rpc_entradas_listar('{"registrado_por": "a1000000-0000-0000-0000-000000000002"}')),
  'entradas: filtro por quem registrou');

select listas_test.ok(
  (select material->>'materialItemNome' = 'Máscara PFF2' and material->>'ca' = '999'
     from public.rpc_entradas_listar() where material_id = 'a7100000-0000-0000-0000-000000000003'),
  'entradas: material embutido na linha (nao depende da lista de materiais da tela)');

-- Saidas ------------------------------------------------------------------------------------------
select listas_test.ok(
  (select count(*) = 20 and bool_and(total_registros = 1505) from public.rpc_saidas_listar('{}', 20, 0)),
  'saidas: pagina de 20 com total 1505 (acima do antigo limite de 1000)');

select listas_test.ok(
  (select count(*) = 5 from public.rpc_saidas_listar('{}', 20, 1500)),
  'saidas: ultima pagina com os 5 registros restantes');

select listas_test.ok(
  (select count(*) = 0 from public.rpc_saidas_listar('{}', 20, 1505)),
  'saidas: pagina alem do fim vem vazia');

select listas_test.ok(
  (select data_entrega = (select max(data_entrega) from public.rpc_saidas_listar('{}', 1000, 0))
     from public.rpc_saidas_listar('{}', 1, 0)),
  'saidas: mais recentes primeiro');

select listas_test.ok(
  (select count(*) = 2 and bool_and(pessoa->>'nome' = 'João da Silva')
     from public.rpc_saidas_listar('{"termo": "joao"}')),
  'saidas: busca sem acento pelo nome da pessoa');

select listas_test.ok(
  (select count(*) = 2 from public.rpc_saidas_listar('{"termo": "ELETRICA"}')),
  'saidas: busca pelo centro de servico da pessoa, sem acento e sem maiusculas');

select listas_test.ok(
  (select pessoa->>'matricula' = '123' and pessoa->>'cargo' = 'Eletricista' and pessoa->>'setor' = 'Turno A'
          and centro_custo_nome = 'Manutenção' and centro_servico_nome = 'Elétrica'
     from public.rpc_saidas_listar('{"troca_somente": true}')),
  'saidas: pessoa e centros resolvidos pelo nome');

select listas_test.ok(
  (select usuario_responsavel_nome = 'dep_a' from public.rpc_saidas_listar('{"troca_somente": true}')),
  'saidas: dependente que so existe em app_users_dependentes aparece pelo username');

select listas_test.ok(
  (select count(*) = 1 from public.rpc_saidas_listar(jsonb_build_object('troca_prazo', 'atrasada', 'hoje', current_date)))
  and (select count(*) = 1 from public.rpc_saidas_listar(jsonb_build_object('troca_prazo', 'limite', 'hoje', current_date)))
  and (select count(*) = 1 from public.rpc_saidas_listar(jsonb_build_object('troca_prazo', 'alerta', 'hoje', current_date)))
  and (select max(total_registros) = 1502 from public.rpc_saidas_listar(jsonb_build_object('troca_prazo', 'sem-data', 'hoje', current_date), 1, 0)),
  'saidas: prazo de troca (limite passado, data limite, 7 dias, sem prazo)');

select listas_test.ok(
  (select count(*) = 1 and (min(data_troca) at time zone 'UTC')::date = current_date - 1
     from public.rpc_saidas_listar(jsonb_build_object('troca_prazo', 'limite', 'hoje', current_date - 1))),
  'saidas: prazo calculado com o "hoje" enviado pelo navegador');

select listas_test.ok(
  (select count(*) = 1 from public.rpc_saidas_listar('{"troca_somente": true}')),
  'saidas: somente trocas');

select listas_test.ok(
  (select count(*) = 1 from public.rpc_saidas_listar('{"registrado_por": "d1000000-0000-0000-0000-000000000001"}')),
  'saidas: filtro por quem registrou (dependente)');

select listas_test.ok(
  (select max(total_registros) = 1500
     from public.rpc_saidas_listar('{"material_id": "a7100000-0000-0000-0000-000000000003"}', 5, 0)),
  'saidas: filtro por material (historico do sino no Estoque atual)');

select listas_test.ok(
  not exists (select 1 from public.rpc_saidas_listar('{}', 1000, 0) where material_id = 'a7100000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.rpc_saidas_listar('{}', 1000, 1000) where material_id = 'a7100000-0000-0000-0000-0000000000b1'),
  'saidas: tenant A nao enxerga saidas do tenant B');

-- Registrantes e busca de materiais -----------------------------------------------------------------
select listas_test.ok(
  (select string_agg(nome, ',' order by nome) = 'dep_a,operador_a,owner_a' from public.rpc_movimentacao_registrantes('saidas')),
  'registrantes de saidas pelo username');

select listas_test.ok(
  (select count(*) = 1 and min(material->>'materialItemNome') = 'Luva Nitrílica' from public.rpc_materiais_buscar('nitri danny')),
  'busca de material: todas as palavras, sem acento, so do tenant');

select listas_test.ok(
  (select count(*) = 1 from public.rpc_materiais_buscar('12345'))
  and (select count(*) = 1 from public.rpc_materiais_buscar('a7100000-0000-0000-0000-000000000002')),
  'busca de material por CA e por id');

select listas_test.ok(
  (select count(*) = 0 from public.rpc_materiais_buscar('luva', 'ce100000-0000-0000-0000-000000000002'))
  and (select count(*) = 1 from public.rpc_materiais_buscar('luva', 'ce100000-0000-0000-0000-000000000001')),
  'busca de material filtrada pelo centro de estoque das entradas');

-- Acesso ------------------------------------------------------------------------------------------
select listas_test.login('a1000000-0000-0000-0000-000000000003');
select listas_test.erro('select * from public.rpc_saidas_listar()', '42501', 'usuario sem permissao de estoque e bloqueado');

select listas_test.login(null, 'anon');
select listas_test.erro('select * from public.rpc_entradas_listar()', '42501', 'anon nao executa rpc_entradas_listar');

select listas_test.login('a1000000-0000-0000-0000-000000000001');
select listas_test.erro('select * from public._materiais_json_tenant(''b1000000-0000-0000-0000-000000000001''::uuid)',
  '42501', 'funcao interna de materiais nao exposta');

rollback;
