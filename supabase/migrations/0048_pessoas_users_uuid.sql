-- Atualiza pessoas para usar UUIDs de app_users em usuarioCadastro/usuarioEdicao.

-- Remove dependências antes de alterar colunas.
drop view if exists public.pessoas_view;

alter table if exists public.pessoas
  alter column "usuarioCadastro" drop default,
  alter column "usuarioEdicao" drop default;

-- remove not null antes da conversão para evitar erro em valores não uuid
alter table if exists public.pessoas
  alter column "usuarioCadastro" drop not null,
  alter column "usuarioEdicao" drop not null;

-- converte valores textuais que sejam UUID, demais viram null temporariamente
alter table if exists public.pessoas
  alter column "usuarioCadastro" type uuid using (
    case
      when "usuarioCadastro" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then "usuarioCadastro"::uuid
      else null
    end
  ),
  alter column "usuarioEdicao" type uuid using (
    case
      when "usuarioEdicao" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then "usuarioEdicao"::uuid
      else null
    end
  );

-- garante FK para app_users
alter table if exists public.pessoas
  drop constraint if exists pessoas_usuario_cadastro_fk,
  drop constraint if exists pessoas_usuario_edicao_fk;

alter table if exists public.pessoas
  add constraint pessoas_usuario_cadastro_fk foreign key ("usuarioCadastro") references public.app_users (id);

alter table if exists public.pessoas
  add constraint pessoas_usuario_edicao_fk foreign key ("usuarioEdicao") references public.app_users (id);

-- reconstrói pessoas_view para expor ids + nomes
create view public.pessoas_view as
select
  p.id,
  p.nome,
  p.matricula,
  p."dataAdmissao",
  p."usuarioCadastro",
  coalesce(uc.display_name, uc.username, uc.email, p."usuarioCadastro"::text) as "usuarioCadastroNome",
  p."usuarioEdicao",
  coalesce(ue.display_name, ue.username, ue.email, p."usuarioEdicao"::text) as "usuarioEdicaoNome",
  p."criadoEm",
  p."atualizadoEm",
  p.centro_servico_id,
  p.setor_id,
  p.cargo_id,
  p.centro_custo_id,
  p.tipo_execucao_id,
  p.ativo,
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
left join public.app_users uc on uc.id = p."usuarioCadastro"
left join public.app_users ue on ue.id = p."usuarioEdicao";

grant select on public.pessoas_view to anon, authenticated, service_role;
