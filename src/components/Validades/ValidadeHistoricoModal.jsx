import { ORIGEM_REGISTRO_LABELS, STATUS_REGISTRO_LABELS } from '../../config/ValidadesConfig.js'
import { formatDate, formatDateTime, formatValidade } from '../../utils/validadesUtils.js'
import { ValidadesEventosTimeline } from './ValidadesEventosTimeline.jsx'

function RegistroCard({ registro }) {
  return (
    <article className={`validades-registro validades-registro--${registro.status_registro}`}>
      <header className="validades-registro__header">
        <strong>{formatDate(registro.data_realizacao)}</strong>
        <span className={`status-chip validades-registro__situacao validades-registro__situacao--${registro.status_registro}`}>
          {STATUS_REGISTRO_LABELS[registro.status_registro] || registro.status_registro}
        </span>
      </header>
      <dl className="validades-registro__dados">
        <div>
          <dt>Vencimento</dt>
          <dd>{registro.data_vencimento ? formatDate(registro.data_vencimento) : 'Sem validade'}</dd>
        </div>
        <div>
          <dt>Validade aplicada</dt>
          <dd>{formatValidade(registro)}</dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>{ORIGEM_REGISTRO_LABELS[registro.origem_registro] || registro.origem_registro}</dd>
        </div>
        <div>
          <dt>Documento</dt>
          <dd>{registro.numero_documento || '-'}</dd>
        </div>
        <div>
          <dt>Emissora</dt>
          <dd>{registro.entidade_emissora || '-'}</dd>
        </div>
        <div>
          <dt>Registrado por</dt>
          <dd>
            {registro.usuario_cadastro_nome || '-'} em {formatDateTime(registro.criado_em)}
          </dd>
        </div>
      </dl>
      {registro.observacao ? <p className="data-table__muted">Observacao: {registro.observacao}</p> : null}
      {registro.status_registro === 'cancelado' ? (
        <p className="data-table__muted">
          Cancelado por {registro.cancelado_por_nome || '-'} em {formatDateTime(registro.cancelado_em)}: {registro.motivo_cancelamento}
        </p>
      ) : null}
    </article>
  )
}

export function ValidadeHistoricoModal({ state, onClose }) {
  if (!state.open) {
    return null
  }

  const registros = state.data?.registros || []
  const eventos = state.data?.eventos || []
  const dispensas = state.data?.dispensas || []

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="entradas-history__modal validades-modal--wide" onClick={(event) => event.stopPropagation()}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico</h3>
            <p className="entradas-history__subtitle">
              {state.item?.pessoa_nome} - {state.item?.requisito_nome}
            </p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar historico">
            x
          </button>
        </header>
        <div className="entradas-history__body validades-modal__body">
          {state.isLoading ? <p className="feedback">Carregando historico...</p> : null}
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}

          {!state.isLoading && !state.error ? (
            <>
              <h4>Realizacoes ({registros.length})</h4>
              {registros.length ? (
                <div className="validades-registros">
                  {registros.map((registro) => (
                    <RegistroCard key={registro.id} registro={registro} />
                  ))}
                </div>
              ) : (
                <p className="feedback">Nenhuma realizacao registrada.</p>
              )}

              {dispensas.length ? (
                <>
                  <h4>Dispensas</h4>
                  <ul className="validades-timeline__changes">
                    {dispensas.map((dispensa) => (
                      <li key={dispensa.id}>
                        {formatDateTime(dispensa.criado_em)} por {dispensa.criado_por_nome || '-'}: {dispensa.motivo}
                        {dispensa.valida_ate ? ` (ate ${formatDate(dispensa.valida_ate)})` : ''}
                        {dispensa.revogada_em
                          ? ` | revogada em ${formatDateTime(dispensa.revogada_em)}: ${dispensa.motivo_revogacao}`
                          : ' | ativa'}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h4>Eventos</h4>
              <ValidadesEventosTimeline eventos={eventos} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
