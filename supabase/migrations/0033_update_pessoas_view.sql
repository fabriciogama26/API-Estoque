do $$
begin
  execute 'drop view if exists public.pessoas_view';
  execute $sql$
    create view public.pessoas_view as
    select
      p.id,
      p.nome,
      p.matricula,
      p."dataAdmissao",
      p."usuarioCadastro",
      coalesce(uc.display_name, uc.username, uc.email, p."usuarioCadastro") as "usuarioCadastroNome",
      p."usuarioEdicao",
      coalesce(ue.display_name, ue.username, ue.email, p."usuarioEdicao") as "usuarioEdicaoNome",
      p."criadoEm",
      p."atualizadoEm",
      p.centro_servico_id,
      p.setor_id,
      p.cargo_id,
      p.centro_custo_id,
      p.tipo_execucao_id,
      cs.nome as centro_servico,
      st.nome as setor,
      cg.nome as cargo,
      cc.nome as centro_custo,
      te.nome as tipo_execucao
    from public.pessoas p
    join public.centros_servico cs on cs.id = p.centro_servico_id
    join public.setores st on st.id = p.setor_id
    join public.cargos cg on cg.id = p.cargo_id
    join public.centros_custo cc on cc.id = p.centro_custo_id
    join public.tipo_execucao te on te.id = p.tipo_execucao_id
    left join public.app_users uc on uc.id::text = p."usuarioCadastro"::text
    left join public.app_users ue on ue.id::text = p."usuarioEdicao"::text
  $sql$;
  execute 'grant select on public.pessoas_view to anon, authenticated, service_role';
end
$$;
