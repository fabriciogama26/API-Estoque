-- Cria o dominio de controle de ASO com catalogo fixo, historico e RPCs.

create table if not exists public.aso_tipos_exame (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null unique,
  gera_vencimento boolean not null default true,
  anos_validade smallint null,
  ordem smallint not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

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
  ('11111111-1111-4111-8111-111111111111', 'admissional', 'Admissional', true, 1, 1, true),
  ('22222222-2222-4222-8222-222222222222', 'periodico', 'Periodico', true, 1, 2, true),
  ('33333333-3333-4333-8333-333333333333', 'demissional', 'Demissional', false, null, 3, true)
on conflict (codigo) do update
set
  id = excluded.id,
  nome = excluded.nome,
  gera_vencimento = excluded.gera_vencimento,
  anos_validade = excluded.anos_validade,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();

create table if not exists public.aso_controle (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  tipo_exame_id uuid not null references public.aso_tipos_exame(id),
  data_exame date not null,
  proximo_vencimento date null,
  observacao text null,
  usuario_cadastro uuid null references public.app_users(id),
  usuario_edicao uuid null references public.app_users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz null,
  account_owner_id uuid not null default public.my_owner_id() references public.app_users(id)
);

create index if not exists aso_controle_owner_idx
  on public.aso_controle (account_owner_id);

create index if not exists aso_controle_pessoa_idx
  on public.aso_controle (pessoa_id, tipo_exame_id);

create unique index if not exists aso_controle_owner_pessoa_tipo_data_unique_idx
  on public.aso_controle (account_owner_id, pessoa_id, tipo_exame_id, data_exame);

create unique index if not exists aso_controle_owner_pessoa_admissional_unique_idx
  on public.aso_controle (account_owner_id, pessoa_id)
  where tipo_exame_id = '11111111-1111-4111-8111-111111111111';

create unique index if not exists aso_controle_owner_pessoa_demissional_unique_idx
  on public.aso_controle (account_owner_id, pessoa_id)
  where tipo_exame_id = '33333333-3333-4333-8333-333333333333';

create index if not exists aso_controle_vencimento_idx
  on public.aso_controle (proximo_vencimento);

create table if not exists public.aso_historico (
  id uuid primary key default gen_random_uuid(),
  aso_id uuid not null references public.aso_controle(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  acao text not null,
  dados_antes jsonb null,
  dados_depois jsonb not null default '{}'::jsonb,
  observacao text null,
  usuario_responsavel uuid null references public.app_users(id),
  criado_em timestamptz not null default now(),
  account_owner_id uuid not null default public.my_owner_id() references public.app_users(id),
  constraint aso_historico_acao_check check (acao in ('cadastro', 'edicao', 'registro_exame'))
);

create index if not exists aso_historico_aso_idx
  on public.aso_historico (aso_id, criado_em desc);

create index if not exists aso_historico_pessoa_idx
  on public.aso_historico (pessoa_id, criado_em desc);

create or replace function public.apply_aso_proximo_vencimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_gera_vencimento boolean;
  v_anos_validade smallint;
begin
  select
    gera_vencimento,
    coalesce(anos_validade, 1)
  into
    v_gera_vencimento,
    v_anos_validade
  from public.aso_tipos_exame
  where id = new.tipo_exame_id
    and ativo = true;

  if not found then
    raise exception 'tipo_exame_aso_not_found' using errcode = '23503';
  end if;

  if new.data_exame is null then
    new.proximo_vencimento := null;
  elsif coalesce(v_gera_vencimento, false) then
    new.proximo_vencimento := (new.data_exame + make_interval(years => v_anos_validade))::date;
  else
    new.proximo_vencimento := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aso_proximo_vencimento on public.aso_controle;
create trigger trg_aso_proximo_vencimento
before insert or update of tipo_exame_id, data_exame
on public.aso_controle
for each row
execute function public.apply_aso_proximo_vencimento();

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
    when aso.proximo_vencimento is null then null
    else (aso.proximo_vencimento - current_date)
  end as dias_para_vencer,
  case
    when tipo.codigo = 'demissional' then 'demissional'
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
  pv.ativo
from public.aso_controle aso
join public.pessoas_view pv on pv.id = aso.pessoa_id
join public.aso_tipos_exame tipo on tipo.id = aso.tipo_exame_id
left join public.app_users uc on uc.id = aso.usuario_cadastro
left join public.app_users ue on ue.id = aso.usuario_edicao;

grant select on public.aso_controle_view to authenticated, anon, service_role;

alter table if exists public.aso_tipos_exame enable row level security;
alter table if exists public.aso_controle enable row level security;
alter table if exists public.aso_historico enable row level security;

drop policy if exists aso_tipos_exame_select_all on public.aso_tipos_exame;
drop policy if exists aso_tipos_exame_block_insert on public.aso_tipos_exame;
drop policy if exists aso_tipos_exame_block_update on public.aso_tipos_exame;
drop policy if exists aso_tipos_exame_block_delete on public.aso_tipos_exame;

create policy aso_tipos_exame_select_all
  on public.aso_tipos_exame
  for select
  to anon, authenticated
  using (true);

create policy aso_tipos_exame_block_insert
  on public.aso_tipos_exame
  for insert
  to authenticated
  with check (false);

create policy aso_tipos_exame_block_update
  on public.aso_tipos_exame
  for update
  to authenticated
  using (false)
  with check (false);

create policy aso_tipos_exame_block_delete
  on public.aso_tipos_exame
  for delete
  to authenticated
  using (false);

drop policy if exists aso_controle_select_owner on public.aso_controle;
drop policy if exists aso_controle_insert_owner on public.aso_controle;
drop policy if exists aso_controle_update_owner on public.aso_controle;

create policy aso_controle_select_owner
  on public.aso_controle
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
    )
  );

