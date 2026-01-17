-- Atualiza _ensure_item para respeitar tenant/owner e evitar bloqueio por RLS
-- quando o trigger de pessoas cria centros/setores/cargos automaticamente.

create or replace function public._ensure_item(nome_input text, tabela text)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  nome_limpo text := trim(coalesce(nome_input, ''));
  registro_id uuid;
  ordem_proxima smallint;
  v_owner uuid := public.my_owner_id();
  v_is_master boolean := public.is_master();
  v_table text := lower(tabela);
  v_has_owner boolean := v_table = any (array['centros_servico','setores','cargos','centros_custo']);
begin
  if nome_limpo = '' then
    raise exception 'Valor nao pode ser vazio.';
  end if;

  if v_table not in ('centros_servico','setores','cargos','centros_custo','tipo_execucao') then
    raise exception 'Tabela invalida.';
  end if;

  if not (v_is_master or public.has_permission('pessoas.write'::text)) then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  if v_has_owner and v_owner is null and not v_is_master then
    raise exception 'owner nao encontrado' using errcode = '42501';
  end if;

  if v_has_owner then
    execute format('select id from %I where lower(nome) = lower($1) and account_owner_id = $2 limit 1', v_table)
      into registro_id
      using nome_limpo, v_owner;
  else
    execute format('select id from %I where lower(nome) = lower($1) limit 1', v_table)
      into registro_id
      using nome_limpo;
  end if;

  if registro_id is not null then
    return registro_id;
  end if;

  execute format('select coalesce(max(ordem), 0) + 1 from %I', v_table)
    into ordem_proxima;

  if v_has_owner then
    execute format('insert into %I (nome, ordem, ativo, account_owner_id) values ($1, $2, true, $3) returning id', v_table)
      into registro_id
      using nome_limpo, ordem_proxima, v_owner;
  else
    execute format('insert into %I (nome, ordem, ativo) values ($1, $2, true) returning id', v_table)
      into registro_id
      using nome_limpo, ordem_proxima;
  end if;

  return registro_id;
end;
$$;

revoke all on function public._ensure_item(text, text) from public;
grant execute on function public._ensure_item(text, text) to authenticated;
