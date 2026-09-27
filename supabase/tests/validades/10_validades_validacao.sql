-- Validacao do Controle de Validades (executar em PostgreSQL local descartavel, apos 00_stub e migrations).
-- Tudo roda dentro de uma transacao e termina em ROLLBACK.
-- Cada verificacao usa `validades_test.ok(...)`; qualquer falha interrompe o script com a mensagem do caso.

\set ON_ERROR_STOP on
begin;

create schema validades_test;
grant usage on schema validades_test to public;

create function validades_test.ok(p_condicao boolean, p_caso text)
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

-- Executa o SQL e exige erro cuja mensagem contenha p_trecho (ou SQLSTATE igual a p_trecho).
create function validades_test.erro(p_sql text, p_trecho text, p_caso text)
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

-- Troca o usuario/role da sessao (claims no mesmo formato do PostgREST).
create function validades_test.login(p_user uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(p_role, ''), true);
  if p_role in ('authenticated', 'service_role') then
    execute format('set local role %I', p_role);
  end if;
end;
$$;

-- Leitura de apoio do proprio teste (as funcoes internas continuam revogadas para authenticated).
create function validades_test.reg(p_id uuid)
returns jsonb
language sql
security definer
as $$
  select public._validades_realizacao_json(p_id);
$$;

grant execute on all functions in schema validades_test to public;

-- ---------------------------------------------------------------------------
-- Dados de teste
-- ---------------------------------------------------------------------------
-- Tenant A: owner/admin A, operador (somente consulta), gestor (requisitos sem regras de validade)
-- Tenant B: owner/admin B

insert into public.app_users (id, username, email, credential, parent_user_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin_a', 'admin_a@teste.local', 'admin', null),
  ('00000000-0000-4000-8000-0000000000a2', 'operador_a', 'operador_a@teste.local', 'operador', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000a3', 'gestor_a', 'gestor_a@teste.local', 'operador', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b1', 'admin_b', 'admin_b@teste.local', 'admin', null);

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 'admin'),
  ('00000000-0000-4000-8000-0000000000a2'::uuid, 'operador'),
  ('00000000-0000-4000-8000-0000000000a3'::uuid, 'operador'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 'admin')
) as u(id, role_name)
join public.roles r on r.name = u.role_name;

insert into public.user_permission_overrides (user_id, permission_key, allowed) values
  ('00000000-0000-4000-8000-0000000000a2', 'pcsmo.controle_validades', true),
  ('00000000-0000-4000-8000-0000000000a3', 'pcsmo.requisitos_controle', true),
  ('00000000-0000-4000-8000-0000000000a3', 'pcsmo.controle_validades', true);

insert into public.cargos (id, nome, account_owner_id) values
  ('00000000-0000-4000-8000-00000000c001', 'Eletricista', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000c002', 'Almoxarife', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000c0b1', 'Eletricista B', '00000000-0000-4000-8000-0000000000b1');

insert into public.centros_custo (id, nome, account_owner_id) values
  ('00000000-0000-4000-8000-00000000cc01', 'CC Operacao', '00000000-0000-4000-8000-0000000000a1');

