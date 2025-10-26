const FIELD_LABELS = {
  matricula: 'Matricula',
  nome: 'Nome',
  cargo: 'Cargo',
  data: 'Data do acidente',
  tipo: 'Tipo',
  agente: 'Agente',
  lesao: 'Lesao',
  partesLesionadas: 'Partes lesionadas',
  parteLesionada: 'Parte lesionada',
  centroServico: 'Centro de servico',
  local: 'Local',
  diasPerdidos: 'Dias perdidos',
  diasDebitados: 'Dias debitados',
  hht: 'HHT',
  cid: 'CID',
  cat: 'CAT',
  observacao: 'Observacao',
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('pt-BR')
}

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR')
}

const formatValue = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '-'
  }
  if (campo === 'data') {
    return formatDate(valor)
  }
  if (Array.isArray(valor)) {
    return valor.length ? valor.join(', ') : '-'
  }
  return valor
}

const formatChange = (registro) => {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return 'Sem alteracoes registradas'
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      return `${label}: "${formatValue(campo, de)}" -> "${formatValue(campo, para)}"`
    })
    .join('; ')
}

export function AcidentesHistoryTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="acidentes-history-list">
      {registros
        .slice()
        .sort((a, b) => new Date(b.dataEdicao) - new Date(a.dataEdicao))
        .map((registro) => (
          <li key={registro.id}>
            <span>{formatDateTime(registro.dataEdicao)}</span>
            <span>{registro.usuarioResponsavel || '-'}</span>
            <span>{formatChange(registro)}</span>
          </li>
        ))}
    </ul>
  )
}
