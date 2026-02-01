import { useMemo, useState } from 'react'
import '../../styles/help.css'

const TABLE_COLUMNS = {
  fabricantes: ['fabricante', 'ativo'],
  cargos: ['cargo', 'ativo'],
  centros_custo: ['centro_custo', 'ativo'],
  centros_servico: ['centro_servico', 'centro_custo', 'ativo'],
  centros_estoque: ['centro_estoque', 'centro_custo', 'ativo'],
  setores: ['setor', 'centro_servico', 'ativo'],
}

export function CadastroBaseImportModal({
  open,
  onClose,
  tableKey,
  tableOptions = [],
  onTableChange,
  onDownloadTemplate,
  onUploadFile,
  info,
  disabled,
  loading = false,
}) {
  const [file, setFile] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const resolvedInfo = useMemo(() => info ?? null, [info])
  const stats = resolvedInfo?.stats
  const hasStats =
    stats && (stats.processed !== undefined || stats.success !== undefined || stats.errors !== undefined)

  if (!open) return null

  const currentColumns = TABLE_COLUMNS[tableKey] || ['nome', 'ativo']

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
  const stopPropagation = (event) => event.stopPropagation()

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="help-modal desligamento-help__modal" onClick={stopPropagation}>
        <header className="help-header">
          <div className="help-title">
            <p className="help-eyebrow">Cadastro Base em massa</p>
            <h3>Importar planilha XLSX</h3>
            <p className="help-summary">Selecione a tabela e importe uma planilha XLSX.</p>
          </div>
          <button type="button" className="help-close" onClick={onClose} aria-label="Fechar modal de importacao">
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="help-body desligamento-help__body">
          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">1</div>
              <div>
                <h4>Selecione a tabela</h4>
                <p className="desligamento-help__text">Escolha qual cadastro base deseja importar.</p>
              </div>
            </div>
            <label className="field">
              <span>Tabela</span>
              <select name="table" value={tableKey} onChange={(event) => onTableChange?.(event.target.value)}>
                {tableOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">2</div>
              <div>
                <h4>Baixe o modelo</h4>
                <p className="desligamento-help__text">Use o modelo da tabela selecionada.</p>
              </div>
            </div>
            <button type="button" className="button button--ghost" onClick={onDownloadTemplate}>
              Baixar modelo (.xlsx)
            </button>
          </section>

          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">3</div>
              <div>
                <h4>Preencha a planilha</h4>
                <p className="desligamento-help__text">Campos obrigatorios:</p>
              </div>
            </div>
            <ul className="desligamento-help__bullets">
              {currentColumns.map((col) => (
                <li key={col}>{col}</li>
              ))}
            </ul>
            <p className="desligamento-help__text">Todos os valores sao texto.</p>
            <p className="desligamento-help__text">O campo ativo somente: (true ou false).</p>
          </section>

          <section className="desligamento-help__card">
            <div className="desligamento-help__card-header">
              <div className="desligamento-help__badge">4</div>
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
              onClick={() => document.getElementById('cadastro-base-massa-file-input')?.click()}
            >
              <input
                id="cadastro-base-massa-file-input"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <p className="desligamento-help__drop-title">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="desligamento-help__drop-sub">Formato XLSX</p>
              {file ? <p className="desligamento-help__drop-file">OK {file.name}</p> : null}
            </div>

            <button
              type="button"
              className="button button--primary desligamento-help__import"
              onClick={handleUpload}
              disabled={!canUpload || loading}
            >
              {loading ? 'Importando...' : 'Importar planilha'}
            </button>
          </section>

          <details className="desligamento-help__rules" open={rulesOpen} onToggle={(e) => setRulesOpen(e.target.open)}>
            <summary>Regras de importacao</summary>
            <ul>
              <li>Formato: XLSX obrigatorio.</li>
              <li>Campos obrigatorios precisam bater exatamente com o cadastro.</li>
              <li>Ativo (true ou false).</li>
            </ul>
          </details>

          {resolvedInfo ? (
            <div className={`desligamento-help__info desligamento-help__info--${resolvedInfo.status || 'info'}`}>
              <div className="desligamento-help__info-text">{resolvedInfo.message}</div>
              {hasStats ? (
                <div className="desligamento-help__stats">
                  {stats.processed !== undefined ? <span>{stats.processed} processados</span> : null}
                  {stats.success !== undefined ? <span>{stats.success} importados</span> : null}
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