insert into public.centros_servico (id, nome, centro_custo_id, account_owner_id) values
  ('00000000-0000-4000-8000-00000000c501', 'Unidade Norte', '00000000-0000-4000-8000-00000000cc01', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000c502', 'Unidade Sul', '00000000-0000-4000-8000-00000000cc01', '00000000-0000-4000-8000-0000000000a1');

insert into public.setores (id, nome, centro_servico_id, account_owner_id) values
  ('00000000-0000-4000-8000-00000000a501', 'Manutencao', '00000000-0000-4000-8000-00000000c501', '00000000-0000-4000-8000-0000000000a1');

insert into public.pessoas (id, nome, matricula, cargo_id, setor_id, centro_servico_id, centro_custo_id, ativo, "dataDemissao", account_owner_id) values
  ('00000000-0000-4000-8000-0000000e0001', 'Joao', 'M001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a501', '00000000-0000-4000-8000-00000000c501', '00000000-0000-4000-8000-00000000cc01', true, null, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e0002', 'Maria', 'M002', '00000000-0000-4000-8000-00000000c001', null, '00000000-0000-4000-8000-00000000c502', '00000000-0000-4000-8000-00000000cc01', true, null, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e0003', 'Pedro', 'M003', '00000000-0000-4000-8000-00000000c001', null, '00000000-0000-4000-8000-00000000c502', '00000000-0000-4000-8000-00000000cc01', true, null, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e0004', 'Ana', 'M004', '00000000-0000-4000-8000-00000000c002', null, '00000000-0000-4000-8000-00000000c502', '00000000-0000-4000-8000-00000000cc01', true, null, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e0005', 'Inativo', 'M005', '00000000-0000-4000-8000-00000000c001', null, '00000000-0000-4000-8000-00000000c501', '00000000-0000-4000-8000-00000000cc01', false, null, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e0006', 'Desligado', 'M006', '00000000-0000-4000-8000-00000000c001', null, '00000000-0000-4000-8000-00000000c501', '00000000-0000-4000-8000-00000000cc01', true, now() - interval '2 days', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000e00b1', 'Carlos B', 'B001', '00000000-0000-4000-8000-00000000c0b1', null, null, null, true, null, '00000000-0000-4000-8000-0000000000b1');

create table validades_test.ctx (chave text primary key, valor text);
grant all on validades_test.ctx to public;

-- ---------------------------------------------------------------------------
-- 1. Regras puras: vencimento e status
-- ---------------------------------------------------------------------------

select validades_test.ok(
  public.validade_calcular_vencimento('2024-01-10', true, 24, 'meses') = date '2026-01-09',
  'vencimento em meses = data + N meses - 1 dia (10/01/2024 + 24m -> 09/01/2026)'
);
select validades_test.ok(
  public.validade_calcular_vencimento('2026-03-01', true, 30, 'dias') = date '2026-03-30',
  'vencimento em dias = data + N - 1 (01/03 + 30d -> 30/03)'
);
select validades_test.ok(
  public.validade_calcular_vencimento('2026-03-01', false, null, null) is null,
  'requisito sem validade nao tem vencimento'
);
select validades_test.ok(public.validade_status(true, true, 8, 7) = 'valido', 'status: 8 dias com janela 7 -> valido');
select validades_test.ok(public.validade_status(true, true, 7, 7) = 'proximo_vencimento', 'status: 7 dias -> proximo_vencimento');
select validades_test.ok(public.validade_status(true, true, 1, 7) = 'proximo_vencimento', 'status: 1 dia -> proximo_vencimento');
select validades_test.ok(public.validade_status(true, true, 0, 7) = 'vence_hoje', 'status: 0 dias -> vence_hoje');
select validades_test.ok(public.validade_status(true, true, -1, 7) = 'vencido', 'status: -1 dia -> vencido');
select validades_test.ok(public.validade_status(false, true, null, 7) = 'pendente', 'status: sem registro -> pendente');
select validades_test.ok(public.validade_status(true, false, null, 7) = 'sem_validade', 'status: sem validade');
select validades_test.ok(public.validade_status(false, true, null, 7, true) = 'dispensado', 'status: dispensado tem prioridade');

-- ---------------------------------------------------------------------------
-- 2. Cadastro de requisitos e regras (admin A)
-- ---------------------------------------------------------------------------

select validades_test.login('00000000-0000-4000-8000-0000000000a1');

insert into validades_test.ctx (chave, valor)
select 'nr10', (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null,
  '{"nome":"NR-10","codigo":"NR10","categoria":"treinamento","tipo":"legal","possui_validade":true,"validade_quantidade":24,"validade_unidade":"meses"}'::jsonb))->>'id';
insert into validades_test.ctx (chave, valor)
select 'nr35', (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null,
  '{"nome":"NR-35","codigo":"NR35","categoria":"treinamento","tipo":"legal","possui_validade":true,"validade_quantidade":24,"validade_unidade":"meses"}'::jsonb))->>'id';
insert into validades_test.ctx (chave, valor)
select 'integracao', (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null,
  '{"nome":"Integracao","categoria":"treinamento","tipo":"interno","possui_validade":false}'::jsonb))->>'id';
insert into validades_test.ctx (chave, valor)
select 't30', (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null,
  '{"nome":"Teste 30 dias","codigo":"T30","categoria":"documento","tipo":"interno","possui_validade":true,"validade_quantidade":30,"validade_unidade":"dias"}'::jsonb))->>'id';
insert into validades_test.ctx (chave, valor)
select 'cipa', (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null,
  '{"nome":"CIPA","categoria":"capacitacao","tipo":"legal","possui_validade":true,"validade_quantidade":12,"validade_unidade":"meses"}'::jsonb))->>'id';

