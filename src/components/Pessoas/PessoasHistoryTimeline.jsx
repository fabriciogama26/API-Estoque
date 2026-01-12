import { useMemo } from 'react'
import { TablePagination } from '../TablePagination.jsx'
import { HISTORY_PAGE_SIZE } from '../../config/pagination.js'
import { useHistoryPagination } from '../../hooks/useHistoryPagination.js'
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
  observacao: 'Observacao',
}

function formatValue(campo, valor) {
  if (campo === 'ativo') {
    const texto = String(valor || '').trim().toLowerCase()
    if (!texto || texto === 'null' || texto === 'undefined') {
      return '-'
    }
    if (['false', '0', 'inativo', 'inact', 'nao'].includes(texto)) {
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

const buildChanges = (registro) => {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return []
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      const before = formatValue(campo, de)
      const after = formatValue(campo, para)
      if (before === after) return null
      return { campo, label, before, after }
    })
    .filter(Boolean)
}

export function PessoasHistoryTimeline({ registros }) {
  const ordered = useMemo(() => {
    if (!registros?.length) {
      return []
    }
    return registros.slice().sort((a, b) => new Date(b.dataEdicao) - new Date(a.dataEdicao))
  }, [registros])

  const { pageItems, currentPage, pageSize, totalItems, setPage } = useHistoryPagination(
    ordered,
    HISTORY_PAGE_SIZE,
  )

  if (!ordered.length) {
    return null
  }

  return (
    <>
      <ul className="entradas-history__list">
        {pageItems.map((registro) => {
          const changes = buildChanges(registro)
          return (
            <li key={registro.id} className="entradas-history__item">
              <div className="entradas-history__item-header">
                <div>
                  <strong>{formatDateTime(registro.dataEdicao)}</strong>
                  <p>{registro.usuarioResponsavel || '-'}</p>
                </div>
              </div>
              <div className="entradas-history__item-body">
                {changes.length === 0 ? (
                  <p className="feedback">Sem alteracoes registradas.</p>
                ) : (
                  changes.map((change) => (
                    <p key={`${registro.id}-${change.campo}`}>
                      <strong>{change.label}:</strong> "{change.before}" -> "{change.after}"
                    </p>
                  ))
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <TablePagination
        totalItems={totalItems}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setPage}
      />
    </>
  )
}
