import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon } from '../components/icons.jsx'
import { AutoResizeIframe } from '../components/AutoResizeIframe.jsx'
import { useTermoEpi } from '../hooks/useTermoEpi.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import '../styles/DocumentPreviewModal.css'

export function TermosEpiPage() {
  const {
    form,
    preview,
    isDownloading,
    resumo,
    handleChange,
    handleSubmit,
    handleReset,
    handleDownload,
  } = useTermoEpi()

  const { context, ultimaEntregaLabel, origemLabel } = resumo

  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Termo de EPI"
        subtitle="Pesquise colaboradores e gere o termo de responsabilidade de EPI."
        actions={<HelpButton topic="termoEpi" />}
      />

      <section className="card">
        <header className="card__header">
          <h2>Gerar termo</h2>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__grid form__grid--two">
            <label className="field">
              <span>Matricula</span>
              <input
                name="matricula"
                value={form.matricula}
                onChange={handleChange}
                placeholder="Ex.: 12345"
              />
            </label>
            <label className="field">
              <span>Nome</span>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex.: Maria Souza"
              />
            </label>
            <label className="field">
              <span>Data inicial</span>
              <input
                type="date"
                name="dataInicio"
                value={form.dataInicio}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              <span>Data final</span>
              <input
                type="date"
                name="dataFim"
                value={form.dataFim}
                onChange={handleChange}
              />
            </label>
          </div>
          <div className="form__actions">
            <button type="submit" className="button button--primary" disabled={preview.isLoading}>
              {preview.isLoading ? 'Gerando...' : 'Gerar termo'}
            </button>
            <button type="button" className="button button--ghost" onClick={handleReset} disabled={preview.isLoading}>
              Limpar
            </button>
          </div>
        </form>
        {preview.error ? <p className="feedback feedback--error">{preview.error}</p> : null}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Pre-visualizacao</h2>
          {preview.html ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          ) : null}
        </header>
        {preview.isLoading ? (
          <p className="feedback">Carregando documento...</p>
        ) : preview.html ? (
          <div className="document-preview__inline">
            <div className="document-preview__summary">
              <strong>{context?.colaborador?.nome}</strong>
              <span>{context?.colaborador?.centroServico}</span>
              <span>Ultima entrega: {ultimaEntregaLabel}</span>
              <span>Itens entregues: {context?.totais?.totalItensEntregues ?? '-'}</span>
              {origemLabel ? (
                <span className={`document-preview__origin${context?.origem === 'local' ? ' document-preview__origin--local' : ''}`}>
                  {origemLabel}
                </span>
              ) : null}
            </div>
            <AutoResizeIframe
              title="Pre-visualizacao do termo de EPI"
              className="document-preview__frame"
              srcDoc={preview.html}
            />
          </div>
        ) : (
          <p className="feedback">Informe os dados e clique em "Gerar termo" para visualizar o documento.</p>
        )}
      </section>
    </div>
  )
}
