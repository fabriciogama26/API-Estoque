-- Dashboard de estoque com os lancamentos agregados no banco.
-- Depende de: 20261005_listas_movimentacoes_paginadas.sql (padrao de status cancelado e permissoes).
--
-- Antes: o Dashboard lia entradas e saidas do periodo (padrao: o ano inteiro) sem paginacao; a API
-- devolve no maximo 1000 linhas, entao totais, rankings, Paretos e trocas usavam so os lancamentos mais
-- recentes. As pessoas das saidas eram buscadas com todos os ids na URL.
-- Depois: rpc_dashboard_estoque(inicio, fim, hoje) devolve, em uma unica resposta jsonb:
--   - entradas agregadas por material x mes (quantidade e numero de registros);
--   - saidas agregadas por material x pessoa x centro de custo x troca x mes x faixa de prazo de troca;
--   - as pessoas dessas saidas (mesmos campos e regras da rpc_pessoas_completa, usada pelo Dashboard antigo).
-- O front remonta os mesmos dados que os graficos usavam, sem o corte de 1000 linhas. Lancamentos
-- cancelados ficam fora, como antes. A faixa de prazo segue o card de trocas: limite passado (< hoje) e a
-- vencer (hoje ate 7 dias), com o "hoje" do navegador.

create or replace function public._dashboard_pode_ver()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_master() or public.has_permission('estoque.read')
      or public.has_permission('estoque.write') or public.has_permission('estoque.dashboard')
      or public.has_permission('estoque.atual') or public.has_permission('estoque.entradas')
      or public.has_permission('estoque.saidas')) then
    raise exception 'Sem permissão para consultar o dashboard de estoque.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.rpc_dashboard_estoque(
  p_inicio timestamptz default null,
  p_fim timestamptz default null,
  p_hoje date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_hoje date := coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date);
begin
  perform public._dashboard_pode_ver();
  if v_owner is null then
    raise exception 'Tenant da sessão não identificado.' using errcode = '42501';
  end if;

  return (
    with entradas_periodo as (
      select e."materialId" as material_id,
             to_char(date_trunc('month', e."dataEntrada" at time zone 'UTC'), 'YYYY-MM-DD"T"00:00:00"Z"') as mes,
             e.quantidade
        from public.entradas e
        left join public.status_entrada st on st.id = e.status
       where e.account_owner_id = v_owner
         and (p_inicio is null or e."dataEntrada" >= p_inicio)
         and (p_fim is null or e."dataEntrada" <= p_fim)
         and lower(coalesce(st.status, '')) <> 'cancelado'
    ),
    saidas_periodo as (
      select s."materialId" as material_id,
             s."pessoaId" as pessoa_id,
             cc.nome::text as centro_custo_nome,
             s."isTroca" as is_troca,
             to_char(date_trunc('month', s."dataEntrega" at time zone 'UTC'), 'YYYY-MM-DD"T"00:00:00"Z"') as mes,
             case
               when s."dataTroca" is null then null
               when (s."dataTroca" at time zone 'UTC')::date < v_hoje then 'atrasada'
               when (s."dataTroca" at time zone 'UTC')::date <= v_hoje + 7 then 'a_vencer'
             end as prazo_troca,
             s.quantidade
        from public.saidas s
        left join public.status_saida ss on ss.id = s.status
        left join public.centros_custo cc on cc.id = s.centro_custo
       where s.account_owner_id = v_owner
         and (p_inicio is null or s."dataEntrega" >= p_inicio)
         and (p_fim is null or s."dataEntrega" <= p_fim)
         and lower(coalesce(ss.status, '')) <> 'cancelado'
    )
    select jsonb_build_object(
      'entradas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'material_id', g.material_id, 'mes', g.mes,
                 'quantidade', g.quantidade, 'registros', g.registros))
          from (select material_id, mes, sum(quantidade) as quantidade, count(*) as registros
                  from entradas_periodo
                 group by material_id, mes) g
      ), '[]'::jsonb),
      'saidas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'material_id', g.material_id, 'pessoa_id', g.pessoa_id, 'centro_custo_nome', g.centro_custo_nome,
                 'is_troca', g.is_troca, 'mes', g.mes, 'prazo_troca', g.prazo_troca,
                 'quantidade', g.quantidade, 'registros', g.registros))
          from (select material_id, pessoa_id, centro_custo_nome, is_troca, mes, prazo_troca,
                       sum(quantidade) as quantidade, count(*) as registros
                  from saidas_periodo
                 group by material_id, pessoa_id, centro_custo_nome, is_troca, mes, prazo_troca) g
      ), '[]'::jsonb),
      -- Mesmos campos e regras da rpc_pessoas_completa (fonte das pessoas no Dashboard antigo).
      'pessoas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'nome', p.nome,
                 'matricula', p.matricula,
                 'data_admissao', p."dataAdmissao",
                 'data_demissao', p."dataDemissao",
                 'centro_servico_id', p.centro_servico_id,
                 'setor_id', p.setor_id,
                 'cargo_id', p.cargo_id,
                 'centro_custo_id', p.centro_custo_id,
                 'ativo', p.ativo,
                 'centro_servico', cs.nome,
                 'setor', st.nome,
                 'cargo', cg.nome,
                 'centro_custo', cc.nome,
                 'local', coalesce(al.nome, cs.nome)))
          from public.pessoas p
          left join public.centros_servico cs on cs.id = p.centro_servico_id
          left join public.centros_custo cc on cc.id = p.centro_custo_id
          left join public.setores st on st.id = p.setor_id
          left join public.cargos cg on cg.id = p.cargo_id
          left join public.acidente_locais al on al.id = p.centro_servico_id
         where p.id in (select distinct sp.pessoa_id from saidas_periodo sp where sp.pessoa_id is not null)
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public._dashboard_pode_ver() from public, anon, authenticated;
revoke all on function public.rpc_dashboard_estoque(timestamptz, timestamptz, date) from public, anon;
grant execute on function public.rpc_dashboard_estoque(timestamptz, timestamptz, date) to authenticated, service_role;

notify pgrst, 'reload schema';
