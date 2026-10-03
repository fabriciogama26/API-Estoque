import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20261007_fix_rpc_catalog_list_fallthrough.sql', import.meta.url),
  'utf8',
)

test('rpc_catalog_list encerra o ramo owner-scoped antes da consulta global', () => {
  assert.match(
    migration,
    /if v_owner_table then[\s\S]*?where account_owner_id = \$1[\s\S]*?\) using v_owner;\s*return;\s*end if;\s*return query execute format\(/,
  )
})

test('rpc_catalog_list mantem catalogos operacionais isolados pelo owner da sessao', () => {
  assert.match(migration, /v_owner uuid := public\.current_account_owner_id\(\);/)
  assert.match(migration, /'centros_estoque'/)
  assert.match(migration, /'acidente_locais'/)
  assert.doesNotMatch(migration, /v_is_master|if\s+public\.is_master\(\)/)
})
