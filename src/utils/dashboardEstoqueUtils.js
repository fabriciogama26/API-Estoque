export const CURRENT_YEAR = new Date().getFullYear()

export const initialDashboardEstoqueFilters = {
  periodoInicio: `${CURRENT_YEAR}-01`,
  periodoFim: `${CURRENT_YEAR}-12`,
  termo: '',
}

export const chartInfoMessagesEstoque = {
  entradas: 'Comparativo mensal entre entradas e saidas considerando os filtros atuais.',
  valor: 'Evolucao do valor financeiro movimentado (entradas x saidas) no periodo filtrado.',
  estoqueMaterial: 'Ranking dos materiais com maior volume de saidas dentro do periodo filtrado.',
  estoqueCategoria: 'Categorias dos materiais que mais geraram saidas no periodo.',
  topFabricantes: 'Fabricantes com maior movimentacao (entradas + saidas) dentro do periodo.',
  topCentros: 'Total de EPIs entregues por centro de servico de acordo com as saidas filtradas.',
  topSetores: 'Total de entregas por setor considerando as saidas filtradas.',
  topPessoas: 'Colaboradores que mais receberam EPIs no periodo filtrado.',
  topTrocasMateriais: 'Materiais com maior volume de trocas realizadas no periodo filtrado.',
  topTrocasSetores: 'Setores com maior volume de trocas realizadas no periodo filtrado.',
  topTrocasPessoas: 'Pessoas que mais realizaram trocas de EPIs no periodo filtrado.',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

export const sanitizeDisplayText = (value) => (value ? String(value).trim() : '')

export function resolveFabricanteDisplay(material = {}) {
  const candidatos = [material.fabricanteNome, material.fabricante]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return 'Nao informado'
}

export function resolveCentroServicoDisplay(saida = {}) {
  const candidatos = [
    saida.centroServicoNome,
    saida.centroServico,
    saida.setorNome,
    saida.setor,
    saida.local,
    saida.pessoa?.centroServico,
    saida.pessoa?.setor,
    saida.pessoa?.local,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return 'Nao informado'
}

export function resolveSetorDisplay(saida = {}) {
  const candidatos = [
    saida.setorNome,
    saida.setor,
    saida.pessoa?.setor,
    saida.pessoa?.centroServico,
    saida.pessoa?.local,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return 'Nao informado'
}

export function resolvePessoaDisplay(saida = {}) {
  const candidatos = [saida.pessoa?.nome, saida.pessoaNome, saida.nome]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto) {
      return texto
    }
  }
  return 'Nao informado'
}

const normalizeStatusText = (value) => sanitizeDisplayText(value).toLowerCase()

const isSaidaCancelada = (saida = {}) => {
  const status = normalizeStatusText(saida.statusNome || saida.status)
  return status === 'cancelado'
}

export function formatEstoqueMaterialLabel(item = {}) {
  const base = item.resumo || [item.nome, resolveFabricanteDisplay(item)].filter(Boolean).join(' | ')
  const partes = base.split('|').map((parte) => sanitizeDisplayText(parte)).filter(Boolean)
  const compacto = partes.slice(0, 3).join(' | ')
  if (compacto.length <= 55) {
    return compacto
  }
  return `${compacto.slice(0, 52)}...`
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))

export function formatPeriodoLabel(periodo) {
  if (!periodo) return ''
  const [ano, mes] = periodo.split('-')
  if (!mes) return ano
  return `${mes.padStart(2, '0')}/${ano}`
}

const normalizeSearchValue = (value) => {
  const texto = sanitizeDisplayText(value)
  if (!texto) {
    return ''
  }
  const normalized =
    typeof texto.normalize === 'function' ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : texto
  return normalized.toLowerCase()
}

export const normalizarTermo = (termo) => normalizeSearchValue(termo)

