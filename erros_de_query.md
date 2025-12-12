| query                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | rolname       | calls | mean_time         | min_time     | max_time     | total_time       | rows_read | cache_hit_rate       | prop_total_time    | index_advisor_result |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ----- | ----------------- | ------------ | ------------ | ---------------- | --------- | -------------------- | ------------------ | -------------------- |
| with f as (
      
-- CTE with sane arg_modes, arg_names, and arg_types.
-- All three are always of the same length.
-- All three include all args, including OUT and TABLE args.
with functions as (
  select
    *,
    -- proargmodes is null when all arg modes are IN
    coalesce(
      p.proargmodes,
      array_fill($1::text, array[cardinality(coalesce(p.proallargtypes, p.proargtypes))])
    ) as arg_modes,
    -- proargnames is null when all args are unnamed
    coalesce(
      p.proargnames,
      array_fill($2::text, array[cardinality(coalesce(p.proallargtypes, p.proargtypes))])
    ) as arg_names,
    -- proallargtypes is null when all arg modes are IN
    coalesce(p.proallargtypes, p.proargtypes) as arg_types,
    array_cat(
      array_fill($3, array[pronargs - pronargdefaults]),
      array_fill($4, array[pronargdefaults])) as arg_has_defaults
  from
    pg_proc as p
  where
    p.prokind = $5
)
select
  f.oid as id,
  n.nspname as schema,
  f.proname as name,
  l.lanname as language,
  case
    when l.lanname = $6 then $7
    else f.prosrc
  end as definition,
  case
    when l.lanname = $8 then f.prosrc
    else pg_get_functiondef(f.oid)
  end as complete_statement,
  coalesce(f_args.args, $9) as args,
  pg_get_function_arguments(f.oid) as argument_types,
  pg_get_function_identity_arguments(f.oid) as identity_argument_types,
  f.prorettype as return_type_id,
  pg_get_function_result(f.oid) as return_type,
  nullif(rt.typrelid, $10) as return_type_relation_id,
  f.proretset as is_set_returning_function,
  case
    when f.provolatile = $11 then $12
    when f.provolatile = $13 then $14
    when f.provolatile = $15 then $16
  end as behavior,
  f.prosecdef as security_definer,
  f_config.config_params as config_params
from
  functions f
  left join pg_namespace n on f.pronamespace = n.oid
  left join pg_language l on f.prolang = l.oid
  left join pg_type rt on rt.oid = f.prorettype
  left join (
    select
      oid,
      jsonb_object_agg(param, value) filter (where param is not null) as config_params
    from
      (
        select
          oid,
          (string_to_array(unnest(proconfig), $17))[$18] as param,
          (string_to_array(unnest(proconfig), $19))[$20] as value
        from
          functions
      ) as t
    group by
      oid
  ) f_config on f_config.oid = f.oid
  left join (
    select
      oid,
      jsonb_agg(jsonb_build_object(
        $21, t2.mode,
        $22, name,
        $23, type_id,
        -- Cast null into false boolean
        $24, COALESCE(has_default, $25)
      )) as args
    from
      (
        select
          oid,
          unnest(arg_modes) as mode,
          unnest(arg_names) as name,
          -- Coming from: coalesce(p.proallargtypes, p.proargtypes) postgres won't automatically assume
          -- integer, we need to cast it to be properly parsed
          unnest(arg_types)::int8 as type_id,
          unnest(arg_has_defaults) as has_default
        from
          functions
      ) as t1,
      lateral (
        select
          case
            when t1.mode = $26 then $27
            when t1.mode = $28 then $29
            when t1.mode = $30 then $31
            when t1.mode = $32 then $33
            else $34
          end as mode
      ) as t2
    group by
      t1.oid
  ) f_args on f_args.oid = f.oid

    )
    select
      f.*
    from f
   where schema NOT IN ($35,$36,$37)