select validades_test.erro(
  $$select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null, '{"nome":"nr-10","possui_validade":true,"validade_quantidade":12,"validade_unidade":"meses"}'::jsonb)$$,
  'Ja existe um requisito',
  'nome de requisito unico por tenant (sem diferenciar maiusculas)'
);
select validades_test.erro(
  $$select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null, '{"nome":"Sem unidade","possui_validade":true,"validade_quantidade":12}'::jsonb)$$,
  'unidade da validade',
  'validade exige unidade'
);

-- NR-10, NR-35 e Teste 30 dias para o cargo Eletricista; Integracao para a Unidade Norte; NR-35 individual para Ana.
select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'), '{"cargo_id":"00000000-0000-4000-8000-00000000c001"}'::jsonb);
select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr35'), '{"cargo_id":"00000000-0000-4000-8000-00000000c001"}'::jsonb);
select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 't30'), '{"cargo_id":"00000000-0000-4000-8000-00000000c001"}'::jsonb);
select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'integracao'), '{"centro_servico_id":"00000000-0000-4000-8000-00000000c501"}'::jsonb);
select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr35'), '{"pessoa_id":"00000000-0000-4000-8000-0000000e0004"}'::jsonb);

select validades_test.erro(
  $$select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'), '{"cargo_id":"00000000-0000-4000-8000-00000000c001"}'::jsonb)$$,
  'regra ja existe',
  'regra duplicada bloqueada'
);
select validades_test.erro(
  $$select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'), '{"cargo_id":"00000000-0000-4000-8000-00000000c0b1"}'::jsonb)$$,
  'Cargo nao pertence ao tenant',
  'regra com cargo de outro tenant bloqueada'
);
select validades_test.erro(
  $$select public.rpc_requisito_regra_adicionar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'), '{}'::jsonb)$$,
  'ao menos um criterio',
  'regra sem criterio bloqueada'
);

select validades_test.ok(
  ((public.rpc_requisito_previa('00000000-0000-4000-8000-0000000000a1', '{"cargo_id":"00000000-0000-4000-8000-00000000c001"}'::jsonb))->>'pessoas')::int = 3,
  'previa de afetados conta so colaboradores ativos (Joao, Maria, Pedro)'
);

-- ---------------------------------------------------------------------------
-- 3. Requisito esperado sem registro = pendente
-- ---------------------------------------------------------------------------

do $$
declare
  v_lista jsonb := public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb);
  v_itens jsonb := v_lista->'itens';
begin
  -- 3 eletricistas ativos x (NR-10, NR-35, T30) + Integracao (Joao, Unidade Norte) + NR-35 individual (Ana)
  perform validades_test.ok((v_lista->>'total')::int = 11, 'lista inicial com 11 pares exigidos (todos pendentes)');
  perform validades_test.ok(
    not exists (select 1 from jsonb_array_elements(v_itens) i where i->>'status' <> 'pendente'),
    'sem realizacao -> todos pendentes'
  );
  perform validades_test.ok(
    not exists (select 1 from jsonb_array_elements(v_itens) i where i->>'pessoa_nome' in ('Inativo', 'Desligado')),
    'colaborador inativo ou desligado nao entra no controle'
  );
  perform validades_test.ok(
    exists (
      select 1 from jsonb_array_elements(v_itens) i
      where i->>'pessoa_nome' = 'Ana' and i->>'requisito_nome' = 'NR-35' and (i->'origens') ? 'Individual'
    ),
    'regra individual aparece como origem Individual'
  );
  perform validades_test.ok(
    jsonb_array_length(public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb, 5, 5)->'itens') = 5
    and jsonb_array_length(public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb, 5, 10)->'itens') = 1
    and (public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb, 5, 10)->>'total')::int = 11,
    'lista paginada no servidor (limite/offset) mantem o total'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Registro, snapshot e alteracao de validade
-- ---------------------------------------------------------------------------

insert into validades_test.ctx (chave, valor)
select 'joao_nr10_1', ((public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
  'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
  'data_realizacao', '2025-01-10',
  'numero_documento', 'CERT-1'
)))->'realizacao')->>'id';

do $$
declare
  v_reg jsonb;
