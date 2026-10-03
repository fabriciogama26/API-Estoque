import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  agruparPorPeriodo,
  contarRegistros,
  montarTopCentrosServico,
  montarTopMateriaisSaida,
  montarTopPessoas,
  montarTopTrocasPessoas,
  resumirTrocas,
} from '../src/utils/dashboardEstoqueUtils.js'

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8')

const isoDia = (base, dias) => {
  const data = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}T00:00:00+00:00`
}

const material = (id) => ({ id, nome: `Material ${id}`, valorUnitario: 10 })
const pessoa = (id, centro) => ({ id, nome: `Pessoa ${id}`, matricula: id, centroServico: centro, setor: centro, local: centro })

// Mesmo agrupamento da rpc_dashboard_estoque: material x pessoa x troca x mes x faixa de prazo.
const agregar = (saidas) => {
  const grupos = new Map()
  saidas.forEach((saida) => {
    const mes = `${saida.dataEntrega.slice(0, 7)}-01T00:00:00Z`
    const chave = [saida.materialId, saida.pessoaId, saida.isTroca, mes, saida.prazoTroca].join('|')
    const atual = grupos.get(chave) ?? { ...saida, dataEntrega: mes, quantidade: 0, registros: 0 }
    delete atual.id
    atual.quantidade += saida.quantidade
    atual.registros += 1
    grupos.set(chave, atual)
  })
  return Array.from(grupos.values())
}

test('contarRegistros soma os lancamentos de cada linha agregada (linha sem registros conta 1)', () => {
  assert.equal(contarRegistros([{ registros: 1500 }, { registros: 4 }, {}]), 1505)
  assert.equal(contarRegistros(null), 0)
})

test('resumirTrocas: faixa pronta do banco e calculo pela data de troca dao o mesmo resultado', () => {
  const hoje = new Date()
  const legado = [
    { dataTroca: isoDia(hoje, -3), isTroca: true },
    { dataTroca: isoDia(hoje, 0) },
    { dataTroca: isoDia(hoje, 7) },
    { dataTroca: isoDia(hoje, 8) },
    { dataTroca: null, isTroca: true },
    { dataTroca: isoDia(hoje, -1), status: 'cancelado', isTroca: true },
  ]
  assert.deepEqual(resumirTrocas(legado, hoje), { feitas: 2, atrasadas: 1, aVencer: 2 })

  const agregado = [
    { prazoTroca: 'atrasada', isTroca: true, registros: 1 },
    { prazoTroca: 'a_vencer', registros: 2 },
    { prazoTroca: null, registros: 1 },
    { prazoTroca: null, isTroca: true, registros: 1 },
  ]
  assert.deepEqual(resumirTrocas(agregado, hoje), { feitas: 2, atrasadas: 1, aVencer: 2 })
})

test('graficos iguais com as saidas linha a linha ou agregadas pelo banco', () => {
  const materiais = new Map(['m1', 'm2'].map((id) => [id, material(id)]))
  const pessoas = new Map([
    ['p1', pessoa('p1', 'Eletrica')],
    ['p2', pessoa('p2', 'Civil')],
  ])
  const linhas = []
  for (let i = 0; i < 1500; i += 1) {
    const pessoaId = i % 3 === 0 ? 'p2' : 'p1'
    linhas.push({
      id: `s${i}`,
      materialId: i % 5 === 0 ? 'm2' : 'm1',
      pessoaId,
      quantidade: (i % 4) + 1,
      dataEntrega: `2026-0${(i % 6) + 1}-15T12:00:00+00:00`,
      isTroca: i % 7 === 0,
      prazoTroca: null,
    })
  }
  const detalhar = (saida) => {
    const p = pessoas.get(saida.pessoaId)
    return { ...saida, material: materiais.get(saida.materialId), pessoa: p, pessoaNome: p.nome, centroServico: p.centroServico, setor: p.setor, local: p.local }
  }
  const linhaALinha = linhas.map(detalhar)
  const agregadas = agregar(linhas).map(detalhar)

  assert.ok(agregadas.length < 60)
  assert.equal(contarRegistros(agregadas), linhaALinha.length)
  assert.deepEqual(montarTopMateriaisSaida(agregadas), montarTopMateriaisSaida(linhaALinha))
  assert.deepEqual(montarTopPessoas(agregadas), montarTopPessoas(linhaALinha))
  assert.deepEqual(montarTopCentrosServico(agregadas), montarTopCentrosServico(linhaALinha))
  assert.deepEqual(montarTopTrocasPessoas(agregadas), montarTopTrocasPessoas(linhaALinha))
  assert.deepEqual(agruparPorPeriodo([], agregadas), agruparPorPeriodo([], linhaALinha))
  assert.deepEqual(montarTopPessoas(agregadas, 'civil'), montarTopPessoas(linhaALinha, 'civil'))
})

test('Dashboard le os lancamentos agregados pela RPC e volta para a consulta antiga sem a migration', () => {
  const api = ler('src/services/api.js')
  const inicio = api.indexOf('    async dashboard(params = {}) {')
  const bloco = api.slice(inicio, api.indexOf('\n    },', inicio))
  assert.match(bloco, /supabase\.rpc\('rpc_dashboard_estoque'/)
  assert.match(bloco, /p_hoje: dataLocalHoje\(\)/)
  assert.match(bloco, /rpcMovimentacaoIndisponivel\(resposta\.error\)/)
  assert.match(bloco, /carregarDashboardEstoqueLegado\(/)
  assert.doesNotMatch(bloco, /carregarSaidas\(|carregarEntradas\(/)

  const hook = ler('src/hooks/useDashboardEstoque.js')
  assert.match(hook, /contarRegistros\(saidasDetalhadasFiltradas\)/)
  assert.match(hook, /resumirTrocas\(saidasDetalhadasFiltradas\)/)
  assert.doesNotMatch(hook, /saidasDetalhadasFiltradas\.length/)
})

test('migration do Dashboard: tenant da sessao, sem cancelados e sem acesso anonimo', () => {
  const sql = ler('supabase/migrations/20261006_dashboard_estoque_agregado.sql')
  assert.match(sql, /v_owner uuid := public\.current_account_owner_id\(\)/)
  assert.match(sql, /perform public\._dashboard_pode_ver\(\)/)
  assert.equal((sql.match(/<> 'cancelado'/g) ?? []).length, 2)
  assert.match(sql, /revoke all on function public\.rpc_dashboard_estoque\(timestamptz, timestamptz, date\) from public, anon;/)
  assert.doesNotMatch(sql, /grant execute[^;]*\banon\b/)
})
