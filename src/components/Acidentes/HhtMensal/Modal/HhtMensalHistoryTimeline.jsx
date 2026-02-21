import { TablePagination } from '../../../TablePagination.jsx'
import { HISTORY_PAGE_SIZE } from '../../../../config/pagination.js'
import { useHistoryPagination } from '../../../../hooks/useHistoryPagination.js'
import { formatDateTimeFullPreserve } from '../../../../utils/acidentesUtils.js'

const FIELD_LABELS = {
  mes_ref: 'Mes ref',
  mesRef: 'Mes ref',
  centro_servico_id: 'Centro de servico',
  centroServicoId: 'Centro de servico',
  qtd_pessoas: 'Qtd pessoas',
  qtdPessoas: 'Qtd pessoas',
  horas_mes_base: 'Horas base',
  horasMesBase: 'Horas base',
  escala_factor: 'Fator escala',
  escalaFactor: 'Fator escala',
  horas_afastamento: 'Horas afastamento',
  horasAfastamento: 'Horas afastamento',
  horas_ferias: 'Horas ferias',
  horasFerias: 'Horas ferias',
  horas_treinamento: 'Horas treinamento',
  horasTreinamento: 'Horas treinamento',
  horas_outros_descontos: 'Outros descontos',
  horasOutrosDescontos: 'Outros descontos',
  horas_extras: 'Horas extras',
  horasExtras: 'Horas extras',
  modo: 'Modo',
  ativo: 'Ativo',
  hht_informado: 'HHT informado',
  hhtInformado: 'HHT informado',
  hht_calculado: 'HHT calculado',
  hhtCalculado: 'HHT calculado',
  hht_final: 'HHT final',
  hhtFinal: 'HHT final',
  status_hht_id: 'Status',
  statusHhtId: 'Status',
}

const IMPORTANT_FIELDS = [
  ['mes_ref', 'mesRef'],
  ['centro_servico_id', 'centroServicoId'],
  ['modo', 'modo'],
  ['qtd_pessoas', 'qtdPessoas'],
  ['horas_mes_base', 'horasMesBase'],
  ['escala_factor', 'escalaFactor'],
  ['horas_afastamento', 'horasAfastamento'],
  ['horas_ferias', 'horasFerias'],
  ['horas_treinamento', 'horasTreinamento'],
  ['horas_outros_descontos', 'horasOutrosDescontos'],
  ['horas_extras', 'horasExtras'],
  ['hht_informado', 'hhtInformado'],
  ['hht_calculado', 'hhtCalculado'],
  ['hht_final', 'hhtFinal'],
  ['status_hht_id', 'statusHhtId'],
]

const normalizeValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return ''
  }
  return String(value)
}

const readField = (obj, snake, camel) => {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }
  if (obj[snake] !== undefined) {
    return obj[snake]
  }
  return obj[camel]
}

const buildChangesSummary = (antes, depois) => {
  if (!antes || !depois) {
    return []
  }

  const changes = []
  IMPORTANT_FIELDS.forEach(([snake, camel]) => {
    const from = normalizeValue(readField(antes, snake, camel))
    const to = normalizeValue(readField(depois, snake, camel))
    if (from !== to) {
      const label = FIELD_LABELS[snake] ?? FIELD_LABELS[camel] ?? camel
      changes.push(`${label}: "${from || '-'}" -> "${to || '-'}"`)
    }
  })

  return changes
}

export function HhtMensalHistoryTimeline({ registros }) {
  const ordered = Array.isArray(registros) ? registros : []
  const { pageItems, currentPage, pageSize, totalItems, setPage } = useHistoryPagination(
    ordered,
    HISTORY_PAGE_SIZE,
  )

  if (!ordered.length) {
    return <p className="feedback">Nenhum historico registrado.</p>
  }

  return (
    <>
      <ul className="entradas-history__list">
        {pageItems.map((item) => {
          const alteradoEm = item.alteradoEm ?? item.alterado_em ?? null
          const usuario = item.alteradoPor ?? item.alterado_por ?? item.usuario ?? 'sistema'
          const acao = (item.acao ?? '').toUpperCase()
          const changes = acao === 'UPDATE' ? buildChangesSummary(item.antes, item.depois) : []

          return (
            <li key={item.id} className="entradas-history__item">
              <div className="entradas-history__item-header">
                <strong>{acao === 'DELETE' ? 'DELETE' : 'UPDATE'}</strong>
                <span className="data-table__muted">{alteradoEm ? formatDateTimeFullPreserve(alteradoEm) : '-'}</span>
              </div>
              <div className="entradas-history__item-body">
                <p>
                  <strong>Usuario:</strong> {usuario || 'sistema'}
                </p>
                {acao === 'DELETE' ? <p>Registro excluido.</p> : null}
                {acao === 'INSERT' ? <p>Registro criado.</p> : null}
                {acao === 'UPDATE' ? (
                  changes.length ? (
                    <>
                      <p>
                        <strong>Alteracoes:</strong>
                      </p>
                      <ul className="pessoas-history-list">
                        {changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>Nenhuma alteracao relevante detectada.</p>
                  )
                ) : null}
                {item.motivo ? (
                  <p>
                    <strong>Motivo:</strong> {item.motivo}
                  </p>
                ) : null}
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
