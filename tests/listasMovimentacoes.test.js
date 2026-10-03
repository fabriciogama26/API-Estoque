import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  filtrarTrocasNoNavegador,
  paginarNoNavegador,
  registrantesDaLista,
} from '../src/utils/movimentacoesPaginacao.js'
import { buildSaidasQuery } from '../src/utils/saidasUtils.js'

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8')

test('modo local: pagina no navegador com o mesmo formato { itens, total }', () => {
  const lista = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }))
  const pagina3 = paginarNoNavegador(lista, { page: 3, pageSize: 20 })
  assert.equal(pagina3.total, 45)
  assert.deepEqual(pagina3.itens.map((item) => item.id), [41, 42, 43, 44, 45])
  assert.equal(paginarNoNavegador(null, { page: 1, pageSize: 20 }).total, 0)
})

test('modo local: registrantes sem repeticao, ordenados pelo nome', () => {
  const registrantes = registrantesDaLista([
    { usuarioResponsavelId: 'u2', usuarioResponsavelNome: 'operador' },
    { usuarioResponsavelId: 'u1', usuarioResponsavelNome: 'admin' },
    { usuarioResponsavelId: 'u2', usuarioResponsavelNome: 'operador' },
  ])
  assert.deepEqual(registrantes, [
    { id: 'u1', nome: 'admin' },
    { id: 'u2', nome: 'operador' },
  ])
})

test('modo local: filtros de troca iguais aos da tela', () => {
  const hoje = new Date()
  const iso = (dias) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}T00:00:00+00:00`
  }
  const saidas = [
    { id: 'vencida', dataTroca: iso(-1), isTroca: true },
    { id: 'hoje', dataTroca: iso(0) },
    { id: 'semana', dataTroca: iso(5) },
    { id: 'longe', dataTroca: iso(30) },
    { id: 'sem-data', dataTroca: null },
  ]
  const ids = (filtros) => filtrarTrocasNoNavegador(saidas, filtros).map((saida) => saida.id)
  assert.deepEqual(ids({ trocaPrazo: 'atrasada' }), ['vencida'])
  assert.deepEqual(ids({ trocaPrazo: 'limite' }), ['hoje'])
  assert.deepEqual(ids({ trocaPrazo: 'alerta' }), ['semana'])
  assert.deepEqual(ids({ trocaPrazo: 'sem-data' }), ['longe', 'sem-data'])
  assert.deepEqual(ids({ trocaOnly: true }), ['vencida'])
})

test('filtros de troca da tela de Saidas vao para a consulta', () => {
  assert.deepEqual(buildSaidasQuery({ trocaPrazo: 'alerta', trocaOnly: true, termo: ' joao ' }), {
    trocaPrazo: 'alerta',
    trocaOnly: true,
    termo: 'joao',
  })
})

test('funcoes de lista: tenant da sessao, permissao, username e sem acesso anonimo', () => {
  const migration = ler('supabase/migrations/20261005_listas_movimentacoes_paginadas.sql')
  for (const funcao of ['rpc_entradas_listar', 'rpc_saidas_listar', 'rpc_movimentacao_registrantes', 'rpc_materiais_buscar']) {
    assert.match(migration, new RegExp(`function public\\.${funcao}\\(`))
    assert.match(migration, new RegExp(`revoke all on function public\\.${funcao}\\([^)]*\\) from public, anon;`))
  }
  assert.equal(migration.match(/v_owner uuid := public\.current_account_owner_id\(\)/g)?.length, 4)
  assert.equal(migration.match(/perform public\._movimentacao_pode_listar\(\)/g)?.length, 4)
  assert.match(migration, /nullif\(btrim\(u\.username\), ''\), nullif\(btrim\(u\.display_name\), ''\)/)
  assert.match(migration, /from public\.app_users_dependentes d where d\.auth_user_id = p_usuario_id/)
  assert.match(migration, /count\(\*\) over \(\)/)
})

test('telas leem a pagina do banco e o total, sem filtrar no navegador', () => {
  const api = ler('src/services/api.js')
  assert.match(api, /'rpc_entradas_listar'/)
  assert.match(api, /'rpc_saidas_listar'/)
  assert.match(api, /p_filtros: filtros, p_limite: quantidade, p_offset: offset/)
  assert.match(api, /rpc\('rpc_materiais_buscar'/)

  const entradas = ler('src/hooks/useEntradasController.js')
  assert.match(entradas, /listEntradasPagina\(query, \{ page: paginaAlvo, pageSize: TABLE_PAGE_SIZE \}\)/)
  assert.match(entradas, /getSaldoMaterialCentro\(entrada\.materialId, entrada\.centroCustoId\)/)
  assert.doesNotMatch(entradas, /listSaidas|filteredEntradas = useMemo/)

  const saidas = ler('src/hooks/useSaidasController.js')
  assert.match(saidas, /listSaidasPagina\(query, \{ page: paginaAlvo, pageSize: TABLE_PAGE_SIZE \}\)/)
  assert.doesNotMatch(saidas, /listPessoasByIds|saidasFiltradas = useMemo/)

  assert.match(ler('src/pages/EntradasPage.jsx'), /totalItems=\{totalEntradas\}/)
  assert.match(ler('src/pages/SaidasPage.jsx'), /totalItems=\{totalSaidas\}/)
  assert.match(ler('src/components/Estoque/List/EstoqueList.jsx'), /listSaidasPagina\(params, \{ page, pageSize: saidaPageSize \}\)/)
})