-- source: dashboard
-- user: 0895fb2d-bd7f-4371-850e-6129d0cf14fd
-- date: 2025-10-19T17:36:36.553Z                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | postgres      | 559   | 353.991122862254  | 179.825434   | 1774.032109  | 197881.03768     | 66846     | 100.0000000000000000 | 18.06740799478378  | null                 |
| SELECT name FROM pg_timezone_names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | authenticator | 804   | 191.043954105722  | 52.374632    | 1037.070124  | 153599.339101    | 959976    | 0                    | 14.024294393254019 | null                 |
| WITH pgrst_source AS ( SELECT "public"."pessoas"."id", "public"."pessoas"."nome", "public"."pessoas"."matricula", "public"."pessoas"."dataAdmissao", "public"."pessoas"."usuarioCadastro", "public"."pessoas"."usuarioEdicao", "public"."pessoas"."criadoEm", "public"."pessoas"."atualizadoEm", "public"."pessoas"."centro_servico_id", "public"."pessoas"."setor_id", "public"."pessoas"."cargo_id", "public"."pessoas"."centro_custo_id", "public"."pessoas"."tipo_execucao_id", row_to_json("pessoas_centros_servico_1".*)::jsonb AS "centros_servico", row_to_json("pessoas_setores_1".*)::jsonb AS "setores", row_to_json("pessoas_cargos_1".*)::jsonb AS "cargos", row_to_json("pessoas_centros_custo_1".*)::jsonb AS "centros_custo", row_to_json("pessoas_tipo_execucao_1".*)::jsonb AS "tipo_execucao" FROM "public"."pessoas" LEFT JOIN LATERAL ( SELECT "centros_servico_1"."id", "centros_servico_1"."nome" FROM "public"."centros_servico" AS "centros_servico_1" WHERE "centros_servico_1"."id" = "public"."pessoas"."centro_servico_id"   LIMIT $1 OFFSET $2 ) AS "pessoas_centros_servico_1" ON $13  LEFT JOIN LATERAL ( SELECT "setores_1"."id", "setores_1"."nome" FROM "public"."setores" AS "setores_1" WHERE "setores_1"."id" = "public"."pessoas"."setor_id"   LIMIT $3 OFFSET $4 ) AS "pessoas_setores_1" ON $14  LEFT JOIN LATERAL ( SELECT "cargos_1"."id", "cargos_1"."nome" FROM "public"."cargos" AS "cargos_1" WHERE "cargos_1"."id" = "public"."pessoas"."cargo_id"   LIMIT $5 OFFSET $6 ) AS "pessoas_cargos_1" ON $15  LEFT JOIN LATERAL ( SELECT "centros_custo_1"."id", "centros_custo_1"."nome" FROM "public"."centros_custo" AS "centros_custo_1" WHERE "centros_custo_1"."id" = "public"."pessoas"."centro_custo_id"   LIMIT $7 OFFSET $8 ) AS "pessoas_centros_custo_1" ON $16  LEFT JOIN LATERAL ( SELECT "tipo_execucao_1"."id", "tipo_execucao_1"."nome" FROM "public"."tipo_execucao" AS "tipo_execucao_1" WHERE "tipo_execucao_1"."id" = "public"."pessoas"."tipo_execucao_id"   LIMIT $9 OFFSET $10 ) AS "pessoas_tipo_execucao_1" ON $17  ORDER BY "public"."pessoas"."nome" ASC  LIMIT $11 OFFSET $12 )  SELECT $18::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $19) AS body, nullif(current_setting($20, $21), $22) AS response_headers, nullif(current_setting($23, $24), $25) AS response_status, $26 AS response_inserted FROM ( SELECT * FROM pgrst_source ) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | authenticated | 2213  | 64.3131521156798  | 52.697986    | 864.242783   | 142325.005632    | 2213      | 100.0000000000000000 | 12.99489822148401  | null                 |
| WITH pgrst_source AS (SELECT "pgrst_call".* FROM "public"."rpc_pessoas_completa"() pgrst_call) SELECT $3::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $4) AS body, nullif(current_setting($5, $6), $7) AS response_headers, nullif(current_setting($8, $9), $10) AS response_status, $11 AS response_inserted FROM (SELECT "record".* FROM "pgrst_source" AS "record"  ORDER BY "record"."nome" ASC  LIMIT $1 OFFSET $2) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | authenticated | 1653  | 72.8683359866908  | 24.745817    | 3795.387472  | 120451.359386    | 1653      | 100.0000000000000000 | 10.997738232363965 | null                 |
| with tables as (
SELECT
  c.oid :: int8 AS id,
  nc.nspname AS schema,
  c.relname AS name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relreplident = $1 THEN $2
    WHEN c.relreplident = $3 THEN $4
    WHEN c.relreplident = $5 THEN $6
    ELSE $7
  END AS replica_identity,
  pg_total_relation_size(format($8, nc.nspname, c.relname)) :: int8 AS bytes,
  pg_size_pretty(
    pg_total_relation_size(format($9, nc.nspname, c.relname))
  ) AS size,
  pg_stat_get_live_tuples(c.oid) AS live_rows_estimate,
  pg_stat_get_dead_tuples(c.oid) AS dead_rows_estimate,
  obj_description(c.oid) AS comment,
  coalesce(pk.primary_keys, $10) as primary_keys,
  coalesce(
    jsonb_agg(relationships) filter (where relationships is not null),
    $11
  ) as relationships
FROM
  pg_namespace nc
  JOIN pg_class c ON nc.oid = c.relnamespace
  left join (
    select
      c.oid::int8 as table_id,
      jsonb_agg(
        jsonb_build_object(
          $12, c.oid::int8,
          $13, n.nspname,
          $14, c.relname,
          $15, a.attname
        )
        order by array_position(i.indkey, a.attnum)
      ) as primary_keys
    from
      pg_index i
      join pg_class c on i.indrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
	where
      i.indisprimary
    group by c.oid
  ) as pk
  on pk.table_id = c.oid
  left join (
    select
      c.oid :: int8 as id,
      c.conname as constraint_name,
      nsa.nspname as source_schema,
      csa.relname as source_table_name,
      sa.attname as source_column_name,
      nta.nspname as target_table_schema,
      cta.relname as target_table_name,
      ta.attname as target_column_name
    from
      pg_constraint c
    join (
      pg_attribute sa
      join pg_class csa on sa.attrelid = csa.oid
      join pg_namespace nsa on csa.relnamespace = nsa.oid
    ) on sa.attrelid = c.conrelid and sa.attnum = any (c.conkey)
    join (
      pg_attribute ta
      join pg_class cta on ta.attrelid = cta.oid
      join pg_namespace nta on cta.relnamespace = nta.oid
    ) on ta.attrelid = c.confrelid and ta.attnum = any (c.confkey)
    where
      c.contype = $16
  ) as relationships
  on (relationships.source_schema = nc.nspname and relationships.source_table_name = c.relname)
  or (relationships.target_table_schema = nc.nspname and relationships.target_table_name = c.relname)
WHERE
  c.relkind IN ($17, $18)
  AND NOT pg_is_other_temp_schema(nc.oid)
  AND (
    pg_has_role(c.relowner, $19)
    OR has_table_privilege(
      c.oid,
      $20
    )
    OR has_any_column_privilege(c.oid, $21)
  )
group by
  c.oid,
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  c.relreplident,
  nc.nspname,
  pk.primary_keys
)
  , columns as (
-- Adapted from information_schema.columns

SELECT
  c.oid :: int8 AS table_id,
  nc.nspname AS schema,
  c.relname AS table,
  (c.oid || $22 || a.attnum) AS id,
  a.attnum AS ordinal_position,
  a.attname AS name,
  CASE
    WHEN a.atthasdef THEN pg_get_expr(ad.adbin, ad.adrelid)
    ELSE $23
  END AS default_value,
  CASE
    WHEN t.typtype = $24 THEN CASE
      WHEN bt.typelem <> $25 :: oid
      AND bt.typlen = $26 THEN $27
      WHEN nbt.nspname = $28 THEN format_type(t.typbasetype, $29)
      ELSE $30
    END
    ELSE CASE
      WHEN t.typelem <> $31 :: oid
      AND t.typlen = $32 THEN $33
      WHEN nt.nspname = $34 THEN format_type(a.atttypid, $35)
      ELSE $36
    END
  END AS data_type,
  COALESCE(bt.typname, t.typname) AS format,
  a.attidentity IN ($37, $38) AS is_identity,
  CASE
    a.attidentity
    WHEN $39 THEN $40
    WHEN $41 THEN $42
    ELSE $43
  END AS identity_generation,
  a.attgenerated IN ($44) AS is_generated,
  NOT (
    a.attnotnull
    OR t.typtype = $45 AND t.typnotnull
  ) AS is_nullable,
  (
    c.relkind IN ($46, $47)
    OR c.relkind IN ($48, $49) AND pg_column_is_updatable(c.oid, a.attnum, $50)
  ) AS is_updatable,
  uniques.table_id IS NOT NULL AS is_unique,
  check_constraints.definition AS "check",
  array_to_json(
    array(
      SELECT
        enumlabel
      FROM
        pg_catalog.pg_enum enums
      WHERE
        enums.enumtypid = coalesce(bt.oid, t.oid)
        OR enums.enumtypid = coalesce(bt.typelem, t.typelem)
      ORDER BY
        enums.enumsortorder
    )
  ) AS enums,
  col_description(c.oid, a.attnum) AS comment
FROM
  pg_attribute a
  LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid
  AND a.attnum = ad.adnum
  JOIN (
    pg_class c
    JOIN pg_namespace nc ON c.relnamespace = nc.oid
  ) ON a.attrelid = c.oid
  JOIN (
    pg_type t
    JOIN pg_namespace nt ON t.typnamespace = nt.oid
  ) ON a.atttypid = t.oid
  LEFT JOIN (
    pg_type bt
    JOIN pg_namespace nbt ON bt.typnamespace = nbt.oid
  ) ON t.typtype = $51
  AND t.typbasetype = bt.oid
  LEFT JOIN (
    SELECT DISTINCT ON (table_id, ordinal_position)
      conrelid AS table_id,
      conkey[$52] AS ordinal_position
    FROM pg_catalog.pg_constraint
    WHERE contype = $53 AND cardinality(conkey) = $54
  ) AS uniques ON uniques.table_id = c.oid AND uniques.ordinal_position = a.attnum
  LEFT JOIN (
    -- We only select the first column check
    SELECT DISTINCT ON (table_id, ordinal_position)
      conrelid AS table_id,
      conkey[$55] AS ordinal_position,
      substring(
        pg_get_constraintdef(pg_constraint.oid, $56),
        $57,
        length(pg_get_constraintdef(pg_constraint.oid, $58)) - $59
      ) AS "definition"
    FROM pg_constraint
    WHERE contype = $60 AND cardinality(conkey) = $61
    ORDER BY table_id, ordinal_position, oid asc
  ) AS check_constraints ON check_constraints.table_id = c.oid AND check_constraints.ordinal_position = a.attnum
WHERE
  NOT pg_is_other_temp_schema(nc.oid)
  AND a.attnum > $62
  AND NOT a.attisdropped
  AND (c.relkind IN ($63, $64, $65, $66, $67))
  AND (
    pg_has_role(c.relowner, $68)
    OR has_column_privilege(
      c.oid,
      a.attnum,
      $69
    )
  )
)
  select
    *
    , 
