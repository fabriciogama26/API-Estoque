-- Add indexes covering FKs flagged by lint 0001 for large tables.
-- Focus: saidas, entradas, *_historico, accident_group_*.

do $$
declare
  c record;
  idx_name text;
begin
  for c in (
    select
      pc.conname,
      pc.conrelid,
      pc.conrelid::regclass as relname,
      pc.conkey,
      array_agg(quote_ident(pa.attname) order by pc.ord) as cols
    from (
      select
        conname,
        conrelid,
        conkey,
        attnum,
        ord
      from pg_constraint
      join unnest(conkey) with ordinality as cols(attnum, ord) on true
      where contype = 'f'
        and conname in (
          'accident_group_agents_accident_agents_id_fkey',
          'accident_group_agents_accidents_injuries_id_fkey',
          'accident_group_agents_accidents_type_id_fkey',
          'group_accident_parts_accident_parts_group_id_fkey',
          'group_accident_parts_accident_parts_id_fkey',
          'group_accident_parts_accident_parts_subgroup_id_fkey',
          'acidente_historico_account_owner_id_fkey',
          'entrada_historico_account_owner_id_fkey',
          'entradas_account_owner_id_fkey',
          'saidas_account_owner_id_fkey',
          'saidas_trocaDeSaida_fkey',
          'saidas_historico_account_owner_id_fkey',
          'pessoas_historico_account_owner_id_fkey'
        )
    ) as pc
    join pg_attribute pa
      on pa.attrelid = pc.conrelid
     and pa.attnum = pc.attnum
    group by pc.conname, pc.conrelid, pc.conkey
  )
  loop
    -- Avoid name collision with existing indexes.
    idx_name := left(c.conname || '_fkcov_idx', 63);
    if exists (
      select 1
      from pg_class pc
      where pc.relkind = 'i'
        and pc.relname = idx_name
    ) then
      idx_name := left(c.conname || '_fkcov2_idx', 63);
    end if;

    if not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and i.indisvalid
        and i.indisready
        and (i.indkey::int2[])[1:array_length(c.conkey, 1)] = c.conkey
    ) then
      execute format(
        'create index if not exists %I on %s (%s);',
        idx_name,
        c.relname,
        array_to_string(c.cols, ', ')
      );
    end if;
  end loop;
end
$$;

-- Indices flagged as "unused_index" are not removed here.
