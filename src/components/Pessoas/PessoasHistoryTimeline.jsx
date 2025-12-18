import { formatDate, formatDateTime } from '../../utils/pessoasUtils.js'

const FIELD_LABELS = {
  nome: 'Nome',
  matricula: 'Matricula',
  centroServico: 'Centro de servico',
  setor: 'Setor',
  cargo: 'Cargo',
  dataAdmissao: 'Data de admissao',
  dataDemissao: 'Data de demissao',
  tipoExecucao: 'Tipo Execucao',
  ativo: 'Status',
}

function formatValue(campo, valor) {
  if (campo === 'ativo') {
    const texto = String(valor || '').trim().toLowerCase()
    if (!texto || texto === 'null' || texto === 'undefined') {
      return '-'
    }
    if (['false', '0', 'inativo', 'inact', 'nao', 'não'].includes(texto)) {
      return 'Inativo'
    }
    return 'Ativo'
  }
  if (campo === 'dataAdmissao') {
    return valor ? formatDate(valor) : '-'
  }
  if (campo === 'dataDemissao') {
    return valor ? formatDate(valor) : '-'
  }
  if (valor === undefined || valor === null || valor === '') {
    return '-'
  }
  return valor
}

function formatChange(registro) {
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

export function PessoasHistoryTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="pessoas-history-list">
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
