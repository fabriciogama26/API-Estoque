import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon, InfoIcon } from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { AutoResizeIframe } from '../components/AutoResizeIframe.jsx'
import { useRelatorioEstoque } from '../hooks/useRelatorioEstoque.js'
import { PDF_REPORT_LIMIT_PER_MONTH } from '../config/RelatorioEstoqueConfig.js'
import '../styles/DocumentPreviewModal.css'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

const formatMonthLabel = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

const formatCreator = (value) => {
  if (!value) return 'Sistema'
  if (typeof value === 'string') return value
  return value.display_name || value.username || value.email || value.id || 'Sistema'
}

const formatEmailStatus = (value) => {
  const status = String(value || '').trim()
  return status || '-'
}

export function RelatorioEstoquePage() {
  const {
    filters,
    reports,
    loading,
    error,
    preview,
    pdfLoadingId,
    hasReports,
    canGeneratePdf,
    handleChange,
    handleSubmit,
    handleReset,
    handleGeneratePdf,
  } = useRelatorioEstoque()

  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Relatorio de Estoque"
        subtitle="Consulte o historico e gere o PDF usando os dados ja registrados."
        actions={<HelpButton topic="relatorioEstoque" />}
      />

      <section className="card">
        <header className="card__header">
          <h2>Filtros</h2>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__grid">
            <label className="field">
              <span>Mes</span>
              <input type="month" name="mes" value={filters.mes} onChange={handleChange} />
            </label>
          </div>
          <div className="form__actions">
            <button type="submit" className="button button--primary" disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
            <button type="button" className="button button--ghost" onClick={handleReset} disabled={loading}>
              Limpar
            </button>
          </div>
        </form>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Historico de relatorios</h2>
        </header>
        {loading ? (
          <p className="feedback">Carregando relatorios...</p>
        ) : !hasReports ? (
          <p className="feedback">Nenhum relatorio encontrado para o filtro selecionado.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Criado por</th>
                  <th>Criado em</th>
                  <th>Periodo inicio</th>
                  <th>Periodo fim</th>
                  <th>Status email</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const pdfBlocked = !canGeneratePdf(report)
                  return (
                    <tr key={report.id}>
                      <td>{formatCreator(report.created_by)}</td>
                      <td>{formatDate(report.created_at)}</td>
                      <td>{formatDate(report.periodo_inicio)}</td>
                      <td>{formatDate(report.periodo_fim)}</td>
                      <td>{formatEmailStatus(report.email_status)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--primary"
                            onClick={() => handleGeneratePdf(report)}
                            disabled={pdfBlocked || pdfLoadingId === report.id}
                          >
                            {pdfLoadingId === report.id ? 'Gerando...' : 'Gerar PDF'}
                          </button>
                          {pdfBlocked ? (
                            <span className="data-table__muted">
                              Limite mensal ({PDF_REPORT_LIMIT_PER_MONTH})
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Pre-visualizacao</h2>
          <span className="data-table__muted">
            <InfoIcon size={14} /> PDF gerado a partir deste HTML.
          </span>
        </header>
        {preview.html ? (
          <div className="document-preview__inline">
            <AutoResizeIframe
              title="Pre-visualizacao do relatorio de estoque"
              className="document-preview__frame"
              srcDoc={preview.html}
            />
          </div>
        ) : (
          <p className="feedback">Selecione o mes e clique em "Buscar" para visualizar o relatorio.</p>
        )}
      </section>
    </div>
  )
}
