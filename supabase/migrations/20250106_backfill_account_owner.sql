-- Backfill de account_owner_id em todas as tabelas que possuem essa coluna.
-- Seta para o valor fixo informado: 59191387-669b-4585-8e11-7070d9769d86

set check_function_bodies = off;

do $$
declare
  r record;
  v_owner constant uuid := '59191387-669b-4585-8e11-7070d9769d86';
begin
  -- Desliga RLS para permitir atualizacao massiva.
  perform set_config('row_security', 'off', true);

  for r in
    select table_schema, table_name
      from information_schema.columns
     where column_name = 'account_owner_id'
       and table_schema = 'public'
  loop
    execute format('update %I.%I set account_owner_id = %L', r.table_schema, r.table_name, v_owner);
  end loop;
end$$;