begin
  select validades_test.reg((select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1')) into v_reg;
  perform validades_test.ok(v_reg->>'status_registro' = 'vigente', 'primeiro registro fica vigente');
  perform validades_test.ok((v_reg->>'validade_quantidade')::int = 24 and v_reg->>'validade_unidade' = 'meses', 'snapshot 24 meses gravado');
  perform validades_test.ok((v_reg->>'data_vencimento')::date = date '2027-01-09', 'vencimento calculado no banco (10/01/2025 -> 09/01/2027)');
end;
$$;

select validades_test.erro(
  $$select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'),
    '{"nome":"NR-10","codigo":"NR10","categoria":"treinamento","tipo":"legal","possui_validade":true,"validade_quantidade":12,"validade_unidade":"meses"}'::jsonb, null)$$,
  'motivo',
  'alterar validade exige motivo'
);

select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'nr10'),
  '{"nome":"NR-10","codigo":"NR10","categoria":"treinamento","tipo":"legal","possui_validade":true,"validade_quantidade":12,"validade_unidade":"meses"}'::jsonb,
  'Politica interna passou a exigir reciclagem anual');

do $$
declare
  v_reg jsonb;
  v_nova jsonb;
begin
  select validades_test.reg((select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1')) into v_reg;
  perform validades_test.ok((v_reg->>'validade_quantidade')::int = 24, 'mudanca de validade NAO altera snapshot do registro antigo');
  perform validades_test.ok((v_reg->>'data_vencimento')::date = date '2027-01-09', 'vencimento antigo preservado apos mudanca de regra');

  v_nova := public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0002',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', '2025-06-01'
  ))->'realizacao';
  perform validades_test.ok((v_nova->>'validade_quantidade')::int = 12, 'novo registro usa a validade vigente (12 meses)');
  perform validades_test.ok((v_nova->>'data_vencimento')::date = date '2026-05-31', 'novo vencimento 01/06/2025 + 12m - 1');

  perform validades_test.ok(exists (
    select 1 from public.requisitos_historico h
    where h.requisito_id = (select valor::uuid from validades_test.ctx where chave = 'nr10')
      and h.acao = 'validade_alterada'
      and h.motivo = 'Politica interna passou a exigir reciclagem anual'
  ), 'historico registra validade_alterada com motivo');
end;
$$;

