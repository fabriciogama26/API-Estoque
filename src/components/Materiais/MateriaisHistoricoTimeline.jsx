import { useMemo } from 'react'
import { TablePagination } from '../TablePagination.jsx'
import { HISTORY_PAGE_SIZE } from '../../config/pagination.js'
import { useHistoryPagination } from '../../hooks/useHistoryPagination.js'
import { formatCurrency } from '../../utils/MateriaisUtils.js'
import { formatSelectionValue } from '../../utils/selectionUtils.js'

const FIELD_LABELS = {
  materialItemNome: 'Material',
  nome: 'Material',
  fabricanteNome: 'Fabricante',
  validadeDias: 'Validade (dias)',
  ca: 'CA',
  valorUnitario: 'Valor unitario',
  estoqueMinimo: 'Estoque minimo',
  ativo: 'Status',
  descricao: 'Descricao',
  grupoMaterial: 'Grupo de material',
  grupoMaterialNome: 'Grupo de material',
  numeroCalcado: 'Numero de calcado',
  numeroVestimenta: 'Numero de vestimenta',
  numeroEspecifico: 'Numero especifico',
  caracteristicaEpi: 'Caracteristicas',
  caracteristicas: 'Caracteristicas',
  caracteristicas_epi: 'Caracteristicas',
  cores: 'Cores',
  corMaterial: 'Cor principal',
}

const SELECTION_FIELDS = new Set(['caracteristicaEpi', 'caracteristicas', 'caracteristicas_epi', 'cores'])

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

const formatValue = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '-'
  }
  if (SELECTION_FIELDS.has(campo)) {
    const texto = formatSelectionValue(valor)
    return texto || '-'
  }
  if (campo === 'corMaterial') {
    const texto = formatSelectionValue(valor)
    return texto || '-'
  }
  if (campo === 'valorUnitario') {
    const numero = Number(valor)
    return Number.isNaN(numero) ? '-' : formatCurrency(numero)
  }
  if (campo === 'ativo') {
    return valor ? 'Ativo' : 'Inativo'
  }
  return String(valor)
}

const buildChanges = (registro) => {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return []
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      const antes = formatValue(campo, de)
      const depois = formatValue(campo, para)
      if (antes === depois) return null
      return { campo, label, before: antes, after: depois }
    })
    .filter(Boolean)
}

export function MateriaisHistoricoTimeline({ registros }) {
  const ordered = useMemo(() => {
    if (!registros?.length) {
      return []
    }
    return registros
      .slice()
      .sort((a, b) => new Date(b.dataRegistro ?? b.criadoEm ?? 0) - new Date(a.dataRegistro ?? a.criadoEm ?? 0))
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
          const data = registro.dataRegistro ?? registro.criadoEm
          const changes = buildChanges(registro)
          return (
            <li key={registro.id} className="entradas-history__item">
              <div className="entradas-history__item-header">
                <div>
                  <strong>{formatDateTime(data)}</strong>
                  <p>{registro.usuarioResponsavel || 'Responsavel nao informado'}</p>
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
