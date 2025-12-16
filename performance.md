# Estado atual (Performance Advisor)

- Lints 0001/0009 resolvidos: `0072_add_missing_fk_indexes` cobre as FKs sinalizadas; `0073_fix_performance_warnings` removeu índices `_fkcov*` redundantes e criou `app_users_credential_fkey_idx` (faltante).
- Lints 0006 (multiple permissive policies) resolvidos para `app_credentials_catalog` com uma policy de `select` para `authenticated` e `all` para `service_role`.
- Restantes (INFO): “unused_index”. Índices são pequenos (≤32 kB) e incluem tanto FKs pouco usadas quanto índices de ordenação/data em erros/logs. Verifique uso real antes de dropar.

## Como avaliar os unused_index

Use as estatísticas locais/produção para decidir:

```sql
select schemaname, relname, indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) as idx_size
from pg_stat_user_indexes
where indexrelname in (
  -- exemplos de candidatos não-FK
  'acidente_lesoes_ordem_idx','acidentes_matricula_idx','acidente_tipos_agente_idx',
  'cargos_ordem_idx','centros_servico_ordem_idx',
  'api_errors_created_at_idx','api_errors_status_created_idx',
  'api_errors_service_idx','api_errors_path_idx','api_errors_fingerprint_idx',
  'app_errors_created_at_idx','app_errors_status_created_idx'
)
order by idx_scan, indexrelname;
```

- Se `idx_scan=0` por tempo prolongado e não há queries por essas colunas, drope com `DROP INDEX CONCURRENTLY IF EXISTS schema.nome;`.
- Para índices de FK, mantenha mesmo com `idx_scan=0` (ajudam em DELETE/UPDATE referenciado e são baratos).
