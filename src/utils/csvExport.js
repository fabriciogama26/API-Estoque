// Utilitario de CSV para abrir no Excel pt-BR: separador `;`, linha `sep=;` e BOM UTF-8.
// Mesmo formato ja usado por ASO/Entradas/Saidas; modulos antigos ainda tem copias proprias.

export const sanitizeCsvValue = (value) => {
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

export const buildCsv = (headers = [], rows = []) =>
  ['sep=;', headers.map(sanitizeCsvValue).join(';'), ...rows.map((row) => row.map(sanitizeCsvValue).join(';'))].join('\n')

export const downloadCsv = (content, filename) => {
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
