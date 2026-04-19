-- Etapa 1/4 do ajuste de ASO.
-- Executar antes das RPCs.
-- Responsavel por:
-- - adicionar mudanca_funcao_setor
-- - ajustar colunas/indices
-- - ajustar historico
-- - recriar a view aso_controle_view

alter table public.aso_controle
  add column if not exists status_registro text not null default 'ativo';

alter table public.aso_controle
  add column if not exists registro_origem_id uuid null references public.aso_controle(id) on delete set null;

alter table public.aso_controle
  add column if not exists baixado_em timestamptz null;

alter table public.aso_controle
  add column if not exists baixado_por uuid null references public.app_users(id);

update public.aso_controle
set status_registro = 'ativo'
where status_registro is null;

alter table public.aso_controle
  drop constraint if exists aso_controle_status_registro_check;

alter table public.aso_controle
  add constraint aso_controle_status_registro_check
  check (status_registro in ('ativo', 'baixado'));

insert into public.aso_tipos_exame (
  id,
  codigo,
  nome,
  gera_vencimento,
  anos_validade,
  ordem,
  ativo
)
values
  ('44444444-4444-4444-8444-444444444444', 'mudanca_funcao_setor', 'Mudanca de funcao/Setor', true, 1, 3, true)
on conflict (codigo) do update
set
  id = excluded.id,
  nome = excluded.nome,
  gera_vencimento = excluded.gera_vencimento,
  anos_validade = excluded.anos_validade,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();

update public.aso_tipos_exame
set ordem = case codigo
  when 'admissional' then 1
  when 'periodico' then 2
  when 'mudanca_funcao_setor' then 3
  when 'demissional' then 4
  else ordem
end
where codigo in ('admissional', 'periodico', 'mudanca_funcao_setor', 'demissional');

drop index if exists public.aso_controle_owner_pessoa_tipo_data_unique_idx;
create unique index if not exists aso_controle_owner_pessoa_tipo_data_unique_idx
  on public.aso_controle (account_owner_id, pessoa_id, tipo_exame_id, data_exame);

alter table public.aso_controle
  drop constraint if exists aso_controle_owner_pessoa_tipo_unique;

drop index if exists public.aso_controle_owner_pessoa_tipo_unique;
drop index if exists public.aso_controle_owner_pessoa_admissional_unique_idx;
drop index if exists public.aso_controle_owner_pessoa_renewable_unique_idx;
drop index if exists public.aso_controle_owner_pessoa_renewable_active_idx;

create index if not exists aso_controle_owner_pessoa_renewable_active_idx
  on public.aso_controle (account_owner_id, pessoa_id)
  where status_registro = 'ativo'
    and tipo_exame_id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '44444444-4444-4444-8444-444444444444'
    );

drop index if exists public.aso_controle_owner_pessoa_demissional_unique_idx;
drop index if exists public.aso_controle_owner_pessoa_demissional_active_idx;
create index if not exists aso_controle_owner_pessoa_demissional_active_idx
  on public.aso_controle (account_owner_id, pessoa_id)
  where status_registro = 'ativo'
    and tipo_exame_id = '33333333-3333-4333-8333-333333333333';

create index if not exists aso_controle_status_registro_idx
  on public.aso_controle (status_registro);

create index if not exists aso_controle_registro_origem_idx
  on public.aso_controle (registro_origem_id);

update public.aso_historico
set acao = 'baixa_exame'
where acao = 'registro_exame';

alter table public.aso_historico
  drop constraint if exists aso_historico_acao_check;

alter table public.aso_historico
  add constraint aso_historico_acao_check
  check (acao in ('cadastro', 'edicao', 'baixa_exame'));

create or replace view public.aso_controle_view as
select
  aso.id,
  aso.pessoa_id,
  pv.nome as funcionario,
  pv.nome,
  pv.matricula,
  pv.centro_servico_id,
  pv.centro_servico,
  pv."centroServico",
  pv.setor_id,
  pv.setor,
  pv.cargo_id,
  pv.cargo,
  aso.tipo_exame_id,
  tipo.codigo as tipo_exame_codigo,
  tipo.nome as tipo_exame,
  aso.data_exame,
  aso.proximo_vencimento,
  case
    when aso.status_registro = 'baixado' then null
    when aso.proximo_vencimento is null then null
    else (aso.proximo_vencimento - current_date)
  end as dias_para_vencer,
  case
    when aso.status_registro = 'baixado' then 'baixado'
    when tipo.codigo = 'demissional' then 'sem_renovacao'
    when aso.proximo_vencimento is null then 'sem_vencimento'
    when aso.proximo_vencimento < current_date then 'vencido'
    when aso.proximo_vencimento = current_date then 'vence_hoje'
    when aso.proximo_vencimento <= (current_date + 15) then 'vence_15'
    when aso.proximo_vencimento <= (current_date + 30) then 'vence_30'
    when aso.proximo_vencimento <= (current_date + 60) then 'vence_60'
    else 'em_dia'
  end as status_vencimento,
  aso.observacao,
  aso.usuario_cadastro,
  coalesce(uc.username, uc.display_name, uc.email, aso.usuario_cadastro::text) as usuario_cadastro_nome,
  aso.usuario_edicao,
  coalesce(ue.username, ue.display_name, ue.email, aso.usuario_edicao::text) as usuario_edicao_nome,
  aso.criado_em,
  aso.atualizado_em,
  aso.account_owner_id,
  pv."dataDemissao" as data_demissao,
  pv.ativo,
  aso.status_registro,
  aso.registro_origem_id,
  aso.baixado_em,
  aso.baixado_por
from public.aso_controle aso
join public.pessoas_view pv on pv.id = aso.pessoa_id
join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
left join public.app_users uc on uc.id = aso.usuario_cadastro
left join public.app_users ue on ue.id = aso.usuario_edicao;

grant select on public.aso_controle_view to authenticated, anon, service_role;
