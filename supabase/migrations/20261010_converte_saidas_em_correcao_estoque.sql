-- Converte em correcao de estoque fisico as 38 saidas lancadas pela tela de Saida para corrigir o
-- estoque do ALMOX - SEGURANCA DO TRABALHO entre 28/09 e 02/10/2026 (arquivo saidas-2026-10-03.csv,
-- 92 unidades, 28 posicoes material x centro).
-- Depende de: 20260930_stock_physical_corrections.sql.
--
-- Antes: as baixas aparecem como entregas de EPI para colaboradores e contam como consumo
-- (historico da pessoa, troca, previsao). Excluir as saidas devolveria as 92 unidades ao saldo.
-- Depois, para cada saida, na mesma transacao:
--   - a saida fica CANCELADA (mesmo status do cancelamento pelo app) com registro em saidas_historico;
--   - entra uma correcao APROVADA com -quantidade: solicitante e aprovador = titular da conta,
--     saldo do sistema e quantidade fisica calculados na conversao, saida de origem nas observacoes;
--   - o ajuste (stock_adjustments) fica com a data da entrega original, para o saldo por periodo
--     continuar igual.
-- O saldo de cada material x centro nao muda; a conversao confere isso saida a saida.
--
-- Diagnostico previo: supabase/auditoria/diagnostico_saidas_correcao_2026-10-03.sql (2026-10-04:
-- 38 saidas encontradas e ativas, nenhuma correcao pendente ou posterior, nenhuma troca dependente).
--
-- Seguranca para rodar de novo ou em outro banco:
--   - nenhuma das saidas existe (banco local ou outro projeto): so avisa e nao altera nada;
--   - todas ja convertidas: so avisa;
--   - qualquer divergencia (saida faltando, ja cancelada, quantidade diferente, mais de um tenant,
--     sem centro, correcao pendente): erro e nada e gravado.

do $$
declare
  v_esperadas constant int := 38;
  v_encontradas int;
  v_convertidas int;
  v_owners int;
  v_owner uuid;
  v_cancelado_id uuid;
  v_cancelado_nome text;
  v_motivo constant text :=
    'Saida lancada pela tela de Saida para corrigir o estoque; convertida em correcao de estoque fisico.';
  v_divergencias text;
  v_saida record;
  v_status_antigo text;
  v_saldo_antes numeric;
  v_saldo_sistema numeric;
  v_saldo_depois numeric;
  v_request_id uuid;
  v_anterior jsonb;
  v_atual jsonb;
  v_total_qtd numeric := 0;
  v_total_saidas int := 0;
