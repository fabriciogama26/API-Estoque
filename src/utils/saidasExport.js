import { formatDisplayDateSimple, formatDisplayDateTime, formatMaterialSummary } from './saidasUtils.js'

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

const resolveRegistradoPor = (saida) =>
  saida?.usuarioResponsavelNome || saida?.usuarioResponsavelUsername || saida?.usuarioResponsavel || ''

export const buildSaidasCsv = (saidas = [], context = {}) => {
  const pessoasMap = context.pessoasMap instanceof Map ? context.pessoasMap : new Map()
  const materiaisMap = context.materiaisMap instanceof Map ? context.materiaisMap : new Map()
  const centrosEstoqueMap = context.centrosEstoqueMap instanceof Map ? context.centrosEstoqueMap : new Map()

  const headers = [
    'ID',
    'Pessoa',
    'Matricula',
    'Material',
    'Quantidade',
    'Centro de estoque',
    'Centro de custo',
    'Centro de servico',
    'Data entrega',
    'Data troca',
    'Status',
    'Registrado por',
    'Cadastrado em',
  ]

  const rows = (Array.isArray(saidas) ? saidas : []).map((saida) => {
    const pessoa = pessoasMap.get(saida?.pessoaId) || null
    const material = materiaisMap.get(saida?.materialId) || null
    const valores = [
      saida?.id ?? '',
      pessoa?.nome ?? saida?.pessoaId ?? '',
      pessoa?.matricula ?? '',
      formatMaterialSummary(material) || material?.nome || saida?.materialId || '',
      saida?.quantidade ?? '',
      centrosEstoqueMap.get(saida?.centroEstoqueId) || saida?.centroEstoque || saida?.centroEstoqueId || '',
      saida?.centroCusto ?? saida?.centroCustoId ?? '',
      saida?.centroServico ?? saida?.centroServicoId ?? '',
      formatDisplayDateTime(saida?.dataEntrega),
      formatDisplayDateSimple(saida?.dataTroca),
      saida?.statusNome ?? saida?.status ?? '',
      resolveRegistradoPor(saida),
      formatDisplayDateTime(saida?.criadoEm),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return ['sep=;', headers.join(';'), ...rows].join('\n')
}

export const downloadSaidasCsv = (saidas = [], context = {}, options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'saidas.csv'
  const csvContent = buildSaidasCsv(saidas, context)
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