select validades_test.erro(
  $$update public.requisitos_realizacoes set validade_quantidade_snapshot = 99 where id = (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1')$$,
  'permission denied',
  'authenticated nao pode alterar tabela diretamente'
);

-- ---------------------------------------------------------------------------
-- 5. Renovacao, registro retroativo e cancelamento
-- ---------------------------------------------------------------------------

select validades_test.erro(
  $$select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', '2025-09-01'))$$,
  'Use Renovar',
  'registrar data posterior a vigente orienta renovar'
);
select validades_test.erro(
  $$select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', (now() + interval '10 days')::date))$$,
  'futura',
  'data futura bloqueada'
);

insert into validades_test.ctx (chave, valor)
select 'joao_nr10_2', ((public.rpc_validades_renovar('00000000-0000-4000-8000-0000000000a1',
  (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1'),
  '{"data_realizacao":"2025-09-01","numero_documento":"CERT-2"}'::jsonb))->'realizacao')->>'id';

do $$
declare
  v_ant jsonb := validades_test.reg((select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1'));
  v_nov jsonb := validades_test.reg((select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'));
begin
  perform validades_test.ok(v_ant->>'status_registro' = 'substituido', 'renovacao preserva registro anterior como substituido');
  perform validades_test.ok(v_nov->>'status_registro' = 'vigente', 'renovacao cria novo registro vigente');
  perform validades_test.ok(v_nov->>'renovacao_de_id' = v_ant->>'id', 'novo registro aponta para o anterior');
  perform validades_test.ok((v_nov->>'validade_quantidade')::int = 12, 'renovacao usa a validade vigente no momento');
end;
$$;

select validades_test.erro(
  $$select public.rpc_validades_renovar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_1'), '{"data_realizacao":"2025-10-01"}'::jsonb)$$,
  'Somente a realizacao vigente',
  'nao renova registro substituido'
);
select validades_test.erro(
  $$select public.rpc_validades_renovar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'), '{"data_realizacao":"2025-08-01"}'::jsonb)$$,
  'posterior',
  'renovacao com data anterior bloqueada'
);

-- Registro retroativo (certificado antigo encontrado depois): vira historico e nao altera o vigente.
select validades_test.ok(
  (public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', '2023-03-10'
  ))->>'retroativo')::boolean,
  'data anterior a vigente e gravada como historico retroativo'
);
select validades_test.ok(
  (select count(*) from public.requisitos_realizacoes
   where pessoa_id = '00000000-0000-4000-8000-0000000e0001'
     and requisito_id = (select valor::uuid from validades_test.ctx where chave = 'nr10')
     and status_registro = 'vigente') = 1,
  'continua existindo exatamente uma realizacao vigente'
);

-- Editar a vigente para data anterior ao historico e bloqueado.
select validades_test.erro(
  $$select public.rpc_validades_editar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'), '{"data_realizacao":"2024-12-01"}'::jsonb, 'Correcao de digitacao')$$,
  'posterior aos registros anteriores',
  'edicao mantem a vigente como a mais recente'
);

select public.rpc_validades_editar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'),
  '{"data_realizacao":"2025-09-02","numero_documento":"CERT-2A"}'::jsonb, 'Correcao de digitacao');
select validades_test.ok(
  (validades_test.reg((select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'))->>'data_vencimento')::date = date '2026-09-01',
  'edicao recalcula vencimento com o snapshot do proprio registro'
);

-- Cancelar a vigente devolve a vigencia ao registro anterior mais recente.
do $$
declare
  v_res jsonb := public.rpc_validades_cancelar('00000000-0000-4000-8000-0000000000a1',
    (select valor::uuid from validades_test.ctx where chave = 'joao_nr10_2'), 'Lancado no colaborador errado');
begin
  perform validades_test.ok(v_res->'cancelado'->>'status_registro' = 'cancelado', 'cancelamento marca registro como cancelado');
  perform validades_test.ok(v_res->'reativado'->>'id' = (select valor from validades_test.ctx where chave = 'joao_nr10_1'),
    'registro anterior volta a ser vigente');
end;
$$;

do $$
declare
  v_hist jsonb := public.rpc_validades_historico('00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000e0001', (select valor::uuid from validades_test.ctx where chave = 'nr10'));
begin
  perform validades_test.ok(jsonb_array_length(v_hist->'registros') = 3, 'historico mostra os 3 registros (nenhum apagado)');
  perform validades_test.ok(
    (select count(*) from jsonb_array_elements(v_hist->'eventos') e
     where e->>'acao' in ('registro', 'renovacao', 'substituicao', 'retroativo', 'edicao', 'cancelamento', 'reativacao')) = 7,
    'historico registra registro, renovacao, substituicao, retroativo, edicao, cancelamento e reativacao'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dispensa e registros nao exigidos
-- ---------------------------------------------------------------------------

insert into validades_test.ctx (chave, valor)
select 'disp_pedro', (public.rpc_validades_dispensar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0003',
  'requisito_id', (select valor from validades_test.ctx where chave = 'nr35'),
  'motivo', 'Atua somente em bancada, sem trabalho em altura'
)))->>'id';

select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0004',
  'requisito_id', (select valor from validades_test.ctx where chave = 'cipa'),
  'data_realizacao', '2025-11-01'
));

do $$
declare
  v_padrao jsonb := public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb);
  v_todos jsonb := public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{"exigencia":"todos"}'::jsonb);
  v_resumo jsonb := public.rpc_validades_resumo('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb);
  v_cards jsonb := v_resumo->'cards';
begin
  perform validades_test.ok(
    not exists (select 1 from jsonb_array_elements(v_padrao->'itens') i where i->>'pessoa_nome' = 'Pedro' and i->>'requisito_nome' = 'NR-35'),
    'dispensado sai da lista padrao (exigidos)'
  );
  perform validades_test.ok(
    exists (select 1 from jsonb_array_elements(v_todos->'itens') i
            where i->>'pessoa_nome' = 'Pedro' and i->>'requisito_nome' = 'NR-35' and i->>'status' = 'dispensado'),
    'dispensado aparece com status dispensado no filtro todos'
  );
  perform validades_test.ok(
    exists (select 1 from jsonb_array_elements(v_todos->'itens') i
            where i->>'pessoa_nome' = 'Ana' and i->>'requisito_nome' = 'CIPA' and i->>'exigencia' = 'nao_exigido'),
    'registro sem exigencia atual aparece como nao_exigido'
  );
  perform validades_test.ok(
    (v_cards->>'monitorados')::int =
      (v_cards->>'validos')::int + (v_cards->>'proximos')::int + (v_cards->>'vence_hoje')::int
      + (v_cards->>'vencidos')::int + (v_cards->>'pendentes')::int,
    'cards: monitorados = validos + proximos + vence hoje + vencidos + pendentes'
  );
  perform validades_test.ok((v_resumo->'extras'->>'dispensados')::int = 1, 'painel informa 1 dispensado');
  perform validades_test.ok((v_resumo->'extras'->>'nao_exigidos')::int = 1, 'painel informa 1 nao exigido');
end;
$$;

select public.rpc_validades_dispensa_revogar('00000000-0000-4000-8000-0000000000a1',
  (select valor::uuid from validades_test.ctx where chave = 'disp_pedro'), 'Passou a atuar em campo');
select validades_test.ok(
  exists (select 1 from jsonb_array_elements(public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{"termo":"Pedro"}'::jsonb)->'itens') i
          where i->>'requisito_nome' = 'NR-35' and i->>'status' = 'pendente'),
  'revogar dispensa devolve o requisito como pendente'
);

-- ---------------------------------------------------------------------------
-- 7. Isolamento entre tenants
-- ---------------------------------------------------------------------------

select validades_test.login('00000000-0000-4000-8000-0000000000b1');

select validades_test.erro(
  $$select public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb)$$,
  'Acesso negado ao owner',
  'tenant B nao lista dados do tenant A'
);
select validades_test.erro(
  $$select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000b1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', '2025-01-10'))$$,
  'Colaborador nao encontrado',
  'tenant B nao registra para colaborador do tenant A'
);
select validades_test.ok((select count(*) from public.requisitos_controle) = 0, 'RLS: tenant B nao enxerga requisitos do tenant A');
select validades_test.ok((select count(*) from public.requisitos_realizacoes) = 0, 'RLS: tenant B nao enxerga realizacoes do tenant A');
select validades_test.ok(
  (public.rpc_validades_lista('00000000-0000-4000-8000-0000000000b1', '{}'::jsonb)->>'total')::int = 0,
  'tenant B tem lista propria vazia'
);
select validades_test.erro(
  $$insert into public.requisitos_controle (account_owner_id, nome) values ('00000000-0000-4000-8000-0000000000b1', 'Direto')$$,
  'permission denied',
  'insert direto em tabela bloqueado para authenticated'
);
select validades_test.erro(
  $$select * from public.requisitos_alertas_envios$$,
  'permission denied',
  'tabela de alertas inacessivel para authenticated'
);
select validades_test.erro(
  $$select public._validades_base('00000000-0000-4000-8000-0000000000b1')$$,
  'permission denied',
  'funcao interna _validades_base inacessivel para authenticated'
);
select validades_test.erro(
  $$select public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000b1')$$,
  'permission denied',
  'reserva de alertas inacessivel para authenticated'
);

-- ---------------------------------------------------------------------------
-- 8. Permissoes
-- ---------------------------------------------------------------------------

select validades_test.login('00000000-0000-4000-8000-0000000000a2');

select validades_test.ok(
  (public.rpc_validades_lista('00000000-0000-4000-8000-0000000000a1', '{}'::jsonb)->>'total')::int > 0,
  'operador com pcsmo.controle_validades consulta a lista'
);
select validades_test.ok(
  not (public.rpc_validades_contexto('00000000-0000-4000-8000-0000000000a1')->>'pode_registrar')::boolean,
  'contexto informa que operador de consulta nao registra'
);
select validades_test.erro(
  $$select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
    'pessoa_id', '00000000-0000-4000-8000-0000000e0003',
    'requisito_id', (select valor from validades_test.ctx where chave = 'nr10'),
    'data_realizacao', '2025-01-10'))$$,
  '42501',
  'operador de consulta nao registra'
);
select validades_test.erro(
  $$select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', null, '{"nome":"Novo","possui_validade":false}'::jsonb)$$,
  '42501',
  'operador de consulta nao cria requisito'
);

select validades_test.login('00000000-0000-4000-8000-0000000000a3');

select validades_test.ok(
  (public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'cipa'),
    '{"nome":"CIPA - Membros","categoria":"capacitacao","tipo":"legal","possui_validade":true,"validade_quantidade":12,"validade_unidade":"meses"}'::jsonb))->>'nome'
    = 'CIPA - Membros',
  'gestor de requisitos altera dados sem mexer na validade'
);
select validades_test.erro(
  $$select public.rpc_requisito_salvar('00000000-0000-4000-8000-0000000000a1', (select valor::uuid from validades_test.ctx where chave = 'cipa'),
    '{"nome":"CIPA - Membros","categoria":"capacitacao","tipo":"legal","possui_validade":true,"validade_quantidade":24,"validade_unidade":"meses"}'::jsonb, 'Mudanca de regra')$$,
  'alterar a validade',
  'gestor sem validades.regras.manage nao altera validade'
);
select validades_test.erro(
  $$select public.rpc_requisitos_config_update('00000000-0000-4000-8000-0000000000a1', '{"janela_critica_dias":10}'::jsonb, 'Teste')$$,
  '42501',
  'gestor sem validades.regras.manage nao altera configuracao'
);