begin
  drop table if exists pg_temp.conv_saidas;
  create temporary table conv_saidas (id uuid primary key, quantidade numeric not null) on commit drop;
  insert into conv_saidas (id, quantidade) values
    ('13096112-989a-4b17-a5be-48600287954e', 1),
    ('e8d92304-8115-4de1-bb53-b8cac16ea940', 1),
    ('59de0694-a943-4199-9468-15367bff3a45', 1),
    ('1159e6bf-fb57-4ead-a4af-486d759b394c', 1),
    ('a005da66-2ff4-43c8-9b38-a025ed9950e8', 1),
    ('1ec9362a-d810-4120-b3a8-c48fab75fbf1', 1),
    ('4382fc3b-b3be-4969-9df9-564f4eefb275', 1),
    ('1d77d1d4-1fb8-47fa-869b-e16845b6fc31', 1),
    ('69d966a0-77a2-41a6-ba89-394941b5e57a', 1),
    ('f2878b76-e339-4d56-9ab3-bd2c9d32e2d2', 1),
    ('bd612c3a-3685-466d-a841-93627a965a60', 1),
    ('2d6d8df8-22af-429e-9c44-28160e674283', 1),
    ('72d62b61-e2e1-4e91-a07c-0c0e2c1f2a2e', 6),
    ('f2d1e095-d00e-4a5d-91b8-9d81e9cd4d52', 2),
    ('82aeb7e3-7e17-4962-bfa3-03fc390fa288', 3),
    ('5947664d-179f-480a-8c62-91963343d303', 2),
    ('6ea1ae03-2d03-44bb-bc3e-a88225e927aa', 1),
    ('1d890b8b-213c-4244-9f63-416fcf380fb8', 11),
    ('d9e4ee32-fc4c-444d-ab65-b4a03cb68a15', 1),
    ('1dc9ed26-e032-4738-99a9-d18b089e0b9c', 10),
    ('c86adae6-624c-4dc2-af81-ee11038a550f', 1),
    ('747e2bb6-406b-497f-93e6-75aee36ff378', 1),
    ('3077806f-8e11-4e1d-b568-7bebd9ca3db7', 1),
    ('42b138d5-e287-463d-8471-1e7cb0b08114', 1),
    ('c70bab72-93a8-4d9d-8a38-23fe69669fc9', 1),
    ('b3cfdb0e-0e64-4a0b-bfcf-dd8af03b35b4', 3),
    ('9c8a362d-8e69-403b-b23f-ef43e7e72dec', 9),
    ('da39d506-d9b0-407b-937e-08141a185706', 6),
    ('bc965fa3-f66c-4230-b2d8-262eb37d01ba', 1),
    ('ab0d3248-0ee6-4c68-a83b-03a95f9b7ab3', 1),
    ('3842bb23-b012-4484-88d4-71ef3d96c3b7', 5),
    ('09d12e27-fe40-4883-a6ac-df4c4cac9fa5', 1),
    ('482b30bf-a16c-4a85-b59e-d4bf0ecc339a', 1),
    ('9fd869df-f422-4f71-b449-45f8c130ded0', 1),
    ('668657ac-7571-4389-a977-09ae106ac75b', 1),
    ('80df708f-8630-4c00-9cc4-e36a25643793', 6),
    ('1ff046ec-7139-4bed-aeb3-5618e790893d', 3),
    ('790ab4bd-0af5-46fe-8b7c-fc5fbe235fc2', 1);

  select count(*) into v_encontradas
    from conv_saidas c
    join public.saidas s on s.id = c.id;

  if v_encontradas = 0 then
    raise notice 'Conversao de saidas em correcao: nenhuma das % saidas existe neste banco. Nada alterado.', v_esperadas;
    return;
  end if;

  select count(*) into v_convertidas
    from conv_saidas c
   where exists (select 1 from public.stock_correction_requests r
                  where r.notes like 'Convertida da saida ' || c.id::text || '%');

  if v_convertidas = v_esperadas then
    raise notice 'Conversao de saidas em correcao: as % saidas ja foram convertidas. Nada alterado.', v_esperadas;
    return;
  end if;

  select s.id, s.status into v_cancelado_id, v_cancelado_nome
    from public.status_saida s
   where lower(s.status) = 'cancelado'
   limit 1;
  if v_cancelado_id is null then
    raise exception 'Status de saida CANCELADO nao encontrado.';
  end if;

  select string_agg(d.problema, '; ' order by d.problema) into v_divergencias
    from (
      select format('saida %s nao encontrada', c.id) as problema
        from conv_saidas c
       where not exists (select 1 from public.saidas s where s.id = c.id)
      union all
      select format('saida %s ja cancelada', s.id)
        from conv_saidas c
        join public.saidas s on s.id = c.id
        left join public.status_saida st on st.id = s.status
       where lower(coalesce(st.status, '')) = 'cancelado'
      union all
      select format('saida %s com quantidade %s (esperado %s)', s.id, s.quantidade, c.quantidade)
        from conv_saidas c
        join public.saidas s on s.id = c.id
       where s.quantidade <> c.quantidade
      union all
      select format('saida %s sem centro de estoque', s.id)
        from conv_saidas c
        join public.saidas s on s.id = c.id
       where s.centro_estoque is null
      union all
      select format('saida %s ja tem correcao convertida', c.id)
        from conv_saidas c
       where exists (select 1 from public.stock_correction_requests r
                      where r.notes like 'Convertida da saida ' || c.id::text || '%')
    ) d;

  if v_divergencias is not null then
    raise exception 'Conversao de saidas em correcao cancelada, nada foi gravado: %', v_divergencias;
  end if;

  select count(distinct s.account_owner_id), min(s.account_owner_id::text)::uuid
    into v_owners, v_owner
    from conv_saidas c
    join public.saidas s on s.id = c.id;
  if v_owners <> 1 then
    raise exception 'As saidas pertencem a % tenants; a conversao espera um so.', v_owners;
  end if;

  for v_saida in
    select s.*
      from conv_saidas c
      join public.saidas s on s.id = c.id
     order by s."dataEntrega", s.id
  loop
    perform public.lock_stock_position(v_owner, v_saida."materialId", v_saida.centro_estoque);
    v_saldo_antes := public.calcular_saldo_estoque(v_owner, v_saida."materialId", v_saida.centro_estoque);

    select st.status into v_status_antigo from public.status_saida st where st.id = v_saida.status;

    -- O trigger trg_block_pending_correction_outputs barra a alteracao se houver correcao pendente.
    update public.saidas
       set status = v_cancelado_id,
           "usuarioEdicao" = v_owner,
           "atualizadoEm" = now()
     where id = v_saida.id;

    v_saldo_sistema := public.calcular_saldo_estoque(v_owner, v_saida."materialId", v_saida.centro_estoque);

    insert into public.stock_correction_requests
      (account_owner_id, material_id, stock_center_id, system_balance, physical_quantity, difference,
       notes, status, requested_by, approved_by, approved_at)
    values
      (v_owner, v_saida."materialId", v_saida.centro_estoque, v_saldo_sistema,
       v_saldo_sistema - v_saida.quantidade, -v_saida.quantidade,
       format('Convertida da saida %s (entrega de %s, %s un.), lancada pela tela de Saida para corrigir o estoque.',
         v_saida.id, to_char(v_saida."dataEntrega" at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
         v_saida.quantidade),
       'APROVADO', v_owner, v_owner, now())
    returning id into v_request_id;

    insert into public.stock_adjustments
      (request_id, account_owner_id, material_id, stock_center_id, adjustment_quantity, created_by, created_at)
    values
      (v_request_id, v_owner, v_saida."materialId", v_saida.centro_estoque, -v_saida.quantidade, v_owner,
       v_saida."dataEntrega");

    v_saldo_depois := public.calcular_saldo_estoque(v_owner, v_saida."materialId", v_saida.centro_estoque);
    if v_saldo_depois <> v_saldo_antes then
      raise exception 'Saldo mudou na conversao da saida % (antes %, depois %).', v_saida.id, v_saldo_antes, v_saldo_depois;
    end if;

    -- Mesmo formato do cancelamento pelo app (registrarSaidaHistoricoSupabase): atual x anterior.
    select coalesce(sh.material_saida -> 'atual', sh.material_saida) into v_anterior
      from public.saidas_historico sh
     where sh.saida_id = v_saida.id
     order by sh.created_at desc
     limit 1;
    v_anterior := coalesce(v_anterior, jsonb_build_object(
        'saidaId', v_saida.id,
        'quantidade', v_saida.quantidade,
        'dataEntrega', v_saida."dataEntrega"))
      || jsonb_build_object('status', v_status_antigo, 'statusNome', v_status_antigo, 'statusId', v_saida.status);
    v_atual := v_anterior
      || jsonb_build_object('status', v_cancelado_nome, 'statusNome', v_cancelado_nome, 'statusId', v_cancelado_id,
                            'motivoCancelamento', v_motivo);
    insert into public.saidas_historico (saida_id, material_id, material_saida, "usuarioResponsavel", account_owner_id)
    values (v_saida.id, v_saida."materialId", jsonb_build_object('atual', v_atual, 'anterior', v_anterior),
            v_owner, v_owner);

    v_total_saidas := v_total_saidas + 1;
    v_total_qtd := v_total_qtd + v_saida.quantidade;
  end loop;

  raise notice 'Conversao de saidas em correcao: % saidas (% unidades) canceladas e convertidas em correcao aprovada; saldo inalterado.',
    v_total_saidas, v_total_qtd;
end;
$$;
