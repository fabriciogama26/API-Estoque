import { formatDateTimeFull, formatHistoryValue } from '../../../utils/acidentesUtils.js'

const FIELD_LABELS = {
  matricula: 'Matricula',
  nome: 'Nome',
  cargo: 'Cargo',
  data: 'Data do acidente',
  tipo: 'Tipo',
  agente: 'Agente',
  lesao: 'Lesao',
  lesoes: 'Lesoes',
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
  dataEsocial: 'Data eSOCIAL',
  sesmt: 'SESMT',
  dataSesmt: 'Data SESMT',
}

const buildChanges = (registro) => {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return []
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      const before = formatHistoryValue(campo, de)
      const after = formatHistoryValue(campo, para)
      if (before === after) {
        return null
      }
      return { campo, label, before, after }
    })
    .filter(Boolean)
}

export function AcidentesHistoryTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="entradas-history__list">
      {registros
        .slice()
        .sort((a, b) => new Date(b.dataEdicao) - new Date(a.dataEdicao))
        .map((registro) => {
          const changes = buildChanges(registro)
          return (
            <li key={registro.id} className="entradas-history__item">
              <div className="entradas-history__item-header">
                <div>
                  <strong>{formatDateTimeFull(registro.dataEdicao)}</strong>
                  <p>{registro.usuarioResponsavel || 'Responsavel nao informado'}</p>
                </div>
              </div>
              <div className="entradas-history__item-body">
                {changes.length === 0 ? (
                  <p className="feedback">Sem alteracoes registradas.</p>
                ) : (
                  changes.map((change) => (
                    <p key={`${registro.id}-${change.campo}`}>
                      <strong>{change.label}:</strong> "{change.before}" → "{change.after}"
                    </p>
                  ))
                )}
              </div>
            </li>
          )
        })}
    </ul>
  )
}