-- ---------------------------------------------------------------------------
-- 9. Alertas: marcos, consolidacao e idempotencia (service_role)
-- ---------------------------------------------------------------------------

select validades_test.login(null, 'service_role');

-- Datas relativas ao "hoje" do tenant usando o requisito de 30 dias (vencimento = data + 29).
insert into validades_test.ctx (chave, valor)
values ('hoje', public.validades_hoje('00000000-0000-4000-8000-0000000000a1')::text);

-- Joao: vence em 5 dias (janela); Maria: vence hoje; Pedro: venceu ha 3 dias (tolerancia 7).
select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
  'requisito_id', (select valor from validades_test.ctx where chave = 't30'),
  'data_realizacao', ((select valor::date from validades_test.ctx where chave = 'hoje') + 5 - 29)));
select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0002',
  'requisito_id', (select valor from validades_test.ctx where chave = 't30'),
  'data_realizacao', ((select valor::date from validades_test.ctx where chave = 'hoje') - 29)));
select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0003',
  'requisito_id', (select valor from validades_test.ctx where chave = 't30'),
  'data_realizacao', ((select valor::date from validades_test.ctx where chave = 'hoje') - 3 - 29)));

do $$
declare
  v_lote1 jsonb;
  v_lote2 jsonb;
  v_ids uuid[];
