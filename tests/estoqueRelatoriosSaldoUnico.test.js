import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8')

test('orcamento anual usa o saldo unico e preserva o restante da versao 6', () => {
  const migration = ler('supabase/migrations/20261004_orcamento_12m_saldo_unico.sql')
  assert.match(migration, /from public\._estoque_saldos_posicoes\(v_owner_param\) sp/)
  assert.match(migration, /greatest\(coalesce\(sa\.quantidade, 0\), 0\)::numeric as estoque_atual/)
  assert.doesNotMatch(migration, /entradas_saldo|saidas_saldo/)
  assert.match(migration, /'validacao_orcamento'/)
  assert.match(migration, /drop function if exists public\.rpc_orcamento_compra_12m_calcular\(uuid, uuid, jsonb\)/)
  assert.match(migration, /grant execute on function public\.rpc_orcamento_compra_12m_calcular\(text, text, jsonb\) to authenticated, service_role/)
})

test('relatorio mensal do backend usa o estoque acumulado ate o fim do periodo', () => {
  const operations = ler('api/_shared/operations.js')
  assert.match(operations, /\.rpc\('_estoque_saldos_posicoes'/)
  assert.match(operations, /carregarSaldosPorOwner\(ownerId, periodoRange\?\.end \?\? null\)/)
  assert.match(operations, /estoqueBase: montarEstoqueAtual\(materiais, \[\], \[\], null, \{ saldos \}\)/)
  assert.equal(operations.match(/const estoqueBaseAtual = dadosAtual\.estoqueBase/g)?.length, 2)
  assert.doesNotMatch(operations, /calcularSaldoMaterial\b/)
})

test('backend le entradas, saidas, pessoas e materiais paginados', () => {
  const operations = ler('api/_shared/operations.js')
  assert.match(operations, /async function executePaged\(buildQuery, fallbackMessage\)/)
  assert.match(operations, /executePaged\(\s*\(\) => consultaMovimentacoes\('saidas', 'dataEntrega', ownerId, periodoRange\)/)
  assert.doesNotMatch(operations, /execute\(supabaseAdmin\.from\('pessoas'\)\.select\('\*'\)\.eq\('account_owner_id', ownerId\)/)
  assert.doesNotMatch(operations, /execute\(entradasFiltered|execute\(saidasFiltered/)
  assert.match(operations, /\.in\('id', lote\)/)
})

test('Edge Functions de estoque calculam o saldo no banco e paginam as leituras', () => {
  for (const caminho of [
    'supabase/functions/relatorio-estoque-semanal/_shared/relatorioEstoqueSemanalCore.ts',
    'supabase/functions/relatorio-estoque-mensal/_shared/relatorioEstoqueCore.ts',
  ]) {
    const core = ler(caminho)
    assert.match(core, /\.rpc\("_estoque_saldos_posicoes"/, caminho)
    assert.match(core, /const executePaged = async/, caminho)
    assert.doesNotMatch(core, /execute\(entradasQuery|execute\(saidasQuery|execute\(entradasFiltered|execute\(saidasFiltered/, caminho)
  }
  const semanal = ler('supabase/functions/relatorio-estoque-semanal/_shared/relatorioEstoqueSemanalCore.ts')
  assert.match(semanal, /montarEstoqueAtual\(materiais, saldos, \{/)
  assert.doesNotMatch(semanal, /entradasTodas|saidasTodas/)
  const mensal = ler('supabase/functions/relatorio-estoque-mensal/_shared/relatorioEstoqueCore.ts')
  assert.match(mensal, /\{ posicoesSaldo: dadosAtual\.saldos \}/)
})

test('Edge Function de troca de EPI pagina as saidas e busca ids em lotes', () => {
  const core = ler('supabase/functions/relatorio-troca-epi/_shared/relatorioTrocaEpiCore.ts')
  assert.match(core, /const loadSaidasBase = async[\s\S]*?executePaged\(/)
  assert.equal(core.match(/executeEmLotes\(\s*ids,/g)?.length, 4)
})
