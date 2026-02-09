import { formatDateTimeFullPreserve, formatDateWithOptionalTime } from './acidentesUtils.js'

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

const formatCsvDate = (value) => {
  if (!value) {
    return ''
  }
  const text = formatDateWithOptionalTime(value)
  return text === '-' ? '' : text
}

const formatCsvDateTime = (value) => {
  if (!value) {
    return ''
  }
  const text = formatDateTimeFullPreserve(value)
  return text === '-' ? '' : text
}

export const buildAcidentesCsv = (acidentes = []) => {
  const headers = [
    'Nome',
    'Matricula',
    'Status',
    'Data',
    'Centro de servico',
    'Local',
    'CAT',
    'CID',
    'Registrado por',
    'Cadastrado em',
  ]

  const rows = (Array.isArray(acidentes) ? acidentes : []).map((acidente) => {
    const status = acidente?.ativo === false ? 'Cancelado' : 'Ativo'
    const centroServico = acidente?.centroServico || acidente?.setor || ''
    const registradoPor =
      acidente?.registradoPor ?? acidente?.usuarioCadastroNome ?? acidente?.usuarioCadastro ?? ''
    const criadoEm =
      acidente?.criadoEm ?? acidente?.criado_em ?? acidente?.createdAt ?? acidente?.created_at ?? ''

    const valores = [
      acidente?.nome ?? '',
      acidente?.matricula ?? '',
      status,
      formatCsvDate(acidente?.data),
      centroServico,
      acidente?.local ?? '',
      acidente?.cat ?? '',
      acidente?.cid ?? '',
      registradoPor,
      formatCsvDateTime(criadoEm),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return [headers.join(';'), ...rows].join('\n')
}

export const downloadAcidentesCsv = (acidentes = [], options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'acidentes.csv'
  const csvContent = buildAcidentesCsv(acidentes)
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
