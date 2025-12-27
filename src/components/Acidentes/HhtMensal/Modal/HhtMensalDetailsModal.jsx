import { CancelIcon } from '../../../icons.jsx'
import { formatDateTimeFullPreserve } from '../../../../utils/acidentesUtils.js'
import { formatHhtValue, formatMesRefLabel } from '../../../../utils/hhtMensalUtils.js'

export function HhtMensalDetailsModal({ state, onClose }) {
  if (!state?.open) {
    return null
  }

  const registro = state.registro ?? {}
  const titulo = `${formatMesRefLabel(registro.mesRef)} | ${registro.centroServicoNome || ''}`.trim()
  const cadastradoEm =
    registro.createdAt ?? registro.created_at ?? registro.criadoEm ?? registro.criado_em ?? null
  const registradoPor =
    registro.registradoPor ??
    registro.createdByName ??
    registro.createdBy ??
    registro.created_by ??
    registro.usuarioCadastroNome ??
    '-'
  const statusNome = registro.statusNome || 'Ativo'
  const atualizadoEm = registro.updatedAt ?? registro.updated_at ?? null
  const atualizadoPor =
    registro.updatedByUsername ??
    registro.updatedByName ??
    registro.updatedBy ??
    registro.updated_by ??
    registro.usuarioEdicao ??
    registro.usuarioEdicaoNome ??
    '-'

  const handleOverlayClick = () => onClose?.()
  const stopPropagation = (event) => event.stopPropagation()

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="saida-details__modal" onClick={stopPropagation}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">Registro de HHT</p>
            <h3 className="saida-details__title">{titulo || 'Detalhes'}</h3>
            {registro.id ? <p className="saida-details__subtitle">{registro.id}</p> : null}
          </div>
          <button
            type="button"
            className="saida-details__close"
            onClick={onClose}
            aria-label="Fechar detalhes"
          >
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Mes</span>
              <p className="saida-details__value">{formatMesRefLabel(registro.mesRef)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de servico</span>
              <p className="saida-details__value">{registro.centroServicoNome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Status</span>
              <p className="saida-details__value">{statusNome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Modo</span>
              <p className="saida-details__value">{registro.modo || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Quantidade de pessoas</span>
              <p className="saida-details__value">{registro.qtdPessoas ?? '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Ativo</span>
              <p className="saida-details__value">{registro.ativo === false ? 'Nao' : 'Sim'}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">HHT</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">HHT final</span>
              <p className="saida-details__value">{formatHhtValue(registro.hhtFinal)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">HHT calculado</span>
              <p className="saida-details__value">{formatHhtValue(registro.hhtCalculado)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">HHT informado</span>
              <p className="saida-details__value">{formatHhtValue(registro.hhtInformado)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Horas base/mês</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasMesBase)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Escala (fator)</span>
              <p className="saida-details__value">{formatHhtValue(registro.escalaFactor)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Horas afastamento</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasAfastamento)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Horas ferias</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasFerias)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Horas treinamento</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasTreinamento)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Outros descontos</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasOutrosDescontos)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Horas extras</span>
              <p className="saida-details__value">{formatHhtValue(registro.horasExtras)}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">{registradoPor || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">{formatDateTimeFullPreserve(cadastradoEm)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">{formatDateTimeFullPreserve(atualizadoEm)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado por</span>
              <p className="saida-details__value">{atualizadoPor || '-'}</p>
            </div>
          </div>
        </div>

        <footer className="saida-details__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