COALESCE(
  (
    SELECT
      array_agg(row_to_json(columns)) FILTER (WHERE columns.table_id = tables.id)
    FROM
      columns
  ),
  $70
) AS columns
  from tables where name = $71 and schema = $72                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | postgres      | 1347  | 87.1237695798069  | 44.954972    | 2525.158548  | 117355.717624    | 1347      | 100.0000000000000000 | 10.715092540914782 | null                 |
| with base_table_info as ( select c.oid::int8 as id, nc.nspname as schema, c.relname as name, c.relkind, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced, c.relreplident, c.relowner, obj_description(c.oid) as comment, fs.srvname as foreign_server_name, fdw.fdwname as foreign_data_wrapper_name, fdw_handler.proname as foreign_data_wrapper_handler from pg_class c join pg_namespace nc on nc.oid = c.relnamespace left join pg_foreign_table ft on ft.ftrelid = c.oid left join pg_foreign_server fs on fs.oid = ft.ftserver left join pg_foreign_data_wrapper fdw on fdw.oid = fs.srvfdw left join pg_proc fdw_handler on fdw.fdwhandler = fdw_handler.oid where c.oid = $1 and not pg_is_other_temp_schema(nc.oid) and ( pg_has_role(c.relowner, $2) or has_table_privilege( c.oid, $3 ) or has_any_column_privilege(c.oid, $4) ) ), table_stats as ( select b.id, case when b.relreplident = $5 then $6 when b.relreplident = $7 then $8 when b.relreplident = $9 then $10 else $11 end as replica_identity, pg_total_relation_size(format($12, b.schema, b.name))::int8 as bytes, pg_size_pretty(pg_total_relation_size(format($13, b.schema, b.name))) as size, pg_stat_get_live_tuples(b.id) as live_rows_estimate, pg_stat_get_dead_tuples(b.id) as dead_rows_estimate from base_table_info b where b.relkind in ($14, $15) ), primary_keys as ( select i.indrelid as table_id, jsonb_agg(jsonb_build_object( $16, n.nspname, $17, c.relname, $18, i.indrelid::int8, $19, a.attname )) as primary_keys from pg_index i join pg_class c on i.indrelid = c.oid join pg_attribute a on (a.attrelid = c.oid and a.attnum = any(i.indkey)) join pg_namespace n on c.relnamespace = n.oid where i.indisprimary group by i.indrelid ), relationships as ( select c.conrelid as source_id, c.confrelid as target_id, jsonb_build_object( $20, c.oid::int8, $21, c.conname, $22, c.confdeltype, $23, c.confupdtype, $24, nsa.nspname, $25, csa.relname, $26, sa.attname, $27, nta.nspname, $28, cta.relname, $29, ta.attname ) as rel_info from pg_constraint c join pg_class csa on c.conrelid = csa.oid join pg_namespace nsa on csa.relnamespace = nsa.oid join pg_attribute sa on (sa.attrelid = c.conrelid and sa.attnum = any(c.conkey)) join pg_class cta on c.confrelid = cta.oid join pg_namespace nta on cta.relnamespace = nta.oid join pg_attribute ta on (ta.attrelid = c.confrelid and ta.attnum = any(c.confkey)) where c.contype = $30 ), columns as ( select a.attrelid as table_id, jsonb_agg(jsonb_build_object( $31, (a.attrelid || $32 || a.attnum), $33, c.oid::int8, $34, nc.nspname, $35, c.relname, $36, a.attnum, $37, a.attname, $38, case when a.atthasdef then pg_get_expr(ad.adbin, ad.adrelid) else $39 end, $40, case when t.typtype = $41 then case when bt.typelem <> $42::oid and bt.typlen = $43 then $44 when nbt.nspname = $45 then format_type(t.typbasetype, $46) else $47 end else case when t.typelem <> $48::oid and t.typlen = $49 then $50 when nt.nspname = $51 then format_type(a.atttypid, $52) else $53 end end, $54, case when t.typtype = $55 then case when nt.nspname <> $56 then concat(nt.nspname, $57, coalesce(bt.typname, t.typname)) else coalesce(bt.typname, t.typname) end else coalesce(bt.typname, t.typname) end, $58, a.attidentity in ($59, $60), $61, case a.attidentity when $62 then $63 when $64 then $65 else $66 end, $67, a.attgenerated in ($68), $69, not (a.attnotnull or t.typtype = $70 and t.typnotnull), $71, ( b.relkind in ($72, $73) or (b.relkind in ($74, $75) and pg_column_is_updatable(b.id, a.attnum, $76)) ), $77, uniques.table_id is not null, $78, check_constraints.definition, $79, col_description(c.oid, a.attnum), $80, coalesce( ( select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_catalog.pg_enum e where e.enumtypid = coalesce(bt.oid, t.oid) or e.enumtypid = coalesce(bt.typelem, t.typelem) ), $81::jsonb ) ) order by a.attnum) as columns from pg_attribute a join base_table_info b on a.attrelid = b.id join pg_class c on a.attrelid = c.oid join pg_namespace nc on c.relnamespace = nc.oid left join pg_attrdef ad on (a.attrelid = ad.adrelid and a.attnum = ad.adnum) join pg_type t on a.atttypid = t.oid join pg_namespace nt on t.typnamespace = nt.oid left join pg_type bt on (t.typtype = $82 and t.typbasetype = bt.oid) left join pg_namespace nbt on bt.typnamespace = nbt.oid left join ( select conrelid as table_id, conkey[$83] as ordinal_position from pg_catalog.pg_constraint where contype = $84 and cardinality(conkey) = $85 group by conrelid, conkey[1] ) as uniques on uniques.table_id = a.attrelid and uniques.ordinal_position = a.attnum left join ( select distinct on (conrelid, conkey[1]) conrelid as table_id, conkey[$86] as ordinal_position, substring( pg_get_constraintdef(oid, $87), $88, length(pg_get_constraintdef(oid, $89)) - $90 ) as definition from pg_constraint where contype = $91 and cardinality(conkey) = $92 order by conrelid, conkey[1], oid asc ) as check_constraints on check_constraints.table_id = a.attrelid and check_constraints.ordinal_position = a.attnum where a.attnum > $93 and not a.attisdropped group by a.attrelid ) select case b.relkind when $94 then jsonb_build_object( $95, b.relkind, $96, b.id, $97, b.schema, $98, b.name, $99, b.rls_enabled, $100, b.rls_forced, $101, ts.replica_identity, $102, ts.bytes, $103, ts.size, $104, ts.live_rows_estimate, $105, ts.dead_rows_estimate, $106, b.comment, $107, coalesce(pk.primary_keys, $108::jsonb), $109, coalesce( (select jsonb_agg(r.rel_info) from relationships r where r.source_id = b.id or r.target_id = b.id), $110::jsonb ), $111, coalesce(c.columns, $112::jsonb) ) when $113 then jsonb_build_object( $114, b.relkind, $115, b.id, $116, b.schema, $117, b.name, $118, b.rls_enabled, $119, b.rls_forced, $120, ts.replica_identity, $121, ts.bytes, $122, ts.size, $123, ts.live_rows_estimate, $124, ts.dead_rows_estimate, $125, b.comment, $126, coalesce(pk.primary_keys, $127::jsonb), $128, coalesce( (select jsonb_agg(r.rel_info) from relationships r where r.source_id = b.id or r.target_id = b.id), $129::jsonb ), $130, coalesce(c.columns, $131::jsonb) ) when $132 then jsonb_build_object( $133, b.relkind, $134, b.id, $135, b.schema, $136, b.name, $137, (pg_relation_is_updatable(b.id, $138) & $139) = $140, $141, b.comment, $142, coalesce(c.columns, $143::jsonb) ) when $144 then jsonb_build_object( $145, b.relkind, $146, b.id, $147, b.schema, $148, b.name, $149, $150, $151, b.comment, $152, coalesce(c.columns, $153::jsonb) ) when $154 then jsonb_build_object( $155, b.relkind, $156, b.id, $157, b.schema, $158, b.name, $159, b.comment, $160, b.foreign_server_name, $161, b.foreign_data_wrapper_name, $162, b.foreign_data_wrapper_handler, $163, coalesce(c.columns, $164::jsonb) ) end as entity from base_table_info b left join table_stats ts on b.id = ts.id left join primary_keys pk on b.id = pk.table_id left join columns c on b.id = c.table_id | postgres      | 5006  | 15.1261491590092  | 0.027125     | 1949.131502  | 75721.50269      | 4969      | 100.0000000000000000 | 6.913705826076842  | null                 |
| with tables as (
SELECT
  c.oid :: int8 AS id,
  nc.nspname AS schema,
  c.relname AS name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relreplident = $1 THEN $2
    WHEN c.relreplident = $3 THEN $4
    WHEN c.relreplident = $5 THEN $6
    ELSE $7
  END AS replica_identity,
  pg_total_relation_size(format($8, nc.nspname, c.relname)) :: int8 AS bytes,
  pg_size_pretty(
    pg_total_relation_size(format($9, nc.nspname, c.relname))
  ) AS size,
  pg_stat_get_live_tuples(c.oid) AS live_rows_estimate,
  pg_stat_get_dead_tuples(c.oid) AS dead_rows_estimate,
  obj_description(c.oid) AS comment,
  coalesce(pk.primary_keys, $10) as primary_keys,
  coalesce(
    jsonb_agg(relationships) filter (where relationships is not null),
    $11
  ) as relationships
FROM
  pg_namespace nc
  JOIN pg_class c ON nc.oid = c.relnamespace
  left join (
    select
      c.oid::int8 as table_id,
      jsonb_agg(
        jsonb_build_object(
          $12, c.oid::int8,
          $13, n.nspname,
          $14, c.relname,
          $15, a.attname
        )
        order by array_position(i.indkey, a.attnum)
      ) as primary_keys
    from
      pg_index i
      join pg_class c on i.indrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
    where
      n.nspname IN ($16) AND
      
      i.indisprimary
    group by c.oid
  ) as pk
  on pk.table_id = c.oid
  left join (
    select
      c.oid :: int8 as id,
      c.conname as constraint_name,
      nsa.nspname as source_schema,
      csa.relname as source_table_name,
      sa.attname as source_column_name,
      nta.nspname as target_table_schema,
      cta.relname as target_table_name,
      ta.attname as target_column_name
    from
      pg_constraint c
    join (
      pg_attribute sa
      join pg_class csa on sa.attrelid = csa.oid
      join pg_namespace nsa on csa.relnamespace = nsa.oid
    ) on sa.attrelid = c.conrelid and sa.attnum = any (c.conkey)
    join (
      pg_attribute ta
      join pg_class cta on ta.attrelid = cta.oid
      join pg_namespace nta on cta.relnamespace = nta.oid
    ) on ta.attrelid = c.confrelid and ta.attnum = any (c.confkey)
    where
      nsa.nspname IN ($17) OR nta.nspname IN ($18) AND
      
      c.contype = $19
  ) as relationships
  on (relationships.source_schema = nc.nspname and relationships.source_table_name = c.relname)
  or (relationships.target_table_schema = nc.nspname and relationships.target_table_name = c.relname)
WHERE
  nc.nspname IN ($20) AND
  
  
  c.relkind IN ($21, $22)
  AND NOT pg_is_other_temp_schema(nc.oid)
  AND (
    pg_has_role(c.relowner, $23)
    OR has_table_privilege(
      c.oid,
      $24
    )
    OR has_any_column_privilege(c.oid, $25)
  )
group by
  c.oid,
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  c.relreplident,
  nc.nspname,
  pk.primary_keys


)
  , columns as (
-- Adapted from information_schema.columns

SELECT
  c.oid :: int8 AS table_id,
  nc.nspname AS schema,
  c.relname AS table,
  (c.oid || $26 || a.attnum) AS id,
  a.attnum AS ordinal_position,
  a.attname AS name,
  CASE
    WHEN a.atthasdef THEN pg_get_expr(ad.adbin, ad.adrelid)
    ELSE $27
  END AS default_value,
  CASE
    WHEN t.typtype = $28 THEN CASE
      WHEN bt.typelem <> $29 :: oid
      AND bt.typlen = $30 THEN $31
      WHEN nbt.nspname = $32 THEN format_type(t.typbasetype, $33)
      ELSE $34
    END
    ELSE CASE
      WHEN t.typelem <> $35 :: oid
      AND t.typlen = $36 THEN $37
      WHEN nt.nspname = $38 THEN format_type(a.atttypid, $39)
      ELSE $40
    END
  END AS data_type,
  COALESCE(bt.typname, t.typname) AS format,
  a.attidentity IN ($41, $42) AS is_identity,
  CASE
    a.attidentity
    WHEN $43 THEN $44
    WHEN $45 THEN $46
    ELSE $47
  END AS identity_generation,
  a.attgenerated IN ($48) AS is_generated,
  NOT (
    a.attnotnull
    OR t.typtype = $49 AND t.typnotnull
  ) AS is_nullable,
  (
    c.relkind IN ($50, $51)
    OR c.relkind IN ($52, $53) AND pg_column_is_updatable(c.oid, a.attnum, $54)
  ) AS is_updatable,
  uniques.table_id IS NOT NULL AS is_unique,
  check_constraints.definition AS "check",
  array_to_json(
    array(
      SELECT
        enumlabel
      FROM
        pg_catalog.pg_enum enums
      WHERE
        enums.enumtypid = coalesce(bt.oid, t.oid)
        OR enums.enumtypid = coalesce(bt.typelem, t.typelem)
      ORDER BY
        enums.enumsortorder
    )
  ) AS enums,
  col_description(c.oid, a.attnum) AS comment
FROM
  pg_attribute a
  LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid
  AND a.attnum = ad.adnum
  JOIN (
    pg_class c
    JOIN pg_namespace nc ON c.relnamespace = nc.oid
  ) ON a.attrelid = c.oid
  JOIN (
    pg_type t
    JOIN pg_namespace nt ON t.typnamespace = nt.oid
  ) ON a.atttypid = t.oid
  LEFT JOIN (
    pg_type bt
    JOIN pg_namespace nbt ON bt.typnamespace = nbt.oid
  ) ON t.typtype = $55
  AND t.typbasetype = bt.oid
  LEFT JOIN (
    SELECT DISTINCT ON (table_id, ordinal_position)
      conrelid AS table_id,
      conkey[$56] AS ordinal_position
    FROM pg_catalog.pg_constraint
    WHERE contype = $57 AND cardinality(conkey) = $58
  ) AS uniques ON uniques.table_id = c.oid AND uniques.ordinal_position = a.attnum
  LEFT JOIN (
    -- We only select the first column check
    SELECT DISTINCT ON (table_id, ordinal_position)
      conrelid AS table_id,
      conkey[$59] AS ordinal_position,
      substring(
        pg_get_constraintdef(pg_constraint.oid, $60),
        $61,
        length(pg_get_constraintdef(pg_constraint.oid, $62)) - $63
      ) AS "definition"
    FROM pg_constraint
    WHERE contype = $64 AND cardinality(conkey) = $65
    ORDER BY table_id, ordinal_position, oid asc
  ) AS check_constraints ON check_constraints.table_id = c.oid AND check_constraints.ordinal_position = a.attnum
WHERE
  nc.nspname IN ($66) AND
  
  
  
  
  NOT pg_is_other_temp_schema(nc.oid)
  AND a.attnum > $67
  AND NOT a.attisdropped
  AND (c.relkind IN ($68, $69, $70, $71, $72))
  AND (
    pg_has_role(c.relowner, $73)
    OR has_column_privilege(
      c.oid,
      a.attnum,
      $74
    )
  )


)
select
  *
  , 
