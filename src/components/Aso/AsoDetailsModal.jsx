import { CancelIcon } from '../icons.jsx'
import { formatDate, formatDateTime, resolveAsoStatusMeta } from '../../utils/asoUtils.js'

export function AsoDetailsModal({ open, aso, onClose }) {
  if (!open || !aso) {
    return null
  }

  const status = resolveAsoStatusMeta(aso.statusVencimento)

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID do ASO</p>
            <h3 className="saida-details__title">{aso.id || 'ID nao informado'}</h3>
          </div>
          <button type="button" className="saida-details__close" onClick={onClose} aria-label="Fechar detalhes">
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Funcionario</span>
              <p className="saida-details__value">{aso.funcionario || aso.nome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Matricula</span>
              <p className="saida-details__value">{aso.matricula || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Tipo de exame</span>
              <p className="saida-details__value">{aso.tipoExame || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Status</span>
              <p className="saida-details__value">{status.label}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de servico</span>
              <p className="saida-details__value">{aso.centroServico || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Setor</span>
              <p className="saida-details__value">{aso.setor || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cargo</span>
              <p className="saida-details__value">{aso.cargo || '-'}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Datas</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Data do exame</span>
              <p className="saida-details__value">{formatDate(aso.dataExame)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Proximo vencimento</span>
              <p className="saida-details__value">{formatDate(aso.proximoVencimento)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Dias para vencer</span>
              <p className="saida-details__value">{aso.diasParaVencer === null ? '-' : aso.diasParaVencer}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">{formatDateTime(aso.criadoEm)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">{formatDateTime(aso.atualizadoEm)}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">{aso.usuarioCadastroNome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Ultima edicao</span>
              <p className="saida-details__value">{aso.usuarioEdicaoNome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Observacao</span>
              <p className="saida-details__value">{aso.observacao || '-'}</p>
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
