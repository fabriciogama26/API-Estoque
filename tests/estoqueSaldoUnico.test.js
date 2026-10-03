import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { montarEstoqueAtual } from '../src/lib/estoque.js'

const luva = { id: 'material-luva', nome: 'Luva', ativo: true, estoqueMinimo: 20, valorUnitario: 10 }
const bota = { id: 'material-bota', nome: 'Bota', ativo: true, estoqueMinimo: 0, valorUnitario: 50 }

const posicao = (dados) => ({
  totalEntradas: 0,
  totalSaidas: 0,
  totalAjustes: 0,
  saldo: 0,
  qtdSaidas: 0,
  ultimaEntradaEm: null,
  ultimaSaidaEm: null,
  ultimoAjusteEm: null,
  centroAtivo: true,
  ...dados,
})

const saldosLuva = [
  posicao({
    materialId: luva.id,
    centroEstoqueId: 'centro-central',
    centroEstoqueNome: 'Almox Central',
    totalEntradas: 10,
    totalSaidas: 2,
    saldo: 8,
    qtdSaidas: 1,
    ultimaEntradaEm: '2026-09-01T10:00:00.000Z',
    ultimaSaidaEm: '2026-09-28T10:00:00.000Z',
  }),
  posicao({
    materialId: luva.id,
    centroEstoqueId: 'centro-obra',
    centroEstoqueNome: 'Almox Obra',
    totalEntradas: 5,
    totalAjustes: 2,
    saldo: 7,
    ultimaEntradaEm: '2026-09-10T10:00:00.000Z',
    ultimoAjusteEm: '2026-10-02T10:00:00.000Z',
  }),
  posicao({
    materialId: luva.id,
    centroEstoqueId: null,
    centroEstoqueNome: null,
    totalSaidas: 1,
    saldo: -1,
    qtdSaidas: 1,
    ultimaSaidaEm: '2026-09-30T10:00:00.000Z',
  }),
]

test('card usa o saldo do banco somando todos os centros, sem recalcular lancamentos', () => {
  const entradasIgnoradas = [{ id: 'e1', materialId: luva.id, quantidade: 999, dataEntrada: '2026-09-01T10:00:00.000Z' }]
  const result = montarEstoqueAtual([luva], entradasIgnoradas, [], null, { saldos: saldosLuva })
  const [item] = result.itens
  assert.equal(item.quantidade, 14)
  assert.equal(item.estoqueAtual, 14)
  assert.equal(item.totalEntradas, 15)
  assert.equal(item.totalSaidas, 3)
  assert.equal(item.valorTotal, 140)
  assert.equal(result.resumo.totalItens, 14)
})

test('card detalha o saldo de cada centro, incluindo saidas sem centro', () => {
  const [item] = montarEstoqueAtual([luva], [], [], null, { saldos: saldosLuva }).itens
  assert.deepEqual(item.centrosEstoqueDetalhes, [
    { id: 'centro-central', nome: 'Almox Central', saldo: 8, ativo: true },
    { id: 'centro-obra', nome: 'Almox Obra', saldo: 7, ativo: true },
    { id: null, nome: 'Sem centro de estoque', saldo: -1, ativo: true },
  ])
  assert.deepEqual(item.centrosCusto, ['Almox Central', 'Almox Obra'])
})

test('ultima movimentacao e ultima saida vem das datas agregadas pelo banco', () => {
  const [item] = montarEstoqueAtual([luva], [], [], null, { saldos: saldosLuva }).itens
  assert.equal(item.ultimaAtualizacao, '2026-10-02T10:00:00.000Z')
  assert.equal(item.temSaida, true)
  assert.deepEqual(item.ultimaSaida, { dataEntrega: '2026-09-30T10:00:00.000Z' })
})

test('alerta de minimo considera o saldo total do material', () => {
  const result = montarEstoqueAtual([luva], [], [], null, { saldos: saldosLuva })
  assert.equal(result.itens[0].alerta, true)
  assert.equal(result.itens[0].deficitQuantidade, 6)
  assert.equal(result.alertas.length, 1)
})

test('material ativo sem posicao no banco aparece com saldo zero e sem alerta', () => {
  const result = montarEstoqueAtual([luva, bota], [], [], null, {
    saldos: saldosLuva,
    includeAtivosSemMovimentacao: true,
  })
  const itemBota = result.itens.find((item) => item.materialId === bota.id)
  assert.equal(itemBota.quantidade, 0)
  assert.equal(itemBota.semMovimentacao, true)
  assert.equal(itemBota.alerta, false)
  assert.deepEqual(itemBota.centrosEstoqueDetalhes, [])
})

test('migration agrega o saldo com a mesma regra de calcular_saldo_estoque', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261003_estoque_saldo_unico.sql', import.meta.url),
    'utf8',
  )
  const regraCancelado = /lower\(coalesce\(st\.status, ''\)\) <> 'cancelado'/g
  assert.equal(migration.match(regraCancelado)?.length, 2)
  assert.match(migration, /from public\.stock_adjustments a/)
  assert.match(migration, /function public\.rpc_estoque_saldos/)
  assert.match(migration, /public\.current_account_owner_id\(\)/)
  assert.match(migration, /revoke all on function public\._estoque_saldos_posicoes\(uuid, uuid, timestamptz, timestamptz\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.rpc_estoque_saldos\(uuid, timestamptz, timestamptz\) from public, anon/)
})

test('politica de reposicao usa o mesmo saldo, com as correcoes aprovadas', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261003_estoque_saldo_unico.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /from public\._estoque_saldos_posicoes\(p_owner_id\) sp/)
  assert.match(migration, /coalesce\(sa\.quantidade, 0\) as estoque_atual/)
  assert.doesNotMatch(migration, /coalesce\(em\.quantidade, 0\) - coalesce\(sm\.quantidade_total, 0\)/)
})

test('lista de materiais do tenant nao depende do limite de 1000 linhas da API', () => {
  const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8')
  const idsDoOwner = api.match(/async function carregarMaterialIdsDoOwner\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(idsDoOwner, /executePaged\(/)
  assert.match(idsDoOwner, /\.order\('id', \{ ascending: true \}\)/)
  assert.match(api, /async function carregarMateriaisViewDoOwner\(origem = 'materiais_view'\)/)
  assert.match(api, /from\(origem\)\.select\(MATERIAL_SELECT_COLUMNS\)\.in\('id', lote\)/)
  assert.match(api, /carregarMateriaisViewDoOwner\(ENTRADAS_MATERIAIS_VIEW\)/)
})

test('Estoque atual busca o saldo pronto no banco, paginado', () => {
  const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8')
  assert.match(api, /\.rpc\('rpc_estoque_saldos', args\)/)
  assert.match(api, /registros = await executePaged\(/)
  assert.match(api, /montarEstoqueAtual\(materiais, \[\], \[\], null, \{ \.\.\.opcoes, saldos \}\)/)
})