create policy aso_controle_insert_owner
  on public.aso_controle
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
    )
  );

create policy aso_controle_update_owner
  on public.aso_controle
  for update
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
    )
  )
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
    )
  );

drop policy if exists aso_historico_select_owner on public.aso_historico;
drop policy if exists aso_historico_insert_owner on public.aso_historico;

create policy aso_historico_select_owner
  on public.aso_historico
  for select
  to authenticated
  using (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.read'::text)
      or public.has_permission('pessoas.write'::text)
    )
  );

create policy aso_historico_insert_owner
  on public.aso_historico
  for insert
  to authenticated
  with check (
    (public.is_master() or account_owner_id = public.my_owner_id())
    and (
      public.is_master()
      or public.has_permission('pessoas.write'::text)
    )
  );

create or replace function public.rpc_aso_create_full(
  p_pessoa_id uuid,
  p_tipo_exame_id uuid,
  p_data_exame date,
  p_observacao text default null,
  p_usuario_id uuid default null
) returns setof public.aso_controle_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
  v_pessoa_ativo boolean;
  v_pessoa_data_demissao timestamptz;
  v_tipo_codigo text;
  v_tipo_nome text;
  v_id uuid;
  v_after jsonb;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select
    p.account_owner_id,
    p.ativo,
    p."dataDemissao"
    into
      v_row_owner,
      v_pessoa_ativo,
      v_pessoa_data_demissao
  from public.pessoas p
  where p.id = p_pessoa_id;

  if v_row_owner is null then
    raise exception 'pessoa_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    codigo,
    nome
  into
    v_tipo_codigo,
    v_tipo_nome
  from public.aso_tipos_exame
  where id = p_tipo_exame_id
    and ativo = true;

  if v_tipo_codigo is null then
    raise exception 'tipo_exame_aso_not_found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = p_pessoa_id
      and aso.tipo_exame_id = p_tipo_exame_id
      and aso.data_exame = p_data_exame
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  if v_tipo_codigo in ('admissional', 'demissional')
     and exists (
       select 1
       from public.aso_controle aso
       where aso.account_owner_id = v_row_owner
         and aso.pessoa_id = p_pessoa_id
         and aso.tipo_exame_id = p_tipo_exame_id
     ) then
    raise exception 'aso_unique_tipo'
      using errcode = '23505',
            message = format('Ja existe um exame %s cadastrado para este funcionario.', lower(v_tipo_nome));
  end if;

  if v_tipo_codigo = 'demissional'
     and coalesce(v_pessoa_ativo, true) = true
     and v_pessoa_data_demissao is null then
    raise exception 'aso_demissional_requires_inactive'
      using errcode = '23514',
            message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
  end if;

  insert into public.aso_controle (
    pessoa_id,
    tipo_exame_id,
    data_exame,
    observacao,
    usuario_cadastro,
    account_owner_id
  ) values (
    p_pessoa_id,
    p_tipo_exame_id,
    p_data_exame,
    p_observacao,
    v_user,
    v_row_owner
  )
  returning id into v_id;

  select to_jsonb(vw)
    into v_after
  from public.aso_controle_view vw
  where vw.id = v_id;

  insert into public.aso_historico (
    aso_id,
    pessoa_id,
    acao,
    dados_antes,
    dados_depois,
    observacao,
    usuario_responsavel,
    account_owner_id
  ) values (
    v_id,
    p_pessoa_id,
    'cadastro',
    null,
    coalesce(v_after, '{}'::jsonb),
    p_observacao,
    v_user,
    v_row_owner
  );

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = v_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_aso_create_full(
  uuid,
  uuid,
  date,
  text,
  uuid
) from public;

grant execute on function public.rpc_aso_create_full(
  uuid,
  uuid,
  date,
  text,
  uuid
) to authenticated;