begin
  v_lote1 := public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000a1');
  perform validades_test.ok(jsonb_array_length(v_lote1) = 3, 'primeira execucao reserva 3 eventos (janela, vence hoje, vencido recente)');
  perform validades_test.ok(
    (select count(*) from jsonb_array_elements(v_lote1) e where e->>'tipo_alerta' = 'janela_critica') = 1
    and (select count(*) from jsonb_array_elements(v_lote1) e where e->>'tipo_alerta' = 'vencimento') = 2,
    'eventos separados em janela_critica e vencimento'
  );
  perform validades_test.ok(
    not exists (select 1 from jsonb_array_elements(v_lote1) e where e->>'requisito_nome' <> 'Teste 30 dias'),
    'pendentes nao geram alerta'
  );

  v_lote2 := public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000a1');
  perform validades_test.ok(jsonb_array_length(v_lote2) = 0, 'segunda execucao no mesmo dia nao repete eventos');

  select array_agg((e->>'envio_id')::uuid) into v_ids from jsonb_array_elements(v_lote1) e;
  perform public.rpc_validades_alertas_finalizar('00000000-0000-4000-8000-0000000000a1', v_ids, false, 'Brevo indisponivel');
  perform validades_test.ok(
    jsonb_array_length(public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000a1')) = 3,
    'eventos com erro voltam na proxima execucao (retentativa)'
  );
  perform public.rpc_validades_alertas_finalizar('00000000-0000-4000-8000-0000000000a1', v_ids, true, null, null, 2);
  perform validades_test.ok(
    jsonb_array_length(public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000a1')) = 0,
    'eventos enviados nao sao reenviados'
  );
  perform validades_test.ok(
    (select count(*) from public.requisitos_alertas_envios where status = 'enviado' and tentativas = 2) = 3,
    'tentativas contabilizadas por evento'
  );
end;
$$;

-- Nova renovacao = novo ciclo de alertas (novo registro com vencimento na janela).
select public.rpc_validades_renovar('00000000-0000-4000-8000-0000000000a1',
  (select id from public.requisitos_realizacoes
   where pessoa_id = '00000000-0000-4000-8000-0000000e0002'
     and requisito_id = (select valor::uuid from validades_test.ctx where chave = 't30')
     and status_registro = 'vigente'),
  jsonb_build_object('data_realizacao', ((select valor::date from validades_test.ctx where chave = 'hoje') + 2 - 29)));

select validades_test.ok(
  (select count(*) from jsonb_array_elements(public.rpc_validades_alertas_reservar('00000000-0000-4000-8000-0000000000a1')) e
   where e->>'pessoa_nome' = 'Maria' and e->>'tipo_alerta' = 'janela_critica') = 1,
  'renovacao gera novo ciclo de alerta para o novo registro'
);

-- Vencido alem da tolerancia (7 dias) nao gera alerta.
select validades_test.login(null, 'postgres');
insert into public.pessoas (id, nome, matricula, cargo_id, centro_servico_id, ativo, account_owner_id) values
  ('00000000-0000-4000-8000-0000000e0007', 'Lucas', 'M007', '00000000-0000-4000-8000-00000000c001',
   '00000000-0000-4000-8000-00000000c502', true, '00000000-0000-4000-8000-0000000000a1');
select validades_test.login(null, 'service_role');
select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0007',
  'requisito_id', (select valor from validades_test.ctx where chave = 't30'),
  'data_realizacao', ((select valor::date from validades_test.ctx where chave = 'hoje') - 10 - 29)));
