-- Listas de Entradas e Saidas paginadas no banco.
-- Depende de: safe_uuid_or_null (20260801_purchase_budget_*) e das tabelas operacionais.
--
-- Antes: as telas de Entradas e Saidas (e o historico de saidas do Estoque atual) liam as tabelas sem
-- paginacao; a API devolve no maximo 1000 linhas, entao so os lancamentos mais recentes apareciam, e
-- busca, filtros, opcoes de filtro e exportacao rodavam no navegador sobre esse recorte. A busca de
-- material dos formularios enviava todos os ids do tenant na URL. Nomes de quem registrou eram lidos de
-- app_users com a sessao do usuario, que nem sempre enxerga os demais usuarios, e apareciam como id.
-- Depois:
--   - rpc_entradas_listar / rpc_saidas_listar(filtros, limite, offset): pagina do tenant da sessao com
--     filtros e busca no banco, nomes resolvidos (material, pessoa, centros, status e quem registrou pelo
--     username) e total de registros;
--   - rpc_movimentacao_registrantes(tipo): opcoes do filtro "Registrado por";
--   - rpc_materiais_buscar(termo, centro, limite): busca de material dos formularios;
--   - busca sem acento e sem diferenca de maiusculas (_texto_busca);
--   - indices por tenant + data para a ordenacao das listas.

create index if not exists entradas_owner_data_idx on public.entradas (account_owner_id, "dataEntrada" desc);
create index if not exists saidas_owner_data_idx on public.saidas (account_owner_id, "dataEntrega" desc);

create or replace function public._texto_busca(p_texto text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(lower(translate(
    coalesce(p_texto, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  )));
$$;

-- Nome de quem registrou: username de app_users; para ids que so existem em app_users_dependentes, o
-- username de la. Sem username, cai para nome de exibicao, email e por fim o id.
create or replace function public._usuario_nome(p_usuario_id uuid)
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select coalesce(nullif(btrim(u.username), ''), nullif(btrim(u.display_name), ''), nullif(btrim(u.email), ''))
       from public.app_users u where u.id = p_usuario_id),
    (select coalesce(nullif(btrim(d.username), ''), nullif(btrim(d.display_name), ''), nullif(btrim(d.email), ''))
       from public.app_users_dependentes d where d.auth_user_id = p_usuario_id limit 1),
    p_usuario_id::text
  );
$$;

create or replace function public._materiais_json_tenant(p_owner_id uuid)
returns table (material_id uuid, material jsonb)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select v.id, jsonb_build_object(
    'id', v.id,
    'nome', v.nome,
    'materialItemNome', v."materialItemNome",
    'fabricante', v.fabricante,
    'fabricanteNome', v."fabricanteNome",
    'validadeDias', v."validadeDias",
    'ca', v.ca,
    'valorUnitario', v."valorUnitario",
    'estoqueMinimo', v."estoqueMinimo",
    'ativo', v.ativo,
    'descricao', v.descricao,
    'grupoMaterial', v."grupoMaterial",
    'grupoMaterialNome', v."grupoMaterialNome",
    'numeroCalcado', v."numeroCalcado",
    'numeroCalcadoNome', v."numeroCalcadoNome",
    'numeroVestimenta', v."numeroVestimenta",
    'numeroVestimentaNome', v."numeroVestimentaNome",
    'numeroEspecifico', v."numeroEspecifico",
    'coresTexto', v."coresTexto",
    'caracteristicasTexto', v."caracteristicasTexto"
  )
  from public.materiais_view v
  join public.materiais m on m.id = v.id
  where m.account_owner_id = p_owner_id;
$$;

create or replace function public._material_texto_busca(p_material jsonb)
returns text
language sql
immutable
as $$
  select concat_ws(' ',
    p_material->>'materialItemNome', p_material->>'nome', p_material->>'grupoMaterial',
    p_material->>'grupoMaterialNome', p_material->>'numeroCalcado', p_material->>'numeroCalcadoNome',
    p_material->>'numeroVestimenta', p_material->>'numeroVestimentaNome', p_material->>'numeroEspecifico',
    p_material->>'fabricante', p_material->>'fabricanteNome', p_material->>'coresTexto',
    p_material->>'ca', p_material->>'id'
  );
$$;