COALESCE(
  (
    SELECT
      array_agg(row_to_json(columns)) FILTER (WHERE columns.table_id = tables.id)
    FROM
      columns
  ),
  $75
) AS columns
from tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | postgres      | 766   | 73.6373873903395  | 0.148025     | 349.119684   | 56406.238741     | 18062     | 100.0000000000000000 | 5.150137379170559  | null                 |
| WITH pgrst_source AS (SELECT "pgrst_call".* FROM "public"."rpc_pessoas_completa"() pgrst_call) SELECT $4::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $5) AS body, nullif(current_setting($6, $7), $8) AS response_headers, nullif(current_setting($9, $10), $11) AS response_status, $12 AS response_inserted FROM (SELECT "record".* FROM "pgrst_source" AS "record" WHERE  "record"."id" = ANY ($1)    LIMIT $2 OFFSET $3) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | authenticated | 1206  | 25.8861254900497  | 10.378774    | 401.468682   | 31218.6673409999 | 1206      | 100.0000000000000000 | 2.850401466033371  | null                 |
| with base_table_info as ( select c.oid::int8 as id, nc.nspname as schema, c.relname as name, c.relkind, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced, c.relreplident, c.relowner, obj_description(c.oid) as comment from pg_class c join pg_namespace nc on nc.oid = c.relnamespace where c.oid = $1 and not pg_is_other_temp_schema(nc.oid) and ( pg_has_role(c.relowner, $2) or has_table_privilege( c.oid, $3 ) or has_any_column_privilege(c.oid, $4) ) ), table_stats as ( select b.id, case when b.relreplident = $5 then $6 when b.relreplident = $7 then $8 when b.relreplident = $9 then $10 else $11 end as replica_identity, pg_total_relation_size(format($12, b.schema, b.name))::int8 as bytes, pg_size_pretty(pg_total_relation_size(format($13, b.schema, b.name))) as size, pg_stat_get_live_tuples(b.id) as live_rows_estimate, pg_stat_get_dead_tuples(b.id) as dead_rows_estimate from base_table_info b where b.relkind in ($14, $15) ), primary_keys as ( select i.indrelid as table_id, jsonb_agg(jsonb_build_object( $16, n.nspname, $17, c.relname, $18, i.indrelid::int8, $19, a.attname )) as primary_keys from pg_index i join pg_class c on i.indrelid = c.oid join pg_attribute a on (a.attrelid = c.oid and a.attnum = any(i.indkey)) join pg_namespace n on c.relnamespace = n.oid where i.indisprimary group by i.indrelid ), relationships as ( select c.conrelid as source_id, c.confrelid as target_id, jsonb_build_object( $20, c.oid::int8, $21, c.conname, $22, c.confdeltype, $23, c.confupdtype, $24, nsa.nspname, $25, csa.relname, $26, sa.attname, $27, nta.nspname, $28, cta.relname, $29, ta.attname ) as rel_info from pg_constraint c join pg_class csa on c.conrelid = csa.oid join pg_namespace nsa on csa.relnamespace = nsa.oid join pg_attribute sa on (sa.attrelid = c.conrelid and sa.attnum = any(c.conkey)) join pg_class cta on c.confrelid = cta.oid join pg_namespace nta on cta.relnamespace = nta.oid join pg_attribute ta on (ta.attrelid = c.confrelid and ta.attnum = any(c.confkey)) where c.contype = $30 ), columns as ( select a.attrelid as table_id, jsonb_agg(jsonb_build_object( $31, (a.attrelid || $32 || a.attnum), $33, c.oid::int8, $34, nc.nspname, $35, c.relname, $36, a.attnum, $37, a.attname, $38, case when a.atthasdef then pg_get_expr(ad.adbin, ad.adrelid) else $39 end, $40, case when t.typtype = $41 then case when bt.typelem <> $42::oid and bt.typlen = $43 then $44 when nbt.nspname = $45 then format_type(t.typbasetype, $46) else $47 end else case when t.typelem <> $48::oid and t.typlen = $49 then $50 when nt.nspname = $51 then format_type(a.atttypid, $52) else $53 end end, $54, case when t.typtype = $55 then case when nt.nspname <> $56 then concat(nt.nspname, $57, coalesce(bt.typname, t.typname)) else coalesce(bt.typname, t.typname) end else coalesce(bt.typname, t.typname) end, $58, a.attidentity in ($59, $60), $61, case a.attidentity when $62 then $63 when $64 then $65 else $66 end, $67, a.attgenerated in ($68), $69, not (a.attnotnull or t.typtype = $70 and t.typnotnull), $71, ( b.relkind in ($72, $73) or (b.relkind in ($74, $75) and pg_column_is_updatable(b.id, a.attnum, $76)) ), $77, uniques.table_id is not null, $78, check_constraints.definition, $79, col_description(c.oid, a.attnum), $80, coalesce( ( select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_catalog.pg_enum e where e.enumtypid = coalesce(bt.oid, t.oid) or e.enumtypid = coalesce(bt.typelem, t.typelem) ), $81::jsonb ) ) order by a.attnum) as columns from pg_attribute a join base_table_info b on a.attrelid = b.id join pg_class c on a.attrelid = c.oid join pg_namespace nc on c.relnamespace = nc.oid left join pg_attrdef ad on (a.attrelid = ad.adrelid and a.attnum = ad.adnum) join pg_type t on a.atttypid = t.oid join pg_namespace nt on t.typnamespace = nt.oid left join pg_type bt on (t.typtype = $82 and t.typbasetype = bt.oid) left join pg_namespace nbt on bt.typnamespace = nbt.oid left join ( select conrelid as table_id, conkey[$83] as ordinal_position from pg_catalog.pg_constraint where contype = $84 and cardinality(conkey) = $85 group by conrelid, conkey[1] ) as uniques on uniques.table_id = a.attrelid and uniques.ordinal_position = a.attnum left join ( select distinct on (conrelid, conkey[1]) conrelid as table_id, conkey[$86] as ordinal_position, substring( pg_get_constraintdef(oid, $87), $88, length(pg_get_constraintdef(oid, $89)) - $90 ) as definition from pg_constraint where contype = $91 and cardinality(conkey) = $92 order by conrelid, conkey[1], oid asc ) as check_constraints on check_constraints.table_id = a.attrelid and check_constraints.ordinal_position = a.attnum where a.attnum > $93 and not a.attisdropped group by a.attrelid ) select case b.relkind when $94 then jsonb_build_object( $95, b.relkind, $96, b.id, $97, b.schema, $98, b.name, $99, b.rls_enabled, $100, b.rls_forced, $101, ts.replica_identity, $102, ts.bytes, $103, ts.size, $104, ts.live_rows_estimate, $105, ts.dead_rows_estimate, $106, b.comment, $107, coalesce(pk.primary_keys, $108::jsonb), $109, coalesce( (select jsonb_agg(r.rel_info) from relationships r where r.source_id = b.id or r.target_id = b.id), $110::jsonb ), $111, coalesce(c.columns, $112::jsonb) ) when $113 then jsonb_build_object( $114, b.relkind, $115, b.id, $116, b.schema, $117, b.name, $118, b.rls_enabled, $119, b.rls_forced, $120, ts.replica_identity, $121, ts.bytes, $122, ts.size, $123, ts.live_rows_estimate, $124, ts.dead_rows_estimate, $125, b.comment, $126, coalesce(pk.primary_keys, $127::jsonb), $128, coalesce( (select jsonb_agg(r.rel_info) from relationships r where r.source_id = b.id or r.target_id = b.id), $129::jsonb ), $130, coalesce(c.columns, $131::jsonb) ) when $132 then jsonb_build_object( $133, b.relkind, $134, b.id, $135, b.schema, $136, b.name, $137, (pg_relation_is_updatable(b.id, $138) & $139) = $140, $141, b.comment, $142, coalesce(c.columns, $143::jsonb) ) when $144 then jsonb_build_object( $145, b.relkind, $146, b.id, $147, b.schema, $148, b.name, $149, $150, $151, b.comment, $152, coalesce(c.columns, $153::jsonb) ) when $154 then jsonb_build_object( $155, b.relkind, $156, b.id, $157, b.schema, $158, b.name, $159, b.comment, $160, coalesce(c.columns, $161::jsonb) ) end as entity from base_table_info b left join table_stats ts on b.id = ts.id left join primary_keys pk on b.id = pk.table_id left join columns c on b.id = c.table_id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | postgres      | 2551  | 11.7034328882791  | 0.032442     | 126.346293   | 29855.457298     | 2545      | 100.0000000000000000 | 2.7259344007792694 | null                 |
| WITH
-- Recursively get the base types of domains
base_types AS (
  WITH RECURSIVE
  recurse AS (
    SELECT
      oid,
      typbasetype,
      typnamespace AS base_namespace,
      COALESCE(NULLIF(typbasetype, $3), oid) AS base_type
    FROM pg_type
    UNION
    SELECT
      t.oid,
      b.typbasetype,
      b.typnamespace AS base_namespace,
      COALESCE(NULLIF(b.typbasetype, $4), b.oid) AS base_type
    FROM recurse t
    JOIN pg_type b ON t.typbasetype = b.oid
  )
  SELECT
    oid,
    base_namespace,
    base_type
  FROM recurse
  WHERE typbasetype = $5
),
arguments AS (
  SELECT
    oid,
    array_agg((
      COALESCE(name, $6), -- name
      type::regtype::text, -- type
      CASE type
        WHEN $7::regtype THEN $8
        WHEN $9::regtype THEN $10
        WHEN $11::regtype THEN $12
        WHEN $13::regtype THEN $14
        ELSE type::regtype::text
      END, -- convert types that ignore the length and accept any value till maximum size
      idx <= (pronargs - pronargdefaults), -- is_required
      COALESCE(mode = $15, $16) -- is_variadic
    ) ORDER BY idx) AS args,
    CASE COUNT(*) - COUNT(name) -- number of unnamed arguments
      WHEN $17 THEN $18
      WHEN $19 THEN (array_agg(type))[$20] IN ($21::regtype, $22::regtype, $23::regtype, $24::regtype, $25::regtype)
      ELSE $26
    END AS callable
  FROM pg_proc,
       unnest(proargnames, proargtypes, proargmodes)
         WITH ORDINALITY AS _ (name, type, mode, idx)
  WHERE type IS NOT NULL -- only input arguments
  GROUP BY oid
)
SELECT
  pn.nspname AS proc_schema,
  p.proname AS proc_name,
  d.description AS proc_description,
  COALESCE(a.args, $27) AS args,
  tn.nspname AS schema,
  COALESCE(comp.relname, t.typname) AS name,
  p.proretset AS rettype_is_setof,
  (t.typtype = $28
   -- if any TABLE, INOUT or OUT arguments present, treat as composite
   or COALESCE(proargmodes::text[] && $29, $30)
  ) AS rettype_is_composite,
  bt.oid <> bt.base_type as rettype_is_composite_alias,
  p.provolatile,
  p.provariadic > $31 as hasvariadic,
  lower((regexp_split_to_array((regexp_split_to_array(iso_config, $32))[$33], $34))[$35]) AS transaction_isolation_level,
  coalesce(func_settings.kvs, $36) as kvs
