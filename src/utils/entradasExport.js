import { formatDisplayDateTime } from './saidasUtils.js'
import { formatMaterialSummary, normalizeSearchValue } from './entradasUtils.js'

const sanitizeCsvValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : String(value)
  const clean = text.replace(/"/g, '""').replace(/\r?\n/g, ' ').trim()
  if (/[;"\n]/.test(clean)) {
    return `"${clean}"`
  }
  return clean
}

const resolveCentroCustoLabel = (entrada, centrosCustoMap) => {
  if (!entrada) {
    return ''
  }
  const candidatos = [entrada.centroCustoId, entrada.centroCusto]
  for (const raw of candidatos) {
    if (!raw) continue
    const texto = raw.toString().trim()
    if (!texto) continue
    const label =
      centrosCustoMap.get(raw) ||
      centrosCustoMap.get(texto) ||
      centrosCustoMap.get(normalizeSearchValue(texto))
    if (label) {
      return label
    }
  }
  return entrada.centroCusto || entrada.centroCustoId || ''
}

export const buildEntradasCsv = (entradas = [], context = {}) => {
  const materiaisMap = context.materiaisMap instanceof Map ? context.materiaisMap : new Map()
  const centrosCustoMap = context.centrosCustoMap instanceof Map ? context.centrosCustoMap : new Map()

  const headers = [
    'ID',
    'Centro de estoque',
    'Material',
    'Descricao',
    'Quantidade',
    'Status',
    'Registrado por',
    'Cadastrado em',
  ]

  const rows = (Array.isArray(entradas) ? entradas : []).map((entrada) => {
    const material = materiaisMap.get(entrada?.materialId) || null
    const valores = [
      entrada?.id ?? '',
      resolveCentroCustoLabel(entrada, centrosCustoMap),
      formatMaterialSummary(material) || material?.nome || entrada?.materialId || '',
      material?.descricao || '',
      entrada?.quantidade ?? '',
      entrada?.statusNome ?? entrada?.status ?? '',
      entrada?.usuarioResponsavelNome || entrada?.usuarioResponsavel || entrada?.usuarioResponsavelId || '',
      formatDisplayDateTime(
        entrada?.criadoEm ||
          entrada?.created_at ||
          entrada?.create_at ||
          entrada?.createdAt ||
          entrada?.dataEntrada ||
          entrada?.data_entrada ||
          ''
      ),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return ['sep=;', headers.join(';'), ...rows].join('\n')
}

export const downloadEntradasCsv = (entradas = [], context = {}, options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'entradas.csv'
  const csvContent = buildEntradasCsv(entradas, context)
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
