-- Cria snapshot mensal de HHT (Homem-Hora Trabalhada) e historico de alteracoes.

create table if not exists public.hht_mensal (
  id uuid primary key default gen_random_uuid(),
  mes_ref date not null,
  centro_servico_id uuid not null references public.centros_servico(id) on delete restrict,
  ativo boolean not null default true,
  qtd_pessoas integer not null default 0 check (qtd_pessoas >= 0),
  horas_mes_base numeric(10,2) not null default 0 check (horas_mes_base >= 0),
  escala_factor numeric(10,4) not null default 1 check (escala_factor >= 0),
  horas_afastamento numeric(10,2) not null default 0 check (horas_afastamento >= 0),
  horas_ferias numeric(10,2) not null default 0 check (horas_ferias >= 0),
  horas_treinamento numeric(10,2) not null default 0 check (horas_treinamento >= 0),
  horas_outros_descontos numeric(10,2) not null default 0 check (horas_outros_descontos >= 0),
  horas_extras numeric(10,2) not null default 0 check (horas_extras >= 0),
  modo text not null default 'simples' check (modo in ('manual', 'simples', 'completo')),
  hht_informado numeric(12,2) null check (hht_informado is null or hht_informado >= 0),
  hht_calculado numeric(12,2) not null default 0,
  hht_final numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint hht_mensal_mes_ref_primeiro_dia check (extract(day from mes_ref) = 1),
  constraint hht_mensal_hht_informado_only_manual check (hht_informado is null or modo = 'manual')
);

-- Garante coluna ativo em bases já existentes.
alter table public.hht_mensal add column if not exists ativo boolean;
update public.hht_mensal set ativo = true where ativo is null;
alter table public.hht_mensal alter column ativo set default true;
alter table public.hht_mensal alter column ativo set not null;

alter table if exists public.hht_mensal drop constraint if exists hht_mensal_mes_centro_unique;
drop index if exists hht_mensal_mes_centro_unique;
create unique index if not exists hht_mensal_mes_centro_unique
  on public.hht_mensal (mes_ref, centro_servico_id)
  where ativo = true;

create index if not exists hht_mensal_mes_ref_idx
  on public.hht_mensal (mes_ref desc);

create index if not exists hht_mensal_centro_mes_idx
  on public.hht_mensal (centro_servico_id, mes_ref desc);

create table if not exists public.hht_mensal_hist (
  id uuid primary key default gen_random_uuid(),
  hht_mensal_id uuid not null references public.hht_mensal(id) on delete cascade,
  acao text not null check (acao in ('UPDATE', 'DELETE')),
  alterado_em timestamptz not null default now(),
  alterado_por uuid null,
  antes jsonb not null,
  depois jsonb null,
  motivo text null
);

create index if not exists hht_mensal_hist_hht_idx
  on public.hht_mensal_hist (hht_mensal_id, alterado_em desc);

create or replace function public.hht_mensal_apply_calcs()
returns trigger as $$
declare
  base numeric(16,4);
  descontos numeric(16,4);
  calculado numeric(16,4);
begin
  -- Normaliza mes para sempre dia 01.
  if new.mes_ref is not null then
    new.mes_ref = date_trunc('month', new.mes_ref)::date;
  end if;

  new.modo = coalesce(nullif(lower(btrim(new.modo)), ''), 'simples');
  new.ativo = coalesce(new.ativo, true);

  new.qtd_pessoas = coalesce(new.qtd_pessoas, 0);
  new.horas_mes_base = coalesce(new.horas_mes_base, 0);
  new.escala_factor = coalesce(new.escala_factor, 1);

  new.horas_afastamento = coalesce(new.horas_afastamento, 0);
  new.horas_ferias = coalesce(new.horas_ferias, 0);
  new.horas_treinamento = coalesce(new.horas_treinamento, 0);
  new.horas_outros_descontos = coalesce(new.horas_outros_descontos, 0);
  new.horas_extras = coalesce(new.horas_extras, 0);

  if new.modo = 'simples' then
    -- Simples: apenas qtd_pessoas * horas_mes_base.
    new.escala_factor = 1;
    new.horas_afastamento = 0;
    new.horas_ferias = 0;
    new.horas_treinamento = 0;
    new.horas_outros_descontos = 0;
    new.horas_extras = 0;

    calculado = (new.qtd_pessoas::numeric * new.horas_mes_base);
  else
    base = (new.qtd_pessoas::numeric * new.horas_mes_base * new.escala_factor);
    descontos = (new.horas_afastamento + new.horas_ferias + new.horas_treinamento + new.horas_outros_descontos);
    calculado = base - descontos + new.horas_extras;
  end if;

  new.hht_calculado = round(calculado::numeric, 2);

  if new.modo = 'manual' then
    if new.hht_informado is null then
      raise exception 'Informe o HHT para modo manual.';
    end if;
    new.hht_final = round(new.hht_informado::numeric, 2);
  else
    new.hht_informado = null;
    new.hht_final = new.hht_calculado;
  end if;

  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;

  new.updated_at = now();
  new.updated_by = coalesce(new.updated_by, auth.uid());

  return new;
end;
$$ language plpgsql;

