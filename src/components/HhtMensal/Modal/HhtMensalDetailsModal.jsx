import { formatHhtValue, formatMesRefLabel, normalizeModo } from '../../../utils/hhtMensalUtils.js'

const formatNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return String(value)
  }
  return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DetailItem({ label, value, muted = false }) {
  const display = value !== undefined && value !== null && value !== '' ? value : '-'
  const className = `acidente-details__value${muted ? ' acidente-details__value--muted' : ''}`
  return (
    <div className="acidente-details__item">
      <span className="acidente-details__label">{label}</span>
      <p className={className}>{display}</p>
    </div>
  )
}

export function HhtMensalDetailsModal({ state, onClose }) {
  const open = state?.open
  const registro = state?.registro

  if (!open || !registro) {
    return null
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const mesLabel = formatMesRefLabel(registro.mesRef ?? registro.mes_ref)
  const centro = registro.centroServicoNome ?? registro.centroServico ?? registro.centro_servico_nome ?? '-'
  const statusNome = registro.statusNome ?? registro.status_nome ?? registro.status ?? '-'
  const modo = normalizeModo(registro.modo ?? registro.modoCadastro ?? '')
  const hhtFinal =
    registro.hhtFinal ??
    registro.hht_final ??
    registro.hhtCalculado ??
    registro.hht_calculado ??
    registro.hhtInformado ??
    registro.hht_informado ??
    null
  const hhtCalculado = registro.hhtCalculado ?? registro.hht_calculado ?? null
  const hhtInformado = registro.hhtInformado ?? registro.hht_informado ?? null

  const criadoEm =
    registro.criadoEm ??
    registro.criado_em ??
    registro.createdAt ??
    registro.created_at ??
    registro.dataCriacao ??
    registro.data_criacao ??
    null
  const atualizadoEm =
    registro.atualizadoEm ??
    registro.atualizado_em ??
    registro.updatedAt ??
    registro.updated_at ??
    registro.dataAtualizacao ??
    registro.data_atualizacao ??
    null
  const criadoPor =
    registro.registradoPor ??
    registro.usuarioCadastroNome ??
    registro.usuarioCadastro ??
    registro.createdBy ??
    registro.created_by_username ??
    null
  const atualizadoPor =
    registro.atualizadoPor ??
    registro.usuarioAtualizacaoNome ??
    registro.usuarioAtualizacao ??
    registro.updatedBy ??
    registro.updated_by_username ??
    null
  const motivo = registro.motivo ?? registro.motivoCancelamento ?? registro.motivo_cancelamento ?? ''

  return (
    <div className="acidente-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="acidente-details__modal" onClick={stopPropagation}>
        <header className="acidente-details__header">
          <div>
            <p className="acidente-details__eyebrow">ID do cadastro</p>
            <h3 className="acidente-details__title">{registro.id ?? 'ID nao informado'}</h3>
            <p className="acidente-details__meta">
              {mesLabel ? `Referencia ${mesLabel}` : ''} {centro ? `• ${centro}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="acidente-details__close"
            onClick={onClose}
            aria-label="Fechar detalhes do HHT"
          >
            x
          </button>
        </header>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Resumo</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Mes de referencia" value={mesLabel} />
            <DetailItem label="Centro de servico" value={centro} />
            <DetailItem label="Status" value={statusNome} />
            <DetailItem label="Modo" value={modo} />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Valores</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Quantidade de pessoas" value={formatNumber(registro.qtdPessoas ?? registro.qtd_pessoas)} />
            <DetailItem label="Horas mes base" value={formatNumber(registro.horasMesBase ?? registro.horas_mes_base)} />
            <DetailItem label="Escala" value={formatNumber(registro.escalaFactor ?? registro.escala_factor ?? 1)} />
            <DetailItem label="Horas afastamento" value={formatNumber(registro.horasAfastamento ?? registro.horas_afastamento)} />
            <DetailItem label="Horas ferias" value={formatNumber(registro.horasFerias ?? registro.horas_ferias)} />
            <DetailItem label="Horas treinamento" value={formatNumber(registro.horasTreinamento ?? registro.horas_treinamento)} />
            <DetailItem
              label="Horas outros descontos"
              value={formatNumber(registro.horasOutrosDescontos ?? registro.horas_outros_descontos)}
            />
            <DetailItem label="Horas extras" value={formatNumber(registro.horasExtras ?? registro.horas_extras)} />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">HHT</h4>
          <div className="acidente-details__grid">
            <DetailItem label="HHT calculado" value={formatHhtValue(hhtCalculado)} />
            <DetailItem label="HHT informado" value={formatHhtValue(hhtInformado)} muted={!hhtInformado} />
            <DetailItem label="HHT final" value={formatHhtValue(hhtFinal)} />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Registro</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Registrado por" value={criadoPor || '-'} />
            <DetailItem label="Cadastrado em" value={formatDateTime(criadoEm)} />
            <DetailItem label="Atualizado por" value={atualizadoPor || '-'} muted={!atualizadoPor} />
            <DetailItem label="Atualizado em" value={formatDateTime(atualizadoEm)} muted={!atualizadoEm} />
          </div>
          {motivo ? (
            <div className="acidente-details__text-block">
              <strong>Motivo:</strong> {motivo}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