FROM pg_proc p
LEFT JOIN arguments a ON a.oid = p.oid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
JOIN base_types bt ON bt.oid = p.prorettype
JOIN pg_type t ON t.oid = bt.base_type
JOIN pg_namespace tn ON tn.oid = t.typnamespace
LEFT JOIN pg_class comp ON comp.oid = t.typrelid
LEFT JOIN pg_description as d ON d.objoid = p.oid AND d.classoid = $37::regclass
LEFT JOIN LATERAL unnest(proconfig) iso_config ON iso_config LIKE $38
LEFT JOIN LATERAL (
  SELECT
    array_agg(row(
      substr(setting, $39, strpos(setting, $40) - $41),
      substr(setting, strpos(setting, $42) + $43)
    )) as kvs
  FROM unnest(proconfig) setting
  WHERE setting ~ ANY($2)
) func_settings ON $44
WHERE t.oid <> $45::regtype AND COALESCE(a.callable, $46)
AND prokind = $47
AND p.pronamespace = ANY($1::regnamespace[])                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | authenticator | 804   | 30.3968888345771  | 18.131232    | 233.469239   | 24439.098623     | 2626      | 99.9933113969827598  | 2.231397060695358  | null                 |
| WITH
-- Recursively get the base types of domains
base_types AS (
  WITH RECURSIVE
  recurse AS (
    SELECT
      oid,
      typbasetype,
      typnamespace AS base_namespace,
      COALESCE(NULLIF(typbasetype, $2), oid) AS base_type
    FROM pg_type
    UNION
    SELECT
      t.oid,
      b.typbasetype,
      b.typnamespace AS base_namespace,
      COALESCE(NULLIF(b.typbasetype, $3), b.oid) AS base_type
    FROM recurse t
    JOIN pg_type b ON t.typbasetype = b.oid
  )
  SELECT
    oid,
    base_namespace,
    base_type
  FROM recurse
  WHERE typbasetype = $4
),
columns AS (
    SELECT
        c.oid AS relid,
        a.attname::name AS column_name,
        d.description AS description,
        -- typbasetype and typdefaultbin handles `CREATE DOMAIN .. DEFAULT val`,  attidentity/attgenerated handles generated columns, pg_get_expr gets the default of a column
        CASE
          WHEN (t.typbasetype != $5) AND (ad.adbin IS NULL) THEN pg_get_expr(t.typdefaultbin, $6)
          WHEN a.attidentity  = $7 THEN format($8, seq.objid::regclass)
          WHEN a.attgenerated = $9 THEN $10
          ELSE pg_get_expr(ad.adbin, ad.adrelid)::text
        END AS column_default,
        not (a.attnotnull OR t.typtype = $11 AND t.typnotnull) AS is_nullable,
        CASE
            WHEN t.typtype = $12 THEN
            CASE
                WHEN bt.base_namespace = $13::regnamespace THEN format_type(bt.base_type, $14::integer)
                ELSE format_type(a.atttypid, a.atttypmod)
            END
            ELSE
            CASE
                WHEN t.typnamespace = $15::regnamespace THEN format_type(a.atttypid, $16::integer)
                ELSE format_type(a.atttypid, a.atttypmod)
            END
        END::text AS data_type,
        format_type(a.atttypid, a.atttypmod)::text AS nominal_data_type,
        information_schema._pg_char_max_length(
            information_schema._pg_truetypid(a.*, t.*),
            information_schema._pg_truetypmod(a.*, t.*)
        )::integer AS character_maximum_length,
        bt.base_type,
        a.attnum::integer AS position
    FROM pg_attribute a
        LEFT JOIN pg_description AS d
            ON d.objoid = a.attrelid and d.objsubid = a.attnum and d.classoid = $17::regclass
        LEFT JOIN pg_attrdef ad
            ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
        JOIN pg_class c
            ON a.attrelid = c.oid
        JOIN pg_type t
            ON a.atttypid = t.oid
        LEFT JOIN base_types bt
            ON t.oid = bt.oid
        LEFT JOIN pg_depend seq
            ON seq.refobjid = a.attrelid and seq.refobjsubid = a.attnum and seq.deptype = $18
    WHERE
        NOT pg_is_other_temp_schema(c.relnamespace)
        AND a.attnum > $19
        AND NOT a.attisdropped
        AND c.relkind in ($20, $21, $22, $23, $24)
        AND c.relnamespace = ANY($1::regnamespace[])
),
columns_agg AS (
  SELECT
    relid,
    array_agg(row(
      column_name,
      description,
      is_nullable::boolean,
      data_type,
      nominal_data_type,
      character_maximum_length,
      column_default,
      coalesce(
        (SELECT array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = base_type),
        $25
      )
    ) order by position) as columns
  FROM columns
  GROUP BY relid
),
tbl_pk_cols AS (
  SELECT
    r.oid AS relid,
    array_agg(a.attname ORDER BY a.attname) AS pk_cols
  FROM pg_class r
  JOIN pg_constraint c
    ON r.oid = c.conrelid
  JOIN pg_attribute a
    ON a.attrelid = r.oid AND a.attnum = ANY (c.conkey)
  WHERE
    c.contype in ($26)
    AND r.relkind IN ($27, $28)
    AND r.relnamespace NOT IN ($29::regnamespace, $30::regnamespace)
    AND NOT pg_is_other_temp_schema(r.relnamespace)
    AND NOT a.attisdropped
  GROUP BY r.oid
)
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  d.description AS table_description,
  c.relkind IN ($31,$32) as is_view,
  (
    c.relkind IN ($33,$34)
    OR (
      c.relkind in ($35,$36)
      -- The function `pg_relation_is_updateable` returns a bitmask where 8
      -- corresponds to `1 << CMD_INSERT` in the PostgreSQL source code, i.e.
      -- it's possible to insert into the relation.
      AND (pg_relation_is_updatable(c.oid::regclass, $37) & $38) = $39
    )
  ) AS insertable,
  (
    c.relkind IN ($40,$41)
    OR (
      c.relkind in ($42,$43)
      -- CMD_UPDATE
      AND (pg_relation_is_updatable(c.oid::regclass, $44) & $45) = $46
    )
  ) AS updatable,
  (
    c.relkind IN ($47,$48)
    OR (
      c.relkind in ($49,$50)
      -- CMD_DELETE
      AND (pg_relation_is_updatable(c.oid::regclass, $51) & $52) = $53
    )
  ) AS deletable,
  coalesce(tpks.pk_cols, $54) as pk_cols,
  coalesce(cols_agg.columns, $55) as columns
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description d on d.objoid = c.oid and d.objsubid = $56 and d.classoid = $57::regclass
LEFT JOIN tbl_pk_cols tpks ON c.oid = tpks.relid
LEFT JOIN columns_agg cols_agg ON c.oid = cols_agg.relid
WHERE c.relkind IN ($58,$59,$60,$61,$62)
AND c.relnamespace NOT IN ($63::regnamespace, $64::regnamespace)
AND not c.relispartition
ORDER BY table_schema, table_name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | authenticator | 804   | 24.9763754104478  | 1.10029      | 2106.831291  | 20081.00583      | 45136     | 99.9974145740461021  | 1.8334840444032667 | null                 |
| with _base_query as (select * from public.pessoas order by pessoas.id asc nulls last limit $1 offset $2)
  select id,case
        when octet_length(nome::text) > $3 
        then left(nome::text, $4) || $5
        else nome::text
      end as nome,case
        when octet_length(matricula::text) > $6 
        then left(matricula::text, $7) || $8
        else matricula::text
      end as matricula,case
        when octet_length("usuarioCadastro"::text) > $9 
        then left("usuarioCadastro"::text, $10) || $11
        else "usuarioCadastro"::text
      end as "usuarioCadastro","criadoEm",case
        when octet_length("usuarioEdicao"::text) > $12 
        then left("usuarioEdicao"::text, $13) || $14
        else "usuarioEdicao"::text
      end as "usuarioEdicao","atualizadoEm","dataAdmissao",centro_servico_id,setor_id,cargo_id,centro_custo_id,tipo_execucao_id from _base_query                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | postgres      | 229   | 82.7544410262009  | 0.042871     | 539.619106   | 18950.766995     | 64516     | 100.0000000000000000 | 1.7302882738387486 | null                 |
