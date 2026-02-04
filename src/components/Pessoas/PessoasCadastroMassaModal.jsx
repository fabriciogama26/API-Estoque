import { useMemo, useState } from 'react'
import '../../styles/help.css'

export function PessoasCadastroMassaModal({
  open,
  onClose,
  onDownloadTemplate,
  onUploadFile,
  info,
  disabled,
  loading = false,
  loadingAction = null,
}) {
  const [file, setFile] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const resolvedInfo = useMemo(() => info ?? null, [info])
  const stats = resolvedInfo?.stats
  const hasStats =
    stats && (stats.processed !== undefined || stats.success !== undefined || stats.errors !== undefined)

  if (!open) return null

  const handleFileChange = (event) => {
    const next = event.target.files?.[0] ?? null
    setFile(next)
  }

  const handleUpload = () => {
    if (!file) return
    onUploadFile?.(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const next = event.dataTransfer?.files?.[0] ?? null
    if (next) {
      setFile(next)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const canUpload = Boolean(file) && !disabled
  const isUploading = loading && loadingAction === 'insert'

  const stopPropagation = (event) => event.stopPropagation()

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="help-modal desligamento-help__modal" onClick={stopPropagation}>
        <header className="help-header">
          <div className="help-title">
            <p className="help-eyebrow">Cadastro em massa</p>
            <h3>Importar planilha XLSX</h3>
            <p className="help-summary">Importe uma planilha XLSX para cadastrar pessoas.</p>
          </div>
          <button type="button" className="help-close" onClick={onClose} aria-label="Fechar modal de cadastro em massa">
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="help-body desligamento-help__body">
          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">1</div>
              <div>
                <h4>Baixe o modelo</h4>
                <p className="desligamento-help__text">Use este modelo obrigatorio.</p>
              </div>
            </div>
            <button type="button" className="button button--ghost" onClick={onDownloadTemplate}>
              Baixar modelo (.xlsx)
            </button>
          </section>

          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">2</div>
              <div>
                <h4>Preencha a planilha</h4>
                <p className="desligamento-help__text">Campos obrigatorios:</p>
              </div>
            </div>
            <ul className="desligamento-help__bullets">
              <li>matricula (apenas numeros)</li>
              <li>nome</li>
              <li>centro_servico</li>
              <li>setor</li>
              <li>cargo</li>
              <li>tipo_execucao</li>
              <li>data_admissao (dd/MM/yyyy)</li>
            </ul>
            <p className="desligamento-help__text">Todos os textos sao convertidos para MAIUSCULO.</p>
            <p className="desligamento-help__text">centro_custo e preenchido via centro_servico.</p>
          </section>

          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">3</div>
              <div>
                <h4>Envie o arquivo</h4>
                <p className="desligamento-help__text">Somente arquivos XLSX.</p>
              </div>
            </div>

            <div
              className={`desligamento-help__dropzone${dragging ? ' is-dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('cadastro-massa-file-input')?.click()}
            >
              <input
                id="cadastro-massa-file-input"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <p className="desligamento-help__drop-title">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="desligamento-help__drop-sub">Formato XLSX</p>
              {file ? <p className="desligamento-help__drop-file">OK {file.name}</p> : null}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className="button button--primary desligamento-help__import"
                onClick={handleUpload}
                disabled={!canUpload || loading}
              >
                {isUploading ? 'Importando...' : 'Importar planilha'}
              </button>
            </div>
          </section>

          <details className="desligamento-help__rules" open={rulesOpen} onToggle={(e) => setRulesOpen(e.target.open)}>
            <summary>Regras de importacao</summary>
            <ul>
              <li>Formato: XLSX obrigatorio.</li>
              <li>matricula deve conter apenas numeros.</li>
              <li>data_admissao vazia ou invalida: linha rejeitada.</li>
              <li>Campos de texto sao convertidos para MAIUSCULO.</li>
              <li>Referencias nao encontradas: erro.</li>
              <li>Importar: matricula ja existente (mesma familia) gera erro.</li>
            </ul>
          </details>

          {resolvedInfo ? (
            <div className={`desligamento-help__info desligamento-help__info--${resolvedInfo.status || 'info'}`}>
              <div className="desligamento-help__info-text">{resolvedInfo.message}</div>
              {hasStats ? (
                <div className="desligamento-help__stats">
                  {stats.processed !== undefined ? <span>{stats.processed} processados</span> : null}
                  {stats.success !== undefined ? (
                    <span>
                      {stats.success} {resolvedInfo?.mode === 'update' ? 'atualizados' : 'importados'}
                    </span>
                  ) : null}
                  {stats.errors !== undefined ? <span>{stats.errors} com erro</span> : null}
                </div>
              ) : null}
              {resolvedInfo.firstError ? (
                <p className="desligamento-help__info-text desligamento-help__info-hint">
                  Exemplo de erro: {resolvedInfo.firstError}
                </p>
              ) : null}
              {Array.isArray(resolvedInfo.errorSamples) && resolvedInfo.errorSamples.length ? (
                <ul className="desligamento-help__errors-list">
                  {resolvedInfo.errorSamples.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              ) : null}
              {resolvedInfo.errorsUrl ? (
                <button
                  type="button"
                  className="button button--ghost desligamento-help__errors"
                  onClick={() => window.open(resolvedInfo.errorsUrl, '_blank', 'noopener,noreferrer')}
                >
                  Baixar relatorio de erros (CSV)
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