create or replace function public._movimentacao_pode_listar()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_master() or public.has_permission('estoque.read')
      or public.has_permission('estoque.write') or public.has_permission('estoque.atual')
      or public.has_permission('estoque.entradas') or public.has_permission('estoque.saidas')) then
    raise exception 'Sem permissão para consultar movimentações de estoque.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.rpc_entradas_listar(
  p_filtros jsonb default '{}'::jsonb,
  p_limite integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  material_id uuid,
  quantidade numeric,
  data_entrada timestamptz,
  centro_estoque_id uuid,
  centro_estoque_nome text,
  status_id uuid,
  status_nome text,
  usuario_responsavel_id uuid,
  usuario_responsavel_nome text,
  usuario_edicao_id uuid,
  usuario_edicao_nome text,
  criado_em timestamptz,
  atualizado_em timestamptz,
  material jsonb,
  total_registros bigint
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_owner uuid := public.current_account_owner_id();
  v_filtros jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_inicio timestamptz := nullif(v_filtros->>'data_inicio', '')::timestamptz;
  v_fim timestamptz := nullif(v_filtros->>'data_fim', '')::timestamptz;
  v_material uuid := public.safe_uuid_or_null(v_filtros->>'material_id');
  v_centro uuid := public.safe_uuid_or_null(v_filtros->>'centro_estoque_id');
  v_status uuid := public.safe_uuid_or_null(v_filtros->>'status_id');
  v_registrado_por uuid := public.safe_uuid_or_null(v_filtros->>'registrado_por');
  v_termo text := public._texto_busca(v_filtros->>'termo');
  v_limite integer := greatest(1, least(coalesce(p_limite, 20), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  perform public._movimentacao_pode_listar();
  if v_owner is null then
    raise exception 'Tenant da sessão não identificado.' using errcode = '42501';
  end if;

  return query
  with materiais_tenant as (
    select mt.material_id, mt.material from public._materiais_json_tenant(v_owner) mt
  ),
  base as (
    select e.*,
           ce.almox::text as centro_nome,
           st.status::text as status_texto,
           public._usuario_nome(e."usuarioResponsavel") as responsavel_nome,
           case when e.usuario_edicao is null then null else public._usuario_nome(e.usuario_edicao) end as edicao_nome,
           mat.material as material_json
      from public.entradas e
      left join materiais_tenant mat on mat.material_id = e."materialId"
      left join public.centros_estoque ce on ce.id = e.centro_estoque
      left join public.status_entrada st on st.id = e.status
     where e.account_owner_id = v_owner
       and (v_inicio is null or e."dataEntrada" >= v_inicio)
       and (v_fim is null or e."dataEntrada" <= v_fim)
       and (v_material is null or e."materialId" = v_material)
       and (v_centro is null or e.centro_estoque = v_centro)
       and (v_status is null or e.status = v_status)
       and (v_registrado_por is null or e."usuarioResponsavel" = v_registrado_por)
  ),
  filtrado as (
    select b.*
      from base b
     where v_termo = ''
        or position(v_termo in public._texto_busca(concat_ws(' ',
             public._material_texto_busca(b.material_json), b."materialId"::text, b.centro_nome,
             b.responsavel_nome, b.status_texto))) > 0
  )
  select f.id,
         f."materialId",
         f.quantidade,
         f."dataEntrada",
         f.centro_estoque,
         f.centro_nome,
         f.status,
         f.status_texto,
         f."usuarioResponsavel",
         f.responsavel_nome,
         f.usuario_edicao,
         f.edicao_nome,
         f.create_at,
         f.atualizado_em,
         f.material_json,
         count(*) over ()
    from filtrado f
   order by f."dataEntrada" desc, f.create_at desc nulls last, f.id
   limit v_limite offset v_offset;
end;
$$;

create or replace function public.rpc_saidas_listar(
  p_filtros jsonb default '{}'::jsonb,
  p_limite integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  material_id uuid,
  pessoa_id uuid,
  quantidade numeric,
  data_entrega timestamptz,
  data_troca timestamptz,
  is_troca boolean,
  troca_de_saida uuid,
  troca_sequencia integer,
  status_id uuid,
  status_nome text,
  centro_estoque_id uuid,
  centro_estoque_nome text,
  centro_custo_id uuid,
  centro_custo_nome text,
  centro_servico_id uuid,
  centro_servico_nome text,
  usuario_responsavel_id uuid,
  usuario_responsavel_nome text,
  usuario_edicao_id uuid,
  usuario_edicao_nome text,
  criado_em timestamptz,
  atualizado_em timestamptz,
  material jsonb,
  pessoa jsonb,
  total_registros bigint
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_owner uuid := public.current_account_owner_id();
  v_filtros jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_inicio timestamptz := nullif(v_filtros->>'data_inicio', '')::timestamptz;
  v_fim timestamptz := nullif(v_filtros->>'data_fim', '')::timestamptz;
  v_material uuid := public.safe_uuid_or_null(v_filtros->>'material_id');
  v_pessoa uuid := public.safe_uuid_or_null(v_filtros->>'pessoa_id');
  v_centro_estoque uuid := public.safe_uuid_or_null(v_filtros->>'centro_estoque_id');
  v_centro_custo uuid := public.safe_uuid_or_null(v_filtros->>'centro_custo_id');
  v_centro_servico uuid := public.safe_uuid_or_null(v_filtros->>'centro_servico_id');
  v_status uuid := public.safe_uuid_or_null(v_filtros->>'status_id');
  v_registrado_por uuid := public.safe_uuid_or_null(v_filtros->>'registrado_por');
  v_termo text := public._texto_busca(v_filtros->>'termo');
  v_troca_somente boolean := coalesce((v_filtros->>'troca_somente')::boolean, false);
  v_troca_prazo text := nullif(btrim(coalesce(v_filtros->>'troca_prazo', '')), '');
  -- "Hoje" vem do navegador (mesma referencia que a tela usava); sem ele, data de Sao Paulo.
  v_hoje date := coalesce(nullif(v_filtros->>'hoje', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_limite integer := greatest(1, least(coalesce(p_limite, 20), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  perform public._movimentacao_pode_listar();
  if v_owner is null then
    raise exception 'Tenant da sessão não identificado.' using errcode = '42501';
  end if;

  return query
  with materiais_tenant as (
    select mt.material_id, mt.material from public._materiais_json_tenant(v_owner) mt
  ),
  base as (
    select s.*,
           ss.status::text as status_texto,
           ce.almox::text as centro_estoque_texto,
           cc.nome::text as centro_custo_texto,
           cs.nome::text as centro_servico_texto,
           public._usuario_nome(s."usuarioResponsavel") as responsavel_nome,
           case when s."usuarioEdicao" is null then null else public._usuario_nome(s."usuarioEdicao") end as edicao_nome,
           mat.material as material_json,
           jsonb_build_object(
             'id', p.id,
             'nome', p.nome,
             'matricula', p.matricula,
             'cargo', pcg.nome,
             'centroServico', pcs.nome,
             'centroCusto', pcc.nome,
             'setor', pst.nome,
             'local', coalesce(pcs.nome, pcc.nome),
             'ativo', p.ativo
           ) as pessoa_json,
           case
             when s."dataTroca" is null then null
             when (s."dataTroca" at time zone 'UTC')::date < v_hoje then 'atrasada'
             when (s."dataTroca" at time zone 'UTC')::date = v_hoje then 'limite'
             when (s."dataTroca" at time zone 'UTC')::date <= v_hoje + 7 then 'alerta'
           end as prazo_troca
      from public.saidas s
      left join materiais_tenant mat on mat.material_id = s."materialId"
      left join public.status_saida ss on ss.id = s.status
      left join public.centros_estoque ce on ce.id = s.centro_estoque
      left join public.centros_custo cc on cc.id = s.centro_custo
      left join public.centros_servico cs on cs.id = s.centro_servico
      left join public.pessoas p on p.id = s."pessoaId"
      left join public.cargos pcg on pcg.id = p.cargo_id
      left join public.centros_servico pcs on pcs.id = p.centro_servico_id
      left join public.centros_custo pcc on pcc.id = p.centro_custo_id
      left join public.setores pst on pst.id = p.setor_id
     where s.account_owner_id = v_owner
       and (v_inicio is null or s."dataEntrega" >= v_inicio)
       and (v_fim is null or s."dataEntrega" <= v_fim)
       and (v_material is null or s."materialId" = v_material)
       and (v_pessoa is null or s."pessoaId" = v_pessoa)
       and (v_centro_estoque is null or s.centro_estoque = v_centro_estoque)
       and (v_centro_custo is null or s.centro_custo = v_centro_custo)
       and (v_centro_servico is null or s.centro_servico = v_centro_servico)
       and (v_status is null or s.status = v_status)
       and (v_registrado_por is null or s."usuarioResponsavel" = v_registrado_por)
       and (not v_troca_somente or s."isTroca")
  ),
  filtrado as (
    select b.*
      from base b
     where (v_troca_prazo is null
            or (v_troca_prazo = 'sem-data' and b.prazo_troca is null)
            or b.prazo_troca = v_troca_prazo)
       and (v_termo = ''
            or position(v_termo in public._texto_busca(concat_ws(' ',
                 b.pessoa_json->>'nome', b.pessoa_json->>'matricula', b.pessoa_json->>'centroServico',
                 b.pessoa_json->>'local', b.pessoa_json->>'setor', b.pessoa_json->>'cargo',
                 public._material_texto_busca(b.material_json), b."materialId"::text, b."pessoaId"::text,
                 b.centro_custo_texto, b.centro_servico_texto, b.responsavel_nome))) > 0)
  )
  select f.id,
         f."materialId",
         f."pessoaId",
         f.quantidade,
         f."dataEntrega",
         f."dataTroca",
         f."isTroca",
         f."trocaDeSaida",
         f."trocaSequencia",
         f.status,
         f.status_texto,
         f.centro_estoque,
         f.centro_estoque_texto,
         f.centro_custo,
         f.centro_custo_texto,
         f.centro_servico,
         f.centro_servico_texto,
         f."usuarioResponsavel",
         f.responsavel_nome,
         f."usuarioEdicao",
         f.edicao_nome,
         f."criadoEm",
         f."atualizadoEm",
         f.material_json,
         f.pessoa_json,
         count(*) over ()
    from filtrado f
   order by f."dataEntrega" desc, f."criadoEm" desc nulls last, f.id
   limit v_limite offset v_offset;
end;
$$;

create or replace function public.rpc_movimentacao_registrantes(p_tipo text)
returns table (id uuid, nome text)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_owner uuid := public.current_account_owner_id();
begin
  perform public._movimentacao_pode_listar();
  if p_tipo not in ('entradas', 'saidas') then
    raise exception 'Tipo inválido. Use entradas ou saidas.' using errcode = '22023';
  end if;

  return query
  select r.usuario_id, public._usuario_nome(r.usuario_id)
    from (
      select distinct e."usuarioResponsavel" as usuario_id
        from public.entradas e
       where p_tipo = 'entradas' and e.account_owner_id = v_owner and e."usuarioResponsavel" is not null
      union
      select distinct s."usuarioResponsavel"
        from public.saidas s
       where p_tipo = 'saidas' and s.account_owner_id = v_owner and s."usuarioResponsavel" is not null
    ) r
   order by 2;
end;
$$;

create or replace function public.rpc_materiais_buscar(
  p_termo text,
  p_centro_estoque_id uuid default null,
  p_limite integer default 10
)
returns table (material jsonb)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_owner uuid := public.current_account_owner_id();
  v_termo text := public._texto_busca(p_termo);
  v_id uuid := public.safe_uuid_or_null(btrim(coalesce(p_termo, '')));
  v_palavras text[] := array_remove(regexp_split_to_array(v_termo, '\s+'), '');
  v_limite integer := greatest(1, least(coalesce(p_limite, 10), 50));
begin
  perform public._movimentacao_pode_listar();
  if v_termo = '' then
    return;
  end if;

  return query
  select mt.material
    from public._materiais_json_tenant(v_owner) mt
   where (p_centro_estoque_id is null or exists (
           select 1 from public.entradas e
            where e."materialId" = mt.material_id
              and e.centro_estoque = p_centro_estoque_id
              and e.account_owner_id = v_owner))
     and (
       (v_id is not null and mt.material_id = v_id)
       or (v_id is null and not exists (
             select 1 from unnest(v_palavras) palavra
              where position(palavra in public._texto_busca(concat_ws(' ',
                      public._material_texto_busca(mt.material), mt.material->>'descricao',
                      mt.material->>'caracteristicasTexto'))) = 0))
     )
   order by mt.material->>'materialItemNome' nulls last, mt.material->>'fabricanteNome' nulls last, mt.material_id
   limit v_limite;
end;
$$;

revoke all on function public._usuario_nome(uuid) from public, anon, authenticated;
revoke all on function public._materiais_json_tenant(uuid) from public, anon, authenticated;
revoke all on function public._movimentacao_pode_listar() from public, anon, authenticated;
revoke all on function public.rpc_entradas_listar(jsonb, integer, integer) from public, anon;
revoke all on function public.rpc_saidas_listar(jsonb, integer, integer) from public, anon;
revoke all on function public.rpc_movimentacao_registrantes(text) from public, anon;
revoke all on function public.rpc_materiais_buscar(text, uuid, integer) from public, anon;
grant execute on function public.rpc_entradas_listar(jsonb, integer, integer) to authenticated, service_role;
grant execute on function public.rpc_saidas_listar(jsonb, integer, integer) to authenticated, service_role;
grant execute on function public.rpc_movimentacao_registrantes(text) to authenticated, service_role;
grant execute on function public.rpc_materiais_buscar(text, uuid, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