drop trigger if exists hht_mensal_apply_calcs_trigger on public.hht_mensal;
create trigger hht_mensal_apply_calcs_trigger
  before insert or update on public.hht_mensal
  for each row
  execute function public.hht_mensal_apply_calcs();

create or replace function public.hht_mensal_log_update_delete()
returns trigger as $$
declare
  old_base jsonb;
  new_base jsonb;
  motivo text;
begin
  motivo = nullif(current_setting('app.hht_motivo', true), '');

  if tg_op = 'UPDATE' then
    old_base = to_jsonb(old) - 'updated_at' - 'updated_by';
    new_base = to_jsonb(new) - 'updated_at' - 'updated_by';
    if old_base is distinct from new_base then
      insert into public.hht_mensal_hist (hht_mensal_id, acao, alterado_por, antes, depois, motivo)
      values (new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new), motivo);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.hht_mensal_hist (hht_mensal_id, acao, alterado_por, antes, depois, motivo)
    values (old.id, 'DELETE', auth.uid(), to_jsonb(old), null, motivo);
    return old;
  end if;

  return null;
end;
$$ language plpgsql;

drop function if exists public.hht_mensal_prevent_inactivation();
create or replace function public.hht_mensal_prevent_inactivation()
returns trigger as $$
declare
  v_centro_nome text;
  v_mes_ref date;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  if tg_op = 'DELETE' then
    if coalesce(old.ativo, true) = false then
      return old;
    end if;

    select nome into v_centro_nome from public.centros_servico where id = old.centro_servico_id;
    v_mes_ref := old.mes_ref;

    select exists(
      select 1
        from public.acidentes a
       where date_trunc('month', a.data) = v_mes_ref
         and lower(btrim(coalesce(a.centro_servico, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar/excluir: ha acidentes cadastrados para este centro e mes.';
    end if;
    return old;
  end if;

  if new.ativo = false and coalesce(old.ativo, true) = true then
    select nome into v_centro_nome from public.centros_servico where id = new.centro_servico_id;
    v_mes_ref := new.mes_ref;
    v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;

    select exists(
      select 1
        from public.acidentes a
       where date_trunc('month', a.data) = v_mes_ref
         and lower(btrim(coalesce(a.centro_servico, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
    end if;

    if v_status_cancelado is not null then
      new.status_hht_id = coalesce(new.status_hht_id, v_status_cancelado);
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists hht_mensal_prevent_inactivation_trigger on public.hht_mensal;
create trigger hht_mensal_prevent_inactivation_trigger
  before update or delete on public.hht_mensal
  for each row
  execute function public.hht_mensal_prevent_inactivation();

drop trigger if exists hht_mensal_hist_trigger on public.hht_mensal;
create trigger hht_mensal_hist_trigger
  after update or delete on public.hht_mensal
  for each row
  execute function public.hht_mensal_log_update_delete();

drop function if exists public.hht_mensal_delete(uuid, text);
create or replace function public.hht_mensal_delete(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_registro record;
  v_centro_nome text;
  v_mes_ref date;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  select id, mes_ref, centro_servico_id, ativo
    into v_registro
    from public.hht_mensal
   where id = p_id;

  if not found then
    raise exception 'Registro nao encontrado.';
  end if;

  if coalesce(v_registro.ativo, true) = false then
    raise exception 'Registro ja cancelado.';
  end if;

  select nome into v_centro_nome from public.centros_servico where id = v_registro.centro_servico_id;
  v_mes_ref := v_registro.mes_ref;

  select exists(
    select 1
      from public.acidentes a
     where date_trunc('month', a.data) = v_mes_ref
       and lower(btrim(coalesce(a.centro_servico, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
  ) into v_tem_acidente;

  if coalesce(v_tem_acidente, false) then
    raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  perform set_config('app.hht_motivo', coalesce(trim(both from p_motivo), ''), true);
  update public.hht_mensal
     set ativo = false,
         status_hht_id = coalesce(status_hht_id, v_status_cancelado)
   where id = p_id;
end;
$$;

grant execute on function public.hht_mensal_delete(uuid, text) to authenticated, service_role;

alter table if exists public.hht_mensal enable row level security;
alter table if exists public.hht_mensal_hist enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal'
      and policyname = 'hht_mensal_select_authenticated'
  ) then
    create policy hht_mensal_select_authenticated on public.hht_mensal
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal'
      and policyname = 'hht_mensal_write_authenticated'
  ) then
    create policy hht_mensal_write_authenticated on public.hht_mensal
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal'
      and policyname = 'hht_mensal_service_role'
  ) then
    create policy hht_mensal_service_role on public.hht_mensal
      for all to service_role using (true) with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal_hist'
      and policyname = 'hht_mensal_hist_select_authenticated'
  ) then
    create policy hht_mensal_hist_select_authenticated on public.hht_mensal_hist
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal_hist'
      and policyname = 'hht_mensal_hist_insert_authenticated'
  ) then
    create policy hht_mensal_hist_insert_authenticated on public.hht_mensal_hist
      for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hht_mensal_hist'
      and policyname = 'hht_mensal_hist_service_role'
  ) then
    create policy hht_mensal_hist_service_role on public.hht_mensal_hist
      for all to service_role using (true) with check (true);
  end if;
end
$$;