const combinaComTermo = (material = {}, termoNormalizado = '') => {
  if (!termoNormalizado) return true
  const partes = [
    material.nome,
    material.fabricante,
    material.fabricanteNome,
    material.resumo,
    material.grupoMaterial,
    material.grupoMaterialNome,
    material.categoria,
  ]
    .map((parte) => normalizeSearchValue(parte))
    .filter(Boolean)
    .join(' ')
  return partes.includes(termoNormalizado)
}

const combinaSaidaComTermo = (saida = {}, termoNormalizado = '') => {
  if (!termoNormalizado) return true
  const campos = [
    saida.nome,
    saida.pessoa?.nome,
    saida.pessoa?.matricula,
    saida.pessoa?.cargo,
    saida.pessoa?.centroServico,
    saida.pessoa?.setor,
    saida.pessoa?.local,
    saida.pessoaNome,
    saida.centroServico,
    saida.centroServicoNome,
    saida.setor,
    saida.setorNome,
    saida.local,
    saida.material?.nome,
    saida.material?.materialItemNome,
    saida.material?.fabricante,
    saida.material?.fabricanteNome,
    saida.material?.resumo,
    saida.material?.grupoMaterialNome,
    saida.material?.grupoMaterial,
    saida.material?.categoria,
  ]
  const corpus = campos.map((campo) => normalizeSearchValue(campo)).filter(Boolean).join(' ')
  return corpus.includes(termoNormalizado)
}

export const filtrarPorTermo = (lista = [], termoNormalizado) => {
  if (!termoNormalizado) return lista
  return lista.filter((item) => {
    if (
      item?.pessoa ||
      item?.pessoaId ||
      item?.centroServico ||
      item?.setor ||
      item?.local ||
      item?.pessoaNome
    ) {
      return combinaSaidaComTermo(item, termoNormalizado)
    }
    return combinaComTermo(item.material ?? item, termoNormalizado)
  })
}

export function agruparPorPeriodo(entradas = [], saidas = []) {
  const mapa = new Map()

  entradas.forEach((item) => {
    const data = new Date(item.dataEntrada)
    if (Number.isNaN(data.getTime())) return
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, { periodo: key, entradas: 0, valorEntradas: 0, saidas: 0, valorSaidas: 0 })
    }

    const atual = mapa.get(key)
    const valorUnitario = Number(item.material?.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)

    atual.entradas += quantidade
    atual.valorEntradas = Number((atual.valorEntradas + quantidade * valorUnitario).toFixed(2))
  })

  saidas.forEach((item) => {
    const data = new Date(item.dataEntrega)
    if (Number.isNaN(data.getTime())) return
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, { periodo: key, entradas: 0, valorEntradas: 0, saidas: 0, valorSaidas: 0 })
    }

    const atual = mapa.get(key)
    const valorUnitario = Number(item.material?.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)

    atual.saidas += quantidade
    atual.valorSaidas = Number((atual.valorSaidas + quantidade * valorUnitario).toFixed(2))
  })

  return Array.from(mapa.values()).sort((a, b) => a.periodo.localeCompare(b.periodo))
}