create or replace function public.rpc_aso_update_full(
  p_id uuid,
  p_tipo_exame_id uuid,
  p_data_exame date,
  p_observacao text default null,
  p_usuario_id uuid default null,
  p_acao text default 'edicao'
) returns setof public.aso_controle_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
  v_pessoa_id uuid;
  v_pessoa_ativo boolean;
  v_pessoa_data_demissao timestamptz;
  v_tipo_codigo text;
  v_tipo_nome text;
  v_before jsonb;
  v_after jsonb;
  v_acao text := case when p_acao in ('edicao', 'registro_exame') then p_acao else 'edicao' end;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select
    aso.account_owner_id,
    aso.pessoa_id,
    p.ativo,
    p."dataDemissao"
  into
    v_row_owner,
    v_pessoa_id,
    v_pessoa_ativo,
    v_pessoa_data_demissao
  from public.aso_controle aso
  join public.pessoas p on p.id = aso.pessoa_id
  where aso.id = p_id;

  if v_row_owner is null then
    raise exception 'aso_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    codigo,
    nome
  into
    v_tipo_codigo,
    v_tipo_nome
  from public.aso_tipos_exame
  where id = p_tipo_exame_id
    and ativo = true;

  if v_tipo_codigo is null then
    raise exception 'tipo_exame_aso_not_found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.aso_controle aso
    where aso.account_owner_id = v_row_owner
      and aso.pessoa_id = v_pessoa_id
      and aso.tipo_exame_id = p_tipo_exame_id
      and aso.data_exame = p_data_exame
      and aso.id <> p_id
  ) then
    raise exception 'aso_duplicate'
      using errcode = '23505',
            message = 'Ja existe um ASO deste tipo para o funcionario informado na mesma data.';
  end if;

  if v_tipo_codigo in ('admissional', 'demissional')
     and exists (
       select 1
       from public.aso_controle aso
       where aso.account_owner_id = v_row_owner
         and aso.pessoa_id = v_pessoa_id
         and aso.tipo_exame_id = p_tipo_exame_id
         and aso.id <> p_id
     ) then
    raise exception 'aso_unique_tipo'
      using errcode = '23505',
            message = format('Ja existe um exame %s cadastrado para este funcionario.', lower(v_tipo_nome));
  end if;

  if v_tipo_codigo = 'demissional'
     and coalesce(v_pessoa_ativo, true) = true
     and v_pessoa_data_demissao is null then
    raise exception 'aso_demissional_requires_inactive'
      using errcode = '23514',
            message = 'Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.';
  end if;

  select to_jsonb(vw)
    into v_before
  from public.aso_controle_view vw
  where vw.id = p_id;

  update public.aso_controle
     set tipo_exame_id = p_tipo_exame_id,
         data_exame = p_data_exame,
         observacao = p_observacao,
         usuario_edicao = v_user,
         atualizado_em = now()
   where id = p_id;

  select to_jsonb(vw)
    into v_after
  from public.aso_controle_view vw
  where vw.id = p_id;

  if coalesce(v_before, '{}'::jsonb) is distinct from coalesce(v_after, '{}'::jsonb) then
    insert into public.aso_historico (
      aso_id,
      pessoa_id,
      acao,
      dados_antes,
      dados_depois,
      observacao,
      usuario_responsavel,
      account_owner_id
    ) values (
      p_id,
      v_pessoa_id,
      v_acao,
      v_before,
      coalesce(v_after, '{}'::jsonb),
      p_observacao,
      v_user,
      v_row_owner
    );
  end if;

  return query
    select vw.*
    from public.aso_controle_view vw
    where vw.id = p_id
      and (v_is_master or vw.account_owner_id = v_owner);
end;
$$;

revoke all on function public.rpc_aso_update_full(
  uuid,
  uuid,
  date,
  text,
  uuid,
  text
) from public;

grant execute on function public.rpc_aso_update_full(
  uuid,
  uuid,
  date,
  text,
  uuid,
  text
) to authenticated;

create or replace function public.rpc_aso_register_exam(
  p_id uuid,
  p_data_realizada date,
  p_observacao text default null,
  p_usuario_id uuid default null
) returns setof public.aso_controle_view
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_tipo_exame_id uuid;
  v_observacao_atual text;
begin
  select
    tipo_exame_id,
    observacao
  into
    v_tipo_exame_id,
    v_observacao_atual
  from public.aso_controle
  where id = p_id;

  if v_tipo_exame_id is null then
    raise exception 'aso_not_found' using errcode = 'P0001';
  end if;

  return query
    select *
    from public.rpc_aso_update_full(
      p_id,
      v_tipo_exame_id,
      p_data_realizada,
      coalesce(p_observacao, v_observacao_atual),
      p_usuario_id,
      'registro_exame'
    );
end;
$$;

revoke all on function public.rpc_aso_register_exam(
  uuid,
  date,
  text,
  uuid
) from public;

grant execute on function public.rpc_aso_register_exam(
  uuid,
  date,
  text,
  uuid
) to authenticated;

select pg_notify('pgrst', 'reload schema');
