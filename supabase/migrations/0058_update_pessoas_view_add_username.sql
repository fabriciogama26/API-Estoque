-- Atualiza pessoas_view para incluir usuarioCadastroUsername sem alterar o padrão anterior
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS public.pessoas_view CASCADE';

  EXECUTE $sql$
    CREATE VIEW public.pessoas_view AS
    SELECT
      p.id,
      p.nome,
      p.matricula,
      p.centro_servico_id,
      cs.nome AS centro_servico,
      cs.nome AS "centroServico",
      p.centro_custo_id,
      cc.nome AS centro_custo,
      cc.nome AS "centroCusto",
      COALESCE(cs.nome, cc.nome) AS local,
      p.setor_id,
      st.nome AS setor,
      p.cargo_id,
      cg.nome AS cargo,
      p.tipo_execucao_id,
      te.nome AS tipo_execucao,
      te.nome AS "tipoExecucao",
      p."dataAdmissao" AS "dataAdmissao",
      p.ativo,
      p."usuarioCadastro",
      COALESCE(uc.username, uc.display_name, uc.email, p."usuarioCadastro"::text) AS "usuarioCadastroNome",
      uc.username AS "usuarioCadastroUsername",
      p."usuarioEdicao",
      COALESCE(ue.username, ue.display_name, ue.email, p."usuarioEdicao"::text) AS "usuarioEdicaoNome",
      ue.username AS "usuarioEdicaoUsername",
      p."criadoEm",
      p."atualizadoEm"
    FROM public.pessoas p
    LEFT JOIN public.centros_servico cs ON cs.id = p.centro_servico_id
    LEFT JOIN public.centros_custo cc ON cc.id = p.centro_custo_id
    LEFT JOIN public.setores st ON st.id = p.setor_id
    LEFT JOIN public.cargos cg ON cg.id = p.cargo_id
    LEFT JOIN public.tipo_execucao te ON te.id = p.tipo_execucao_id
    LEFT JOIN public.app_users uc ON uc.id = p."usuarioCadastro"
    LEFT JOIN public.app_users ue ON ue.id = p."usuarioEdicao";
  $sql$;

  EXECUTE 'GRANT SELECT ON public.pessoas_view TO authenticated, anon, service_role';
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
