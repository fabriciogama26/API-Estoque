const MONTHS_IN_YEAR = 12

function toNumber(value) {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function parsePeriodo(params = {}) {
  if (!params) {
    return null
  }

  const { periodoInicio, periodoFim, ano, mes } = params
  const hasInterval = Boolean(periodoInicio || periodoFim)

  if (hasInterval) {
    const periodo = {}

    if (periodoInicio) {
      const [anoInicioRaw, mesInicioRaw] = String(periodoInicio).split('-')
      const anoInicio = toNumber(anoInicioRaw)
      const mesInicio = toNumber(mesInicioRaw)
      if (anoInicio !== null) {
        periodo.inicio = { ano: anoInicio }
        if (mesInicio !== null) {
          periodo.inicio.mes = mesInicio
        }
      }
    }

    if (periodoFim) {
      const [anoFimRaw, mesFimRaw] = String(periodoFim).split('-')
      const anoFim = toNumber(anoFimRaw)
      const mesFim = toNumber(mesFimRaw)
      if (anoFim !== null) {
        periodo.fim = { ano: anoFim }
        if (mesFim !== null) {
          periodo.fim.mes = mesFim
        }
      }
    }

    if (periodo.inicio && !periodo.fim) {
      periodo.fim = { ...periodo.inicio }
    }
    if (periodo.fim && !periodo.inicio) {
      periodo.inicio = { ...periodo.fim }
    }

    if (periodo.inicio || periodo.fim) {
      return periodo
    }
  }

  const periodoSimples = {}
  const anoNumero = toNumber(ano)
  const mesNumero = toNumber(mes)

  if (anoNumero !== null) {
    periodoSimples.ano = anoNumero
  }
  if (mesNumero !== null) {
    periodoSimples.mes = mesNumero
  }

  return Object.keys(periodoSimples).length ? periodoSimples : null
}

export function resolvePeriodoRange(periodo) {
  if (!periodo) {
    return null
  }

  const makeRange = (ano, mes) => {
    if (ano === null) {
      return null
    }
    const monthIndex = mes !== null && mes !== undefined ? mes - 1 : 0
    const start = new Date(Date.UTC(ano, Math.max(0, monthIndex), 1, 0, 0, 0, 0))
    const endMonthIndex = mes !== null && mes !== undefined ? monthIndex + 1 : MONTHS_IN_YEAR
    const end = new Date(Date.UTC(ano, endMonthIndex, 0, 23, 59, 59, 999))
    return { start, end }
  }

  if (periodo.inicio || periodo.fim) {
    const inicio = periodo.inicio ? makeRange(periodo.inicio.ano ?? null, periodo.inicio.mes ?? null) : null
    const fim = periodo.fim ? makeRange(periodo.fim.ano ?? null, periodo.fim.mes ?? null) : null

    if (!inicio && !fim) {
      return null
    }

    const start = inicio?.start ?? fim?.start
    const end = fim?.end ?? inicio?.end

    return {
      start,
      end,
    }
  }

  if (periodo.ano !== undefined || periodo.mes !== undefined) {
    const range = makeRange(periodo.ano ?? null, periodo.mes ?? null)
    return range ? { start: range.start, end: range.end } : null
  }

  return null
}

export function filtrarPorPeriodo(registro, campoData, periodo) {
  if (!periodo) {
    return true
  }

  const rawValue = registro[campoData]
  if (!rawValue) {
    return false
  }

  const data = new Date(rawValue)
  if (Number.isNaN(data.getTime())) {
    return false
  }

  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + 1

  if (periodo.inicio || periodo.fim) {
    const indice = ano * MONTHS_IN_YEAR + (mes - 1)

    if (periodo.inicio) {
      const inicioAno = toNumber(periodo.inicio.ano)
      const inicioMes = periodo.inicio.mes !== undefined ? toNumber(periodo.inicio.mes) - 1 : 0
      if (inicioAno !== null) {
        const inicioIndice = inicioAno * MONTHS_IN_YEAR + Math.max(0, inicioMes ?? 0)
        if (indice < inicioIndice) {
          return false
        }
      }
    }

    if (periodo.fim) {
      const fimAno = toNumber(periodo.fim.ano)
      const fimMes = periodo.fim.mes !== undefined ? toNumber(periodo.fim.mes) - 1 : MONTHS_IN_YEAR - 1
      if (fimAno !== null) {
        const fimIndice = fimAno * MONTHS_IN_YEAR + Math.max(0, fimMes ?? 0)
        if (indice > fimIndice) {
          return false
        }
      }
    }

    return true
  }

  if (periodo.ano !== undefined && ano !== toNumber(periodo.ano)) {
    return false
  }
  if (periodo.mes !== undefined && mes !== toNumber(periodo.mes)) {
    return false
  }
  return true
}

function verificarEstoqueMinimo(material, estoqueAtual) {
  if (!material) {
    return null
  }
  if (material.estoqueMinimo === undefined || material.estoqueMinimo === null) {
    return null
  }
  if (estoqueAtual <= Number(material.estoqueMinimo)) {
    return {
      materialId: material.id,
      nome: material.nome,
      fabricante: material.fabricante,
      estoqueAtual,
      estoqueMinimo: Number(material.estoqueMinimo),
    }
  }
  return null
}

export function calcularSaldoMaterial(materialId, entradas, saidas, periodo) {
  const entradasFiltradas = entradas
    .filter((entrada) => entrada.materialId === materialId)
    .filter((entrada) => filtrarPorPeriodo(entrada, 'dataEntrada', periodo))

  const saidasFiltradas = saidas
    .filter((saida) => saida.materialId === materialId)
    .filter((saida) => filtrarPorPeriodo(saida, 'dataEntrega', periodo))

  const totalEntradas = entradasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const totalSaidas = saidasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)

  return totalEntradas - totalSaidas
}