export const montarTopMateriaisSaida = (saidas = [], termoNormalizado) => {
  const materiais = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material
    if (!material) {
      return
    }
    const nome = formatEstoqueMaterialLabel(material)
    const chave = material.id || nome
    const descricao = material.resumo || [material.nome, resolveFabricanteDisplay(material)].filter(Boolean).join(' | ')
    const atual = materiais.get(chave) ?? {
      materialId: material.id ?? chave,
      nome,
      descricao: descricao || nome,
      filtro: nome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    materiais.set(chave, atual)
  })
  return Array.from(materiais.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopCategoriasSaida = (saidas = [], termoNormalizado) => {
  const categorias = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material
    const categoria =
      material?.grupoMaterialNome ||
      material?.grupoMaterial ||
      material?.categoria ||
      material?.grupo ||
      'Nao classificado'
    const atual = categorias.get(categoria) ?? {
      categoria,
      nome: categoria,
      filtro: categoria,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    categorias.set(categoria, atual)
  })
  return Array.from(categorias.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarRankingFabricantes = (saidas = [], termoNormalizado) => {
  const fabricantes = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material ?? {}
    const nome = resolveFabricanteDisplay(material)
    const chave = material.fabricante || nome || 'Nao informado'
    const atual = fabricantes.get(chave) ?? {
      id: chave,
      nome,
      descricao: nome,
      filtro: nome,
      quantidade: 0,
    }
    atual.nome = nome || atual.nome
    atual.descricao = nome || atual.descricao
    atual.filtro = nome || atual.filtro
    atual.quantidade += Number(saida.quantidade ?? 0)
    fabricantes.set(chave, atual)
  })

  return Array.from(fabricantes.values()).sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopCentrosServico = (saidas = [], termoNormalizado) => {
  const centros = new Map()

  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const centroNome = resolveCentroServicoDisplay(saida)
    const centroId = saida.centroServicoId || saida.setorId || centroNome
    const atual = centros.get(centroId) ?? {
      id: centroId,
      nome: centroNome,
      descricao: centroNome,
      filtro: centroNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    centros.set(centroId, atual)
  })

  return Array.from(centros.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopSetores = (saidas = [], termoNormalizado) => {
  const setores = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const setorNome = resolveSetorDisplay(saida)
    const setorId = saida.setorId || setorNome
    const atual = setores.get(setorId) ?? {
      id: setorId,
      nome: setorNome,
      descricao: setorNome,
      filtro: setorNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    setores.set(setorId, atual)
  })
  return Array.from(setores.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopPessoas = (saidas = [], termoNormalizado) => {
  const pessoas = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const pessoaNome = resolvePessoaDisplay(saida)
    const pessoaId = saida.pessoaId || pessoaNome
    const atual = pessoas.get(pessoaId) ?? {
      id: pessoaId,
      nome: pessoaNome,
      descricao: pessoaNome,
      filtro: pessoaNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    pessoas.set(pessoaId, atual)
  })
  return Array.from(pessoas.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}
export const montarTopTrocasMateriais = (saidas = [], termoNormalizado) => {
  const materiais = new Map()
  saidas.forEach((saida) => {
    if (!saida?.isTroca || isSaidaCancelada(saida)) {
      return
    }
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material
    if (!material) {
      return
    }
    const nome = formatEstoqueMaterialLabel(material)
    const chave = material.id || nome
    const descricao = material.resumo || [material.nome, resolveFabricanteDisplay(material)].filter(Boolean).join(' | ')
    const atual = materiais.get(chave) ?? {
      materialId: material.id ?? chave,
      nome,
      descricao: descricao || nome,
      filtro: nome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    materiais.set(chave, atual)
  })
  return Array.from(materiais.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopTrocasSetores = (saidas = [], termoNormalizado) => {
  const setores = new Map()
  saidas.forEach((saida) => {
    if (!saida?.isTroca || isSaidaCancelada(saida)) {
      return
    }
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const setorNome = resolveSetorDisplay(saida)
    const setorId = saida.setorId || setorNome
    const atual = setores.get(setorId) ?? {
      id: setorId,
      nome: setorNome,
      descricao: setorNome,
      filtro: setorNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    setores.set(setorId, atual)
  })
  return Array.from(setores.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const montarTopTrocasPessoas = (saidas = [], termoNormalizado) => {
  const pessoas = new Map()
  saidas.forEach((saida) => {
    if (!saida?.isTroca || isSaidaCancelada(saida)) {
      return
    }
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const pessoaNome = resolvePessoaDisplay(saida)
    const pessoaId = saida.pessoaId || pessoaNome
    const atual = pessoas.get(pessoaId) ?? {
      id: pessoaId,
      nome: pessoaNome,
      descricao: pessoaNome,
      filtro: pessoaNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    pessoas.set(pessoaId, atual)
  })
  return Array.from(pessoas.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}