| UPDATE public.materiais
SET "usuarioCadastro" = $1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | postgres      | 1     | 16954.248829      | 16954.248829 | 16954.248829 | 16954.248829     | 357       | 100.0000000000000000 | 1.5479973949499257 | null                 |
| WITH pgrst_source AS ( SELECT "public"."materiais_view"."id", "public"."materiais_view"."nome", "public"."materiais_view"."materialItemNome", "public"."materiais_view"."fabricante", "public"."materiais_view"."fabricanteNome", "public"."materiais_view"."validadeDias", "public"."materiais_view"."ca", "public"."materiais_view"."valorUnitario", "public"."materiais_view"."estoqueMinimo", "public"."materiais_view"."ativo", "public"."materiais_view"."descricao", "public"."materiais_view"."grupoMaterial", "public"."materiais_view"."grupoMaterialNome", "public"."materiais_view"."numeroCalcado", "public"."materiais_view"."numeroVestimenta", "public"."materiais_view"."numeroEspecifico", "public"."materiais_view"."usuarioCadastro", "public"."materiais_view"."usuarioAtualizacao", "public"."materiais_view"."dataCadastro", "public"."materiais_view"."atualizadoEm", "public"."materiais_view"."caracteristicaNome", "public"."materiais_view"."corNome", "public"."materiais_view"."numeroCalcadoNome", "public"."materiais_view"."numeroVestimentaNome", "public"."materiais_view"."usuarioCadastroNome", "public"."materiais_view"."usuarioAtualizacaoNome", "public"."materiais_view"."fabricanteNome" FROM "public"."materiais_view"  ORDER BY "public"."materiais_view"."nome" ASC  LIMIT $1 OFFSET $2 )  SELECT $3::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $4) AS body, nullif(current_setting($5, $6), $7) AS response_headers, nullif(current_setting($8, $9), $10) AS response_status, $11 AS response_inserted FROM ( SELECT * FROM pgrst_source ) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | authenticated | 980   | 16.8534937295918  | 11.943921    | 214.017728   | 16516.423855     | 980       | 100.0000000000000000 | 1.5080220515400347 | null                 |
| WITH pgrst_source AS ( SELECT "public"."pessoas_view"."id", "public"."pessoas_view"."nome", "public"."pessoas_view"."matricula", "public"."pessoas_view"."dataAdmissao", "public"."pessoas_view"."usuarioCadastro", "public"."pessoas_view"."usuarioCadastroNome", "public"."pessoas_view"."usuarioEdicao", "public"."pessoas_view"."usuarioEdicaoNome", "public"."pessoas_view"."criadoEm", "public"."pessoas_view"."atualizadoEm", "public"."pessoas_view"."centro_servico_id", "public"."pessoas_view"."setor_id", "public"."pessoas_view"."cargo_id", "public"."pessoas_view"."centro_custo_id", "public"."pessoas_view"."tipo_execucao_id", "public"."pessoas_view"."centro_servico", "public"."pessoas_view"."setor", "public"."pessoas_view"."cargo", "public"."pessoas_view"."centro_custo", "public"."pessoas_view"."tipo_execucao" FROM "public"."pessoas_view"  ORDER BY "public"."pessoas_view"."nome" ASC  LIMIT $1 OFFSET $2 )  SELECT $3::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $4) AS body, nullif(current_setting($5, $6), $7) AS response_headers, nullif(current_setting($8, $9), $10) AS response_status, $11 AS response_inserted FROM ( SELECT * FROM pgrst_source ) _postgrest_t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | authenticated | 359   | 45.6088822785515  | 37.158593    | 123.718905   | 16373.588738     | 359       | 100.0000000000000000 | 1.4949805779098277 | null                 |
| SELECT
  pol.oid :: int8 AS id,
  n.nspname AS schema,
  c.relname AS table,
  c.oid :: int8 AS table_id,
  pol.polname AS name,
  CASE
    WHEN pol.polpermissive THEN $1 :: text
    ELSE $2 :: text
  END AS action,
  CASE
    WHEN pol.polroles = $3 :: oid [] THEN array_to_json(
      string_to_array($4 :: text, $5 :: text) :: name []
    )
    ELSE array_to_json(
      ARRAY(
        SELECT
          pg_roles.rolname
        FROM
          pg_roles
        WHERE
          pg_roles.oid = ANY (pol.polroles)
        ORDER BY
          pg_roles.rolname
      )
    )
  END AS roles,
  CASE
    pol.polcmd
    WHEN $6 :: "char" THEN $7 :: text
    WHEN $8 :: "char" THEN $9 :: text
    WHEN $10 :: "char" THEN $11 :: text
    WHEN $12 :: "char" THEN $13 :: text
    WHEN $14 :: "char" THEN $15 :: text
    ELSE $16 :: text
  END AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS definition,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS check
