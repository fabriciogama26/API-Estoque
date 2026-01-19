export function MaterialDetailsModal({ open, material, onClose, formatCurrency, formatDisplayDateTime }) {
  if (!open || !material) {
    return null
  }

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID do material</p>
            <h3 className="saida-details__title">{material.id || 'ID nao informado'}</h3>
          </div>
          <button type="button" className="saida-details__close" onClick={onClose} aria-label="Fechar detalhes">
            x
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Material</span>
              <p className="saida-details__value">{material.nomeItemRelacionado || material.nome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Grupo</span>
              <p className="saida-details__value">{material.grupoMaterialNome || material.grupoMaterial || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Tamanho</span>
              <p className="saida-details__value">
                {material.numeroCalcadoNome ||
                  material.numeroVestimentaNome ||
                  material.numeroCalcado ||
                  material.numeroVestimenta ||
                  '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">CA</span>
              <p className="saida-details__value">{material.ca || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Validade (dias)</span>
              <p className="saida-details__value">{(material.validadeDias ?? material.validade) || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Valor unitario</span>
              <p className="saida-details__value">
                {material.valorUnitario ? formatCurrency(material.valorUnitario) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Caracteristicas</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Cores</span>
              <p className="saida-details__value">
                {material.coresTexto ||
                  (Array.isArray(material.coresNomes) && material.coresNomes.length
                    ? material.coresNomes.join(', ')
                    : material.corMaterial || '-')}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Caracteristicas</span>
              <p className="saida-details__value">
                {material.caracteristicasTexto ||
                  (Array.isArray(material.caracteristicasNomes) && material.caracteristicasNomes.length
                    ? material.caracteristicasNomes.join(', ')
                    : material.caracteristicaEpi || '-')}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Fabricante</span>
              <p className="saida-details__value">{material.fabricanteNome || material.fabricante || '-'}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">
                {material.usuarioCadastroNome || material.usuarioCadastro || material.usuarioCadastroId || '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">
                {material.criadoEm ? formatDisplayDateTime(material.criadoEm) : '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">
                {material.atualizadoEm ? formatDisplayDateTime(material.atualizadoEm) : '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Usuario edicao</span>
              <p className="saida-details__value">{material.usuarioEdicao || material.usuarioEdicaoId || '-'}</p>
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
