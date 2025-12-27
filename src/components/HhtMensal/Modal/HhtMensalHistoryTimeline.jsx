import { formatHhtValue } from '../../../utils/hhtMensalUtils.js'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resolveDate = (registro) =>
  registro?.data ??
  registro?.dataRegistro ??
  registro?.data_registro ??
  registro?.createdAt ??
  registro?.created_at ??
  registro?.criadoEm ??
  registro?.criado_em ??
  null

const resolveUser = (registro) =>
  registro?.usuario ??
  registro?.usuarioResponsavel ??
  registro?.usuario_responsavel ??
  registro?.usuarioCadastroNome ??
  registro?.usuarioCadastro ??
  registro?.createdBy ??
  registro?.created_by_username ??
  null

const buildResumo = (registro) => {
  const statusAtual = registro?.statusNome ?? registro?.status_nome ?? registro?.status ?? registro?.statusAtual ?? null
  const statusAnterior =
    registro?.statusAnterior ??
    registro?.status_anterior ??
    registro?.statusAnteriorNome ??
    registro?.status_anterior_nome ??
    null
  const modoAtual = registro?.modo ?? registro?.modoNovo ?? registro?.modo_atual ?? null
  const modoAnterior = registro?.modoAnterior ?? registro?.modo_anterior ?? null
  const hhtAtual =
    registro?.hhtFinal ??
    registro?.hht_final ??
    registro?.hhtCalculado ??
    registro?.hht_calculado ??
    registro?.hhtInformado ??
    registro?.hht_informado
  const hhtAnterior =
    registro?.hhtFinalAnterior ??
    registro?.hht_final_anterior ??
    registro?.hhtCalculadoAnterior ??
    registro?.hht_calculado_anterior ??
    registro?.hhtAnterior ??
    null
  const motivo = registro?.motivo ?? registro?.motivoEdicao ?? registro?.justificativa ?? registro?.observacao ?? ''

  const partes = []
  if (statusAtual || statusAnterior) {
    partes.push(`Status: ${statusAnterior ? `${statusAnterior} -> ` : ''}${statusAtual || '-'}`)
  }
  if (modoAtual || modoAnterior) {
    partes.push(`Modo: ${modoAnterior ? `${modoAnterior} -> ` : ''}${modoAtual || '-'}`)
  }
  if (hhtAnterior !== undefined && hhtAnterior !== null) {
    partes.push(`HHT anterior: ${formatHhtValue(hhtAnterior)}`)
  }
  if (hhtAtual !== undefined && hhtAtual !== null) {
    partes.push(`HHT atual: ${formatHhtValue(hhtAtual)}`)
  }
  if (motivo) {
    partes.push(`Motivo: ${motivo}`)
  }
  if (partes.length) {
    return partes.join(' | ')
  }
  return registro?.descricao ?? registro?.descricaoAlteracao ?? 'Alteracao registrada.'
}

export function HhtMensalHistoryTimeline({ registros = [] }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="pessoas-history-list">
      {registros
        .slice()
        .sort((a, b) => new Date(resolveDate(b)) - new Date(resolveDate(a)))
        .map((registro, index) => {
          const chave = registro?.id ?? `${resolveDate(registro) ?? 'sem-data'}-${index}`
          return (
            <li key={chave}>
              <span>{formatDateTime(resolveDate(registro))}</span>
              <span>{resolveUser(registro) ?? '-'}</span>
              <span>{buildResumo(registro)}</span>
            </li>
          )
        })}
    </ul>
  )
}