select validades_test.ok(
  not exists (select 1 from public._validades_alertas_candidatos('00000000-0000-4000-8000-0000000000a1') c where c.pessoa_nome = 'Lucas'),
  'vencido ha 10 dias (alem da tolerancia de 7) nao gera alerta'
);

-- Requisito sem validade e alertas desligados nao geram eventos.
select public.rpc_validades_registrar('00000000-0000-4000-8000-0000000000a1', jsonb_build_object(
  'pessoa_id', '00000000-0000-4000-8000-0000000e0001',
  'requisito_id', (select valor from validades_test.ctx where chave = 'integracao'),
  'data_realizacao', '2024-01-01'));
select validades_test.ok(
  not exists (select 1 from public._validades_alertas_candidatos('00000000-0000-4000-8000-0000000000a1') c where c.requisito_nome = 'Integracao'),
  'requisito sem validade nao gera alerta'
);

select validades_test.login('00000000-0000-4000-8000-0000000000a1');
select public.rpc_requisitos_config_update('00000000-0000-4000-8000-0000000000a1', '{"alertas_ativos":false}'::jsonb, 'Pausa temporaria dos alertas');
select validades_test.login(null, 'service_role');
select validades_test.ok(
  not exists (select 1 from public._validades_alertas_candidatos('00000000-0000-4000-8000-0000000000a1')),
  'alertas desativados no tenant nao geram eventos'
);

-- ---------------------------------------------------------------------------
-- 10. Datas e timezone do tenant
-- ---------------------------------------------------------------------------

select validades_test.login('00000000-0000-4000-8000-0000000000a1');
select validades_test.erro(
  $$select public.rpc_requisitos_config_update('00000000-0000-4000-8000-0000000000a1', '{"timezone":"Marte/Base"}'::jsonb, 'Teste timezone')$$,
  'Timezone invalido',
  'timezone invalido rejeitado'
);
select public.rpc_requisitos_config_update('00000000-0000-4000-8000-0000000000a1', '{"timezone":"Pacific/Kiritimati","janela_critica_dias":10}'::jsonb, 'Teste timezone');
select validades_test.login(null, 'service_role');
select validades_test.ok(
  public.validades_hoje('00000000-0000-4000-8000-0000000000a1') = (now() at time zone 'Pacific/Kiritimati')::date,
  'hoje do tenant respeita o timezone configurado'
);
select validades_test.ok(
  public.validades_hoje('00000000-0000-4000-8000-0000000000b1') = (now() at time zone 'America/Sao_Paulo')::date,
  'tenant sem configuracao usa America/Sao_Paulo'
);
select validades_test.ok(
  (select bool_and(b.janela = 10) from public._validades_base('00000000-0000-4000-8000-0000000000a1') b),
  'janela critica configurada e aplicada pela base'
);

select validades_test.ok(
  (select count(*) from public.requisitos_historico where entidade = 'config' and acao = 'config_alterada') = 2,
  'alteracoes de configuracao auditadas'
);

\echo '=== Controle de Validades: todas as verificacoes passaram ==='
rollback;
