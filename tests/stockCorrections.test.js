import test from 'node:test'
import assert from 'node:assert/strict'
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
