import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon, RefreshIcon, SpreadsheetIcon } from '../components/icons.jsx'
import { AsoProvider, useAsoContext } from '../context/AsoContext.jsx'
import { AsoForm } from '../components/Aso/AsoForm.jsx'
import { AsoSummaryCards } from '../components/Aso/AsoSummaryCards.jsx'
import { AsoFilters } from '../components/Aso/AsoFilters.jsx'
import { AsoTable } from '../components/Aso/AsoTable.jsx'
import { AsoDetailsModal } from '../components/Aso/AsoDetailsModal.jsx'
import { AsoHistoryModal } from '../components/Aso/AsoHistoryModal.jsx'
import { AsoRegisterExamModal } from '../components/Aso/AsoRegisterExamModal.jsx'
import { AsoConflictModal } from '../components/Aso/AsoConflictModal.jsx'
import { AsoImportModal } from '../components/Aso/AsoImportModal.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { downloadAsoCsv } from '../utils/asoExport.js'
import { downloadAsoTemplate, importAsoPlanilha } from '../services/asoService.js'
import '../styles/AsoPage.css'
import '../styles/MateriaisPage.css'

function AsoContent() {
  const [detailsState, setDetailsState] = useState({ open: false, aso: null })
  const [importOpen, setImportOpen] = useState(false)
  const [importInfo, setImportInfo] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const {
    form,
    filters,
    asos,
    tiposExame,
    centrosServico,
    setores,
    cargos,
    editingAso,
    isLoading,
    isSaving,
    error,
    historyState,
    registerExamState,
    conflictState,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    cards,
    handleFormChange,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    startEdit,
    resetForm,
    openHistory,
    closeHistory,
    openRegisterExam,
    closeRegisterExam,
    handleRegisterExamChange,
    handleRegisterExamSubmit,
    handleConflictClose,
    handleConflictOpenExisting,
    handleConflictContinue,
    refreshAsoData,
  } = useAsoContext()

  const handleExportCsv = () => {
    downloadAsoCsv(asos, {
      filename: `controle-de-aso-${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Controle de ASO"
        subtitle="Controle de exames ocupacionais por funcionario."
        actions={<HelpButton topic="aso" />}
      />

      <AsoForm
        form={form}
        tiposExame={tiposExame}
        editingAso={editingAso}
        isSaving={isSaving}
        error={error}
        pessoaSearchValue={pessoaSearchValue}
        pessoaSuggestions={pessoaSuggestions}
        pessoaDropdownOpen={pessoaDropdownOpen}
        isSearchingPessoas={isSearchingPessoas}
        pessoaSearchError={pessoaSearchError}
        onPessoaInputChange={handlePessoaInputChange}
        onPessoaSelect={handlePessoaSelect}
        onPessoaFocus={handlePessoaFocus}
        onPessoaBlur={handlePessoaBlur}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        onOpenImportMass={() => setImportOpen(true)}
      />

      <AsoSummaryCards cards={cards} />

      <AsoFilters
        filters={filters}
        tiposExame={tiposExame}
        centrosServico={centrosServico}
        setores={setores}
        cargos={cargos}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Registros de ASO</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleExportCsv}
              aria-label="Exportar lista de ASO em CSV"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <SpreadsheetIcon size={16} />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => refreshAsoData(filters)}
              disabled={isLoading}
              aria-label="Atualizar lista de ASO"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshIcon size={16} />
              <span>{isLoading ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </header>

        {isLoading ? <p className="feedback">Carregando...</p> : null}

        {!isLoading ? (
          <AsoTable
            asos={asos}
            editingId={editingAso?.id ?? null}
            isSaving={isSaving}
            onEdit={startEdit}
            onHistory={openHistory}
            onDetails={(aso) => setDetailsState({ open: true, aso })}
            onRegisterExam={openRegisterExam}
          />
        ) : null}
      </section>

      <AsoDetailsModal
        open={detailsState.open}
        aso={detailsState.aso}
        onClose={() => setDetailsState({ open: false, aso: null })}
      />
      <AsoHistoryModal state={historyState} onClose={closeHistory} />
      <AsoRegisterExamModal
        state={registerExamState}
        tiposExame={tiposExame.filter((item) =>
          ['periodico', 'mudanca_funcao_setor', 'demissional'].includes(String(item?.codigo || '').toLowerCase())
        )}
        onClose={closeRegisterExam}
        onChange={handleRegisterExamChange}
        onSubmit={handleRegisterExamSubmit}
      />
      <AsoConflictModal
        state={conflictState}
        isSaving={isSaving}
        onClose={handleConflictClose}
        onOpenExisting={handleConflictOpenExisting}
        onContinue={handleConflictContinue}
      />
      <AsoImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportInfo(null)
          setImportLoading(false)
        }}
        info={importInfo}
        disabled={importLoading}
        loading={importLoading}
        onDownloadTemplate={async () => {
          setImportInfo({ status: 'info', message: 'Baixando modelo...' })
          try {
            const { blob, filename } = await downloadAsoTemplate()
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = filename || 'aso_template.xlsx'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(url)
            setImportInfo({ status: 'success', message: 'Modelo baixado com sucesso.' })
          } catch (err) {
            setImportInfo({ status: 'error', message: err.message || 'Falha ao baixar modelo.' })
          }
        }}
        onUploadFile={async (file) => {
          if (!file) return
          setImportLoading(true)
          setImportInfo({ status: 'info', message: 'Enviando planilha...' })
          try {
            const result = await importAsoPlanilha(file)
            setImportInfo({
              status: 'success',
              message: 'Importacao concluida.',
              stats: {
                processed: result?.processed ?? result?.total ?? 0,
                success: result?.success ?? result?.imported ?? 0,
                errors: result?.errors ?? result?.failed ?? 0,
              },
              errorsUrl: result?.errorsUrl ?? null,
              firstError: result?.firstError ?? null,
              errorSamples: result?.errorSamples ?? [],
            })
            await refreshAsoData(filters)
          } catch (err) {
            setImportInfo({
              status: 'error',
              message: err.message || 'Falha ao importar planilha.',
            })
          } finally {
            setImportLoading(false)
          }
        }}
      />
    </div>
  )
}

export function AsoPage() {
  return (
    <AsoProvider>
      <AsoContent />
    </AsoProvider>
  )
}
