import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { montarEstoqueAtual } from '../src/lib/estoque.js'
import {
  canResolveStockCorrection,
  correctionUserName,
  dedupeStockCentersById,
  matchesCorrectionMaterial,
} from '../src/lib/stockCorrections.js'

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

test('estoque preserva os ids dos centros mesmo quando possuem o mesmo nome', () => {
  const entradas = [
    { ...entrada, id: 'e1', centroCustoId: 'centro-a', centroCusto: 'Almox', quantidade: 10 },
    { ...entrada, id: 'e2', centroCustoId: 'centro-b', centroCusto: 'Almox', quantidade: 6 },
  ]
  const result = montarEstoqueAtual([material], entradas, [])
  assert.deepEqual(result.itens[0].centrosEstoqueDetalhes, [
    { id: 'centro-a', nome: 'Almox' },
    { id: 'centro-b', nome: 'Almox' },
  ])
})

test('opcoes de correcao removem centros repetidos por id sem agrupar nomes iguais', () => {
  const centers = dedupeStockCentersById([
    { id: 'centro-a', nome: 'Almox', saldo: 3 },
    { id: 'centro-a', nome: 'Nome repetido vindo da RPC', saldo: 99 },
    { id: 'centro-b', nome: 'Almox', saldo: 7 },
  ])

  assert.deepEqual(centers, [
    { id: 'centro-a', nome: 'Almox', saldo: 3 },
    { id: 'centro-b', nome: 'Almox', saldo: 7 },
  ])
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
  assert.match(migration, /function public\.rpc_stock_balance/)
})

test('API de correções consulta somente colunas existentes em materiais', () => {
  const service = readFileSync(new URL('../src/services/stockCorrectionsApi.js', import.meta.url), 'utf8')
  const view = readFileSync(
    new URL('../supabase/migrations/0055_fix_materiais_view_username_priority.sql', import.meta.url),
    'utf8',
  )
  assert.match(service, /from\('materiais_view'\)\.select\(MATERIAL_DETAIL_COLUMNS\)/)
  const columns = service
    .match(/MATERIAL_DETAIL_COLUMNS = \[([\s\S]*?)\]/)[1]
    .match(/'[^']+'/g)
    .map((column) => column.replace(/['"]/g, ''))
  assert.ok(columns.includes('ca') && columns.includes('materialItemNome'))
  for (const column of columns) {
    assert.match(view, new RegExp(`(?:m\\.|AS )"?${column}"?,`), `materiais_view sem a coluna ${column}`)
  }
  assert.match(service, /rpc\('rpc_stock_correction_material_options'\)/)
  assert.match(service, /rpc\('rpc_catalog_list', \{ p_table: 'centros_estoque' \}\)/)
  assert.doesNotMatch(service, /material:materiais\(/)
  assert.doesNotMatch(service, /from\('materiais'\).*materialItemNome/)
})

test('catalogos operacionais nunca liberam todos os tenants para master', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261001_fix_operational_catalog_tenant_scope.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /where account_owner_id = \$1/)
  assert.doesNotMatch(migration, /if v_is_master then/)
  assert.match(migration, /m\.account_owner_id = public\.current_account_owner_id\(\)/)
})

test('consulta de saldo usada nas movimentações inclui ajustes aprovados', () => {
  const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8')
  assert.match(api, /from\('stock_adjustments'\)/)
  assert.match(api, /supabase\.rpc\('rpc_stock_balance'/)
  assert.match(api, /adjustment_quantity/)
  assert.match(api, /calcularSaldoMaterial\(materialId, entradasNormalizadas, saidasNormalizadas, null\) \+ totalAjustes/)
})

test('titular aprova ou rejeita a propria correcao; dependente so a de outros usuarios', () => {
  const propria = { status: 'PENDENTE', requested_by: 'user-1' }
  const deOutro = { status: 'PENDENTE', requested_by: 'user-2' }

  assert.equal(canResolveStockCorrection({ row: propria, userId: 'user-1', canApprove: true, isAccountOwner: true }), true)
  assert.equal(canResolveStockCorrection({ row: propria, userId: 'user-1', canApprove: true, isAccountOwner: false }), false)
  assert.equal(canResolveStockCorrection({ row: deOutro, userId: 'user-1', canApprove: true, isAccountOwner: false }), true)
  assert.equal(canResolveStockCorrection({ row: propria, userId: 'user-1', canApprove: false, isAccountOwner: true }), false)
  assert.equal(
    canResolveStockCorrection({ row: { ...propria, status: 'APROVADO' }, userId: 'user-1', canApprove: true, isAccountOwner: true }),
    false,
  )
})

test('aprovacao da propria correcao no banco depende de ser o titular da conta', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261009_stock_correction_titular_aprova_propria.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /v_req\.requested_by = auth\.uid\(\) and v_session_owner is distinct from auth\.uid\(\)/)
  assert.match(migration, /v_session_owner uuid := public\.current_account_owner_id\(\)/)
  assert.doesNotMatch(migration, /display_name/)
})

test('solicitante usa o username, como o "Registrado por" de Entradas e Saidas', () => {
  assert.equal(correctionUserName({ username: 'fabricio', display_name: 'ADMINISTRADORA', email: 'a@b.com' }), 'fabricio')
  assert.equal(correctionUserName({ username: ' ', display_name: 'ADMINISTRADORA' }), 'ADMINISTRADORA')
  assert.equal(correctionUserName({ email: 'a@b.com' }), 'a@b.com')
  assert.equal(correctionUserName(null), '')
})

test('filtro de material aceita ID, CA ou nome, sem diferenciar acento e maiusculas', () => {
  const row = {
    material_id: '75e02ed8-a897-49f0-b462-eb67a5e63e5d',
    material: {
      id: '75e02ed8-a897-49f0-b462-eb67a5e63e5d',
      materialItemNome: 'Óculos de segurança',
      ca: '12345',
      descricao: 'Lente incolor',
      fabricanteNome: 'Kalipso',
    },
  }
  assert.equal(matchesCorrectionMaterial(row, ''), true)
  assert.equal(matchesCorrectionMaterial(row, '75e02ed8-a897-49f0-b462-eb67a5e63e5d'), true)
  assert.equal(matchesCorrectionMaterial(row, '75E02ED8'), true)
  assert.equal(matchesCorrectionMaterial(row, '12345'), true)
  assert.equal(matchesCorrectionMaterial(row, 'oculos SEGURANCA'), true)
  assert.equal(matchesCorrectionMaterial(row, 'kalipso incolor'), true)
  assert.equal(matchesCorrectionMaterial(row, 'luva'), false)
  assert.equal(matchesCorrectionMaterial(row, 'oculos 99999'), false)
  assert.equal(matchesCorrectionMaterial({ material_id: 'abc-123', material: null }, 'abc'), true)
})