FROM
  pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE
  n.nspname NOT IN ($17,$18,$19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | postgres      | 1968  | 6.17316244715447  | 0.011758     | 115.685064   | 12148.783696     | 143742    | 100.0000000000000000 | 1.1092373187923399 | null                 |
| select
  t.oid::int8 as id,
  t.typname as name,
  n.nspname as schema,
  format_type (t.oid, $1) as format,
  coalesce(t_enums.enums, $2) as enums,
  coalesce(t_attributes.attributes, $3) as attributes,
  obj_description (t.oid, $4) as comment,
  nullif(t.typrelid::int8, $5) as type_relation_id
from
  pg_type t
  left join pg_namespace n on n.oid = t.typnamespace
  left join (
    select
      enumtypid,
      jsonb_agg(enumlabel order by enumsortorder) as enums
    from
      pg_enum
    group by
      enumtypid
  ) as t_enums on t_enums.enumtypid = t.oid
  left join (
    select
      oid,
      jsonb_agg(
        jsonb_build_object($6, a.attname, $7, a.atttypid::int8)
        order by a.attnum asc
      ) as attributes
    from
      pg_class c
      join pg_attribute a on a.attrelid = c.oid
    where
      c.relkind = $8 and not a.attisdropped
    group by
      c.oid
  ) as t_attributes on t_attributes.oid = t.typrelid
  where
      (
        t.typrelid = $9
        or (
          select
            c.relkind = $10
          from
            pg_class c
          where
            c.oid = t.typrelid
        )
      )
      and not exists (
                 select
                 from
                   pg_type el
                 where
                   el.oid = t.typelem
                   and el.typarray = t.oid
               )
      and n.nspname NOT IN ($11,$12,$13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | postgres      | 1749  | 6.89811035448828  | 2.072124     | 960.272216   | 12064.79501      | 26244     | 100.0000000000000000 | 1.1015687828138614 | null                 |
| with tables as (
SELECT
  c.oid :: int8 AS id,
  nc.nspname AS schema,
  c.relname AS name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relreplident = $1 THEN $2
    WHEN c.relreplident = $3 THEN $4
    WHEN c.relreplident = $5 THEN $6
    ELSE $7
  END AS replica_identity,
  pg_total_relation_size(format($8, nc.nspname, c.relname)) :: int8 AS bytes,
  pg_size_pretty(
    pg_total_relation_size(format($9, nc.nspname, c.relname))
  ) AS size,
  pg_stat_get_live_tuples(c.oid) AS live_rows_estimate,
  pg_stat_get_dead_tuples(c.oid) AS dead_rows_estimate,
  obj_description(c.oid) AS comment,
  coalesce(pk.primary_keys, $10) as primary_keys,
  coalesce(
    jsonb_agg(relationships) filter (where relationships is not null),
    $11
  ) as relationships
FROM
  pg_namespace nc
  JOIN pg_class c ON nc.oid = c.relnamespace
  left join (
    select
      c.oid::int8 as table_id,
      jsonb_agg(
        jsonb_build_object(
          $12, c.oid::int8,
          $13, n.nspname,
          $14, c.relname,
          $15, a.attname
        )
        order by array_position(i.indkey, a.attnum)
      ) as primary_keys
    from
      pg_index i
      join pg_class c on i.indrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
    where
      n.nspname IN ($16) AND
      
      i.indisprimary
    group by c.oid
  ) as pk
  on pk.table_id = c.oid
  left join (
    select
      c.oid :: int8 as id,
      c.conname as constraint_name,
      nsa.nspname as source_schema,
      csa.relname as source_table_name,
      sa.attname as source_column_name,
      nta.nspname as target_table_schema,
      cta.relname as target_table_name,
      ta.attname as target_column_name
    from
      pg_constraint c
    join (
      pg_attribute sa
      join pg_class csa on sa.attrelid = csa.oid
      join pg_namespace nsa on csa.relnamespace = nsa.oid
    ) on sa.attrelid = c.conrelid and sa.attnum = any (c.conkey)
    join (
      pg_attribute ta
      join pg_class cta on ta.attrelid = cta.oid
      join pg_namespace nta on cta.relnamespace = nta.oid
    ) on ta.attrelid = c.confrelid and ta.attnum = any (c.confkey)
    where
      nsa.nspname IN ($17) OR nta.nspname IN ($18) AND
      
      c.contype = $19
  ) as relationships
  on (relationships.source_schema = nc.nspname and relationships.source_table_name = c.relname)
  or (relationships.target_table_schema = nc.nspname and relationships.target_table_name = c.relname)
WHERE
  nc.nspname IN ($20) AND
  
  
  c.relkind IN ($21, $22)
  AND NOT pg_is_other_temp_schema(nc.oid)
  AND (
    pg_has_role(c.relowner, $23)
    OR has_table_privilege(
      c.oid,
      $24
    )
    OR has_any_column_privilege(c.oid, $25)
  )
group by
  c.oid,
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  c.relreplident,
  nc.nspname,
  pk.primary_keys


)
  
select
  *
  
from tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | postgres      | 304   | 37.354123         | 0.151453     | 156.284858   | 11355.653392     | 8938      | 100.0000000000000000 | 1.0368210379632081 | null                 |
| select set_config('search_path', $1, true), set_config($2, $3, true), set_config('role', $4, true), set_config('request.jwt.claims', $5, true), set_config('request.method', $6, true), set_config('request.path', $7, true), set_config('request.headers', $8, true), set_config('request.cookies', $9, true)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | authenticated | 73708 | 0.153991796670646 | 0.014391     | 854.620915   | 11350.427349     | 73708     | 100.0000000000000000 | 1.036343877280273  | null                 |
| SELECT
  e.name,
  n.nspname AS schema,
  e.default_version,
  x.extversion AS installed_version,
  e.comment
FROM
  pg_available_extensions() e(name, default_version, comment)
  LEFT JOIN pg_extension x ON e.name = x.extname
  LEFT JOIN pg_namespace n ON x.extnamespace = n.oid
WHERE
  $1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | postgres      | 155   | 65.7318566258064  | 2.097201     | 285.079025   | 10188.437777     | 11780     | 100.0000000000000000 | 0.9302491249525715 | null                 |