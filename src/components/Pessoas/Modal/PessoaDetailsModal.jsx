import { CancelIcon } from '../../icons.jsx'

export function PessoaDetailsModal({ open, pessoa, onClose, formatDate, formatDateTime }) {
  if (!open || !pessoa) {
    return null
  }

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID da pessoa</p>
            <h3 className="saida-details__title">{pessoa.id || 'ID nao informado'}</h3>
          </div>
          <button type="button" className="saida-details__close" onClick={onClose} aria-label="Fechar detalhes">
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Dados principais</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Nome</span>
              <p className="saida-details__value">{pessoa.nome || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Matricula</span>
              <p className="saida-details__value">{pessoa.matricula || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Centro de servico</span>
              <p className="saida-details__value">{pessoa.centroServico || pessoa.local || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Setor</span>
              <p className="saida-details__value">{pessoa.setor || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cargo</span>
              <p className="saida-details__value">{pessoa.cargo || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Tipo execucao</span>
              <p className="saida-details__value">{pessoa.tipoExecucao || '-'}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Status</span>
              <p className="saida-details__value">{pessoa.ativo === false ? 'Inativo' : 'Ativo'}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Datas</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Data de admissao</span>
              <p className="saida-details__value">{formatDate(pessoa.dataAdmissao)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Data de demissao</span>
              <p className="saida-details__value">{formatDate(pessoa.dataDemissao)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Cadastrado em</span>
              <p className="saida-details__value">{formatDateTime(pessoa.criadoEm)}</p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Atualizado em</span>
              <p className="saida-details__value">{formatDateTime(pessoa.atualizadoEm)}</p>
            </div>
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <div className="saida-details__item">
              <span className="saida-details__label">Registrado por</span>
              <p className="saida-details__value">
                {pessoa.usuarioCadastroNome ||
                  pessoa.usuarioCadastroUsername ||
                  pessoa.usuarioCadastro ||
                  '-'}
              </p>
            </div>
            <div className="saida-details__item">
              <span className="saida-details__label">Ultima edicao</span>
              <p className="saida-details__value">
                {pessoa.usuarioEdicaoNome || pessoa.usuarioEdicao || pessoa.usuarioEdicaoId || '-'}
              </p>
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
