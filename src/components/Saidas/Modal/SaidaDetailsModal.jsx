import { CancelIcon } from '../../icons.jsx'

export function SaidaDetailsModal({
  open,
  saida,
  pessoa,
  material,
  onClose,
  formatPessoaSummary,
  formatMaterialSummary,
  formatDisplayDateTime,
  resolveCentroEstoqueNome,
}) {
  if (!open || !saida) {
    return null
  }

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID da saida</p>
            <h3 className="saida-details__title">{saida.id || 'ID nao informado'}</h3>
          </div>
          <button type="button" className="saida-details__close" onClick={onClose} aria-label="Fechar detalhes">
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Pessoa</span>
              <p className="saida-details__value">{formatPessoaSummary(pessoa) || saida.pessoaId || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Material</span>
              <p className="saida-details__value">{formatMaterialSummary(material) || saida.materialId || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Quantidade</span>
              <p className="saida-details__value">{saida.quantidade ?? '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Status</span>
              <p className="saida-details__value">{saida.status || 'Registrado'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Data de entrega</span>
              <p className="saida-details__value">{formatDisplayDateTime(saida.dataEntrega)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Data de troca</span>
              <p className="saida-details__value">
                {saida.dataTroca ? formatDisplayDateTime(saida.dataTroca) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Centros</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de estoque</span>
              <p className="saida-details__value">
                {resolveCentroEstoqueNome(saida.centroEstoque || saida.centroEstoqueId)}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de custo</span>
              <p className="saida-details__value">{saida.centroCusto || saida.centroCustoId || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de servico</span>
              <p className="saida-details__value">{saida.centroServico || saida.centroServicoId || '-'}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">
                {saida.usuarioResponsavelNome || saida.usuarioResponsavel || saida.usuarioResponsavelId || 'Nao informado'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">
                {saida.criadoEm ? formatDisplayDateTime(saida.criadoEm) : '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">
                {saida.atualizadoEm ? formatDisplayDateTime(saida.atualizadoEm) : '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Usuario edicao</span>
              <p className="saida-details__value">{saida.usuarioEdicao || saida.usuarioEdicaoId || '-'}</p>
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
