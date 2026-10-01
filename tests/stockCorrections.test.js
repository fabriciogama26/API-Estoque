import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { montarEstoqueAtual } from '../src/lib/estoque.js'

const material = {
  id: 'material-1',
  nome: 'Luva',
  ativo: true,
  estoqueMinimo: 0,
  valorUnitario: 10,
}
const entrada = {
  id: 'entrada-1',
  materialId: material.id,
  quantidade: 20,
  dataEntrada: '2026-09-01T10:00:00.000Z',
  status: 'ATIVO',
}

test('correção negativa altera saldo sem ser classificada como saída/consumo', () => {
  const result = montarEstoqueAtual([material], [entrada], [], null, {
    ajustes: [{ materialId: material.id, quantidadeAjuste: -5, dataAjuste: '2026-09-30T10:00:00.000Z' }],
  })
  assert.equal(result.itens[0].quantidade, 15)
  assert.equal(result.itens[0].totalEntradas, 20)
  assert.equal(result.itens[0].totalSaidas, 0)
})

test('correção positiva integra o saldo oficial', () => {
  const result = montarEstoqueAtual([material], [entrada], [], null, {
    ajustes: [{ materialId: material.id, quantidadeAjuste: 3, dataAjuste: '2026-09-30T10:00:00.000Z' }],
  })
  assert.equal(result.itens[0].quantidade, 23)
  assert.equal(result.resumo.totalItens, 23)
})

test('migration usa os nomes reais das tabelas operacionais do projeto', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260930_stock_physical_corrections.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /references public\.materiais\(id\)/)
  assert.match(migration, /references public\.centros_estoque\(id\)/)
  assert.match(migration, /from public\.entradas e/)
  assert.match(migration, /from public\.saidas o/)
  assert.doesNotMatch(migration, /public\.(?:materials|stock_centers|stock_entries|stock_outputs)\b/)
  assert.match(migration, /drop policy if exists stock_correction_requests_select/)
  assert.match(migration, /drop policy if exists stock_adjustments_select/)
  assert.match(migration, /resolve_stock_position_owner/)
  assert.match(migration, /v_owner := v_req\.account_owner_id/)
})

test('API de correções consulta somente colunas existentes em materiais', () => {
  const service = readFileSync(new URL('../src/services/stockCorrectionsApi.js', import.meta.url), 'utf8')
  assert.match(service, /from\('materiais_view'\)\.select\('id, descricao, "materialItemNome"'\)/)
  assert.doesNotMatch(service, /material:materiais\(/)
  assert.doesNotMatch(service, /from\('materiais'\).*materialItemNome/)
})

test('consulta de saldo usada nas movimentações inclui ajustes aprovados', () => {
  const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8')
  assert.match(api, /from\('stock_adjustments'\)/)
  assert.match(api, /adjustment_quantity/)
  assert.match(api, /calcularSaldoMaterial\(materialId, entradasNormalizadas, saidasNormalizadas, null\) \+ totalAjustes/)
})
