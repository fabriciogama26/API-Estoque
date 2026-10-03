import test from 'node:test'
import assert from 'node:assert/strict'
import { filterEstoqueItens } from '../src/utils/estoqueUtils.js'
import { coberturaEmDias } from '../src/utils/reposicaoUtils.js'

const itens = [
  { materialId: 'luva', nome: 'Luva', quantidade: 10 },
  { materialId: 'bota', nome: 'Bota', quantidade: 40 },
  { materialId: 'capacete', nome: 'Capacete', quantidade: 5 },
  { materialId: 'oculos', nome: 'Oculos', quantidade: 0 },
  { materialId: 'mascara', nome: 'Mascara', quantidade: 3 },
]

// cobertura_atual_meses vem da RPC com 2 casas; o card mostra dias abaixo de 90 e meses acima.
const reposicaoPorMaterial = new Map([
  ['luva', { material_id: 'luva', cobertura_atual_meses: 0.5, situacao: 'reposicao_necessaria' }],
  ['bota', { material_id: 'bota', cobertura_atual_meses: 11.84, situacao: 'acima_do_alvo' }],
  ['capacete', { material_id: 'capacete', cobertura_atual_meses: 6, situacao: 'manter' }],
  ['oculos', { material_id: 'oculos', cobertura_atual_meses: null, situacao: 'sem_consumo_recente' }],
])

const ids = (lista) => lista.map((item) => item.materialId)

test('coberturaEmDias converte meses em dias inteiros e preserva null', () => {
  assert.equal(coberturaEmDias(0.5), 15)
  assert.equal(coberturaEmDias(11.84), 355)
  assert.equal(coberturaEmDias(6), 180)
  assert.equal(coberturaEmDias(-1), 0)
  assert.equal(coberturaEmDias(null), null)
  assert.equal(coberturaEmDias(''), null)
})

test('faixa de cobertura em dias e inclusiva nos dois limites', () => {
  const filtro = (min, max) =>
    ids(filterEstoqueItens(itens, { coberturaDiasMin: min, coberturaDiasMax: max }, { reposicaoPorMaterial }))

  assert.deepEqual(filtro('15', '180'), ['luva', 'capacete'])
  assert.deepEqual(filtro('', '180'), ['luva', 'capacete'])
  assert.deepEqual(filtro('181', ''), ['bota'])
  assert.deepEqual(filtro('355', '355'), ['bota'])
})

test('faixa invertida e reordenada', () => {
  const resultado = filterEstoqueItens(
    itens,
    { coberturaDiasMin: '180', coberturaDiasMax: '15' },
    { reposicaoPorMaterial },
  )
  assert.deepEqual(ids(resultado), ['luva', 'capacete'])
})

test('cobertura nao calculavel e material sem politica ficam fora da faixa', () => {
  const resultado = filterEstoqueItens(itens, { coberturaDiasMin: '0' }, { reposicaoPorMaterial })
  assert.deepEqual(ids(resultado), ['luva', 'bota', 'capacete'])
})

test('situacao filtra pelo codigo da politica e combina com a faixa', () => {
  assert.deepEqual(
    ids(filterEstoqueItens(itens, { situacaoReposicao: 'sem_consumo_recente' }, { reposicaoPorMaterial })),
    ['oculos'],
  )
  assert.deepEqual(
    ids(
      filterEstoqueItens(
        itens,
        { situacaoReposicao: 'manter', coberturaDiasMax: '90' },
        { reposicaoPorMaterial },
      ),
    ),
    [],
  )
})

test('sem politica carregada os filtros de cobertura e situacao ficam sem efeito', () => {
  const filtros = { coberturaDiasMin: '10', coberturaDiasMax: '20', situacaoReposicao: 'manter' }
  assert.deepEqual(ids(filterEstoqueItens(itens, filtros)), ids(itens))
  assert.deepEqual(ids(filterEstoqueItens(itens, filtros, { reposicaoPorMaterial: new Map() })), ids(itens))
})

test('filtros vazios nao removem materiais sem politica', () => {
  const filtros = { coberturaDiasMin: '', coberturaDiasMax: '', situacaoReposicao: '' }
  assert.deepEqual(ids(filterEstoqueItens(itens, filtros, { reposicaoPorMaterial })), ids(itens))
})
