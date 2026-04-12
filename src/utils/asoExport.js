import { formatDate, formatDateTime, resolveAsoStatusMeta } from './asoUtils.js'

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

export const buildAsoCsv = (asos = []) => {
  const headers = [
    'ID',
    'Funcionario',
    'Matricula',
    'Tipo de exame',
    'Data do exame',
    'Proximo vencimento',
    'Dias para vencer',
    'Status',
    'Centro de servico',
    'Setor',
    'Cargo',
    'Observacao',
    'Cadastrado em',
    'Atualizado em',
  ]

  const rows = (Array.isArray(asos) ? asos : []).map((aso) => {
    const status = resolveAsoStatusMeta(aso?.statusVencimento)
    const valores = [
      aso?.id ?? '',
      aso?.funcionario ?? aso?.nome ?? '',
      aso?.matricula ?? '',
      aso?.tipoExame ?? '',
      formatDate(aso?.dataExame),
      formatDate(aso?.proximoVencimento),
      aso?.diasParaVencer ?? '',
      status.label,
      aso?.centroServico ?? '',
      aso?.setor ?? '',
      aso?.cargo ?? '',
      aso?.observacao ?? '',
      formatDateTime(aso?.criadoEm),
      formatDateTime(aso?.atualizadoEm),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return ['sep=;', headers.join(';'), ...rows].join('\n')
}

export const downloadAsoCsv = (asos = [], options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'aso.csv'
  const csvContent = buildAsoCsv(asos)
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
