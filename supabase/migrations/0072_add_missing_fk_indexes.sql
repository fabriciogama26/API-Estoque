-- Adiciona indices cobrindo FKs sinalizadas pelo lint 0001_unindexed_foreign_keys.
-- Usa pg_constraint/pg_attribute para evitar hardcode de nomes de colunas.
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
          'acidente_historico_user_id_fkey',
          'acidente_historico_usuario_responsavel_fkey',
          'acidente_partes_sub_grupo_grupo_id_fkey',
          'api_errors_user_id_fkey',
          'app_errors_user_id_fkey',
          'app_users_plan_id_fkey',
          'app_users_credential_history_user_id_fkey',
          'app_users_dependentes_auth_user_id_fkey',
          'app_users_dependentes_credential_fkey',
          'centros_estoque_centro_custo_fkey',
          'centros_servico_centro_custo_id_fkey',
          'entrada_historico_material_id_fkey',
          'entrada_historico_usuarioResponsavel_fkey',
          'entradas_centro_estoque_fkey',
          'entradas_status_fkey',
          'entradas_usuarioResponsavel_fkey',
          'entradas_usuario_edicao_fkey',
          'materiais_fabricante_fkey',
          'materiais_grupoMaterial_fkey',
          'materiais_nome_fkey',
          'materiais_numeroCalcado_fkey',
          'materiais_numeroVestimenta_fkey',
          'materiais_usuarioAtualizacao_fkey',
          'materiais_usuarioCadastro_fkey',
          'material_grupo_caracteristica_epi_gurpo_caracteristica_epi_fkey',
          'material_grupo_caracteristica_epi_material_id_fkey',
          'material_grupo_cor_gurpo_material_cor_fkey',
          'material_grupo_cor_material_id_fkey',
          'pessoas_usuario_cadastro_fk',
          'pessoas_usuario_edicao_fk',
          'pessoas_historico_usuario_responsavel_fkey',
          'saidas_centro_custo_fkey',
          'saidas_centro_estoque_fkey',
          'saidas_centro_servico_fkey',
          'saidas_status_fkey',
          'saidas_usuarioEdicao_fkey',
          'saidas_usuarioResponsavel_fkey',
          'saidas_historico_material_id_fkey',
          'saidas_historico_usuarioResponsavel_fkey',
          'setores_centro_servico_id_fkey'
        )
    ) as pc
    join pg_attribute pa
      on pa.attrelid = pc.conrelid
     and pa.attnum = pc.attnum
    group by pc.conname, pc.conrelid, pc.conkey
  )
  loop
    -- Evite colisao com indices ja existentes mas que nao cobrem o prefixo da FK.
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

-- Se um _fkcov_* foi criado mas já existe outro indice com o mesmo prefixo, remove o redundante.
do $$
declare
  r record;
begin
  for r in (
    select
      n.nspname as schemaname,
      ic.relname as idxname
    from pg_index fkcov
    join pg_class ic on ic.oid = fkcov.indexrelid
    join pg_namespace n on n.oid = ic.relnamespace
    join pg_index base
      on base.indrelid = fkcov.indrelid
     and (base.indkey::int2[])[1:base.indnatts] = (fkcov.indkey::int2[])[1:fkcov.indnatts]
     and base.indexrelid <> fkcov.indexrelid
     and base.indisvalid
     and base.indisready
    where ic.relname like '%_fkcov_idx' or ic.relname like '%_fkcov2_idx'
  )
  loop
    execute format('drop index if exists %I.%I;', r.schemaname, r.idxname);
  end loop;
end
$$;

-- Indices marcados como "unused_index" (lint 0005) nao sao removidos aqui;
-- confirme com pg_stat_user_indexes em producao antes de dropar para evitar regressao.