function normalizarMaterial(material) {
  if (!material) {
    return null
  }
  return {
    ...material,
    estoqueMinimo: material.estoqueMinimo !== undefined && material.estoqueMinimo !== null
      ? Number(material.estoqueMinimo)
      : null,
    valorUnitario: Number(material.valorUnitario ?? 0),
    validadeDias: material.validadeDias !== undefined ? Number(material.validadeDias) : null,
  }
}

export function montarEstoqueAtual(materiais = [], entradas = [], saidas = [], periodo = null) {
  const materiaisNormalizados = materiais.map((material) => normalizarMaterial(material)).filter(Boolean)

  const itens = materiaisNormalizados.map((material) => {
    const saldo = calcularSaldoMaterial(material.id, entradas, saidas, periodo)
    const alerta = verificarEstoqueMinimo(material, saldo)
    return {
      materialId: material.id,
      nome: material.nome,
      fabricante: material.fabricante,
      validadeDias: material.validadeDias,
      ca: material.ca,
      valorUnitario: material.valorUnitario,
      quantidade: saldo,
      estoqueAtual: saldo,
      valorTotal: Number((saldo * material.valorUnitario).toFixed(2)),
      estoqueMinimo: material.estoqueMinimo,
      alerta,
    }
  })

  const alertas = itens.filter((item) => item.alerta)

  return {
    itens,
    alertas,
  }
}

function agruparHistorico(lista, campoData, materiaisMap) {
  const mapa = new Map()

  lista.forEach((item) => {
    const data = new Date(item[campoData])
    if (Number.isNaN(data.getTime())) {
      return
    }
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${mes}`

    const material = item.material || materiaisMap.get(item.materialId) || null
    const quantidade = Number(item.quantidade ?? 0)
    const valorUnitario = Number(material?.valorUnitario ?? 0)
    const valor = quantidade * valorUnitario

    if (!mapa.has(key)) {
      mapa.set(key, {
        ano,
        mes,
        quantidade: 0,
        valorTotal: 0,
      })
    }

    const atual = mapa.get(key)
    atual.quantidade += quantidade
    atual.valorTotal = Number((atual.valorTotal + valor).toFixed(2))
  })

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.ano !== b.ano) {
      return a.ano - b.ano
    }
    return a.mes - b.mes
  })
}

function somaValores(lista, materiaisMap) {
  return lista.reduce((acc, item) => {
    const material = materiaisMap.get(item.materialId) || null
    if (!material) {
      return acc
    }
    const valorUnitario = Number(material.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)
    return acc + valorUnitario * quantidade
  }, 0)
}

function somaQuantidade(lista) {
  return lista.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
}

export function montarDashboard({ materiais = [], entradas = [], saidas = [], pessoas = [] }, periodo = null) {
  const materiaisNormalizados = materiais.map((material) => normalizarMaterial(material)).filter(Boolean)
  const materiaisMap = new Map(materiaisNormalizados.map((material) => [material.id, material]))
  const pessoasMap = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa]))

  const filtrar = (lista, campoData) => lista.filter((item) => filtrarPorPeriodo(item, campoData, periodo))

  const entradasFiltradas = filtrar(entradas, 'dataEntrada')
  const saidasFiltradas = filtrar(saidas, 'dataEntrega')

  const entradasDetalhadas = entradasFiltradas.map((entrada) => ({
    ...entrada,
    material: materiaisMap.get(entrada.materialId) || null,
  }))

  const saidasDetalhadas = saidasFiltradas.map((saida) => ({
    ...saida,
    material: materiaisMap.get(saida.materialId) || null,
    pessoa: pessoasMap.get(saida.pessoaId) || null,
  }))

  const totalEntradasValor = somaValores(entradasFiltradas, materiaisMap)
  const totalSaidasValor = somaValores(saidasFiltradas, materiaisMap)

  const movimentacaoPorMaterial = materiaisNormalizados.map((material) => {
    const entradasMaterial = entradasFiltradas.filter((item) => item.materialId === material.id)
    const saidasMaterial = saidasFiltradas.filter((item) => item.materialId === material.id)
    const totalQuantidade = entradasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
      + saidasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
    return {
      materialId: material.id,
      nome: material.nome,
      fabricante: material.fabricante,
      totalQuantidade,
    }
  })

  const maisMovimentados = movimentacaoPorMaterial
    .filter((item) => item.totalQuantidade > 0)
    .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
    .slice(0, 10)

  const estoqueAtual = montarEstoqueAtual(materiaisNormalizados, entradas, saidas, periodo)

  const entradasHistoricas = agruparHistorico(entradasDetalhadas, 'dataEntrada', materiaisMap)
  const saidasHistoricas = agruparHistorico(saidasDetalhadas, 'dataEntrega', materiaisMap)

  return {
    periodo: periodo || null,
    entradas: {
      quantidade: somaQuantidade(entradasFiltradas),
      valorTotal: Number(totalEntradasValor.toFixed(2)),
    },
    saidas: {
      quantidade: somaQuantidade(saidasFiltradas),
      valorTotal: Number(totalSaidasValor.toFixed(2)),
    },
    entradasDetalhadas,
    saidasDetalhadas,
    entradasHistoricas,
    saidasHistoricas,
    materiaisMaisMovimentados: maisMovimentados,
    estoqueAtual,
  }
}
