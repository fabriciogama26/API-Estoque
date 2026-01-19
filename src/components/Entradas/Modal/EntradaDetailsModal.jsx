import { CancelIcon } from '../../icons.jsx'

export function EntradaDetailsModal({
  open,
  entrada,
  materialResumo,
  materialId,
  descricaoMaterial,
  centroCustoLabel,
  dataEntrada,
  statusLabel,
  valorUnitario,
  valorTotal,
  registradoPor,
  cadastradoEm,
  atualizadoEm,
  usuarioEdicao,
  onClose,
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
}) {
  if (!open || !entrada) {
    return null
  }

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID da entrada</p>
            <h3 className="saida-details__title">{entrada.id || 'ID nao informado'}</h3>
          </div>
          <button
            type="button"
            className="saida-details__close"
            onClick={onClose}
            aria-label="Fechar detalhes da entrada"
          >
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Material</span>
              <p className="saida-details__value">{materialResumo || materialId || 'Material removido'}</p>
              <p className="data-table__muted">ID: {materialId || 'Nao informado'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Descricao</span>
              <p className="saida-details__value">{descricaoMaterial}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Quantidade</span>
              <p className="saida-details__value">{entrada.quantidade ?? '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de estoque</span>
              <p className="saida-details__value">{centroCustoLabel}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Data da entrada</span>
              <p className="saida-details__value">{formatDisplayDate(dataEntrada)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Status</span>
              <p className="saida-details__value">{statusLabel}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Valores</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Valor unitario</span>
              <p className="saida-details__value">{formatCurrency(valorUnitario)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Valor total</span>
              <p className="saida-details__value">{formatCurrency(valorTotal)}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">{registradoPor || 'Nao informado'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">
                {cadastradoEm ? formatDisplayDateTime(cadastradoEm) : 'Nao informado'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">
                {atualizadoEm ? formatDisplayDateTime(atualizadoEm) : 'Nao informado'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Usuario edicao</span>
              <p className="saida-details__value">{usuarioEdicao || 'Nao informado'}</p>
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
