-- Migra coluna ativo (boolean) para status_hht_id (uuid) referenciando status_hht.

do $$
declare
  v_status_ativo uuid;
  v_status_cancelado uuid;
begin
  -- Tenta obter ids dos status padrao via settings; se nao houver, busca pela tabela.
  v_status_ativo := nullif(current_setting('app.status_hht_default', true), '')::uuid;
  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;

  if v_status_ativo is null then
    select id into v_status_ativo from public.status_hht where lower(status) = 'ativo' limit 1;
  end if;
  if v_status_cancelado is null then
    select id into v_status_cancelado from public.status_hht where lower(status) = 'cancelado' limit 1;
  end if;

  -- Garante coluna status_hht_id.
  alter table if exists public.hht_mensal add column if not exists status_hht_id uuid;

  -- Preenche valor default para registros existentes.
  if v_status_ativo is not null then
    update public.hht_mensal set status_hht_id = coalesce(status_hht_id, v_status_ativo);
  end if;

  -- Remove antigo indice/constraint de unicidade baseado em ativo.
  alter table if exists public.hht_mensal drop constraint if exists hht_mensal_mes_centro_unique;
  drop index if exists hht_mensal_mes_centro_unique;

  -- Remove coluna ativo (ja nao sera usada).
  alter table if exists public.hht_mensal drop column if exists ativo;

  -- Ajusta obrigatoriedade/default do status.
  if v_status_ativo is not null then
    execute format(
      'alter table if exists public.hht_mensal alter column status_hht_id set default %L::uuid',
      v_status_ativo
    );
  else
    alter table if exists public.hht_mensal alter column status_hht_id drop default;
  end if;
  alter table if exists public.hht_mensal alter column status_hht_id set not null;

  -- Cria unicidade de mes+centro apenas para status diferente de "Cancelado" (se existir).
  if v_status_cancelado is not null then
    execute format(
      'create unique index if not exists hht_mensal_mes_centro_unique on public.hht_mensal (mes_ref, centro_servico_id) where status_hht_id is distinct from %L',
      v_status_cancelado
    );
  else
    create unique index if not exists hht_mensal_mes_centro_unique
      on public.hht_mensal (mes_ref, centro_servico_id);
  end if;
end$$;

-- Recria funcoes para usar status_hht_id em vez de ativo.

create or replace function public.hht_mensal_apply_calcs()
returns trigger as $$
declare
  base numeric(16,4);
  descontos numeric(16,4);
  calculado numeric(16,4);
  v_status_default uuid;
begin
  v_status_default := nullif(current_setting('app.status_hht_default', true), '')::uuid;

  -- Normaliza mes para sempre dia 01.
  if new.mes_ref is not null then
    new.mes_ref = date_trunc('month', new.mes_ref)::date;
  end if;

  new.modo = coalesce(nullif(lower(btrim(new.modo)), ''), 'simples');
  new.status_hht_id = coalesce(new.status_hht_id, v_status_default);

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

create or replace function public.hht_mensal_prevent_inactivation()
returns trigger as $$
declare
  v_centro_nome text;
  v_mes_ref date;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado from public.status_hht where lower(status) = 'cancelado' limit 1;
  end if;

  if tg_op = 'DELETE' then
    -- Bloqueia delete se houver acidente no mes/centro.
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

  if v_status_cancelado is not null
     and new.status_hht_id = v_status_cancelado
     and (old.status_hht_id is distinct from v_status_cancelado) then
    select nome into v_centro_nome from public.centros_servico where id = new.centro_servico_id;
    v_mes_ref := new.mes_ref;

    select exists(
      select 1
        from public.acidentes a
       where date_trunc('month', a.data) = v_mes_ref
         and lower(btrim(coalesce(a.centro_servico, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
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

-- Recria log para garantir registro no historico apos a migracao.
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

drop trigger if exists hht_mensal_hist_trigger on public.hht_mensal;
create trigger hht_mensal_hist_trigger
  after update or delete on public.hht_mensal
  for each row
  execute function public.hht_mensal_log_update_delete();

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
  select id, mes_ref, centro_servico_id, status_hht_id
    into v_registro
    from public.hht_mensal
   where id = p_id;

  if not found then
    raise exception 'Registro nao encontrado.';
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado from public.status_hht where lower(status) = 'cancelado' limit 1;
  end if;

  if v_status_cancelado is not null and v_registro.status_hht_id = v_status_cancelado then
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

  perform set_config('app.hht_motivo', coalesce(trim(both from p_motivo), ''), true);
  update public.hht_mensal
     set status_hht_id = coalesce(v_status_cancelado, status_hht_id)
   where id = p_id;
end;
$$;

grant execute on function public.hht_mensal_delete(uuid, text) to authenticated, service_role;

-- View para expor campos com textos resolvidos (status, centro, usuarios).
drop view if exists public.hht_mensal_view;
create or replace view public.hht_mensal_view as
select
  hm.id,
  hm.mes_ref,
  hm.centro_servico_id,
  cs.nome as centro_servico_nome,
  hm.status_hht_id,
  sh.status as status_nome,
  hm.qtd_pessoas,
  hm.horas_mes_base,
  hm.escala_factor,
  hm.horas_afastamento,
  hm.horas_ferias,
  hm.horas_treinamento,
  hm.horas_outros_descontos,
  hm.horas_extras,
  hm.modo,
  hm.hht_informado,
  hm.hht_calculado,
  hm.hht_final,
  hm.created_at,
  hm.created_by,
  u_created.display_name as created_by_name,
  u_created.username as created_by_username,
  hm.updated_at,
  hm.updated_by,
  u_updated.display_name as updated_by_name,
  u_updated.username as updated_by_username
from public.hht_mensal hm
left join public.centros_servico cs on cs.id = hm.centro_servico_id
left join public.status_hht sh on sh.id = hm.status_hht_id
left join public.app_users u_created on u_created.id = hm.created_by
left join public.app_users u_updated on u_updated.id = hm.updated_by;

grant select on public.hht_mensal_view to authenticated, service_role;
