import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon, RefreshIcon, SpreadsheetIcon } from '../components/icons.jsx'
import { AcidentesForm } from '../components/Acidentes/Form/AcidentesForm.jsx'
import { AcidentesFilters } from '../components/Acidentes/Filters/AcidentesFilters.jsx'
import { AcidentesTable } from '../components/Acidentes/Table/AcidentesTable.jsx'
import { AcidentesHistoryModal } from '../components/Acidentes/Modal/AcidentesHistoryModal.jsx'
import { AcidenteDetailsModal } from '../components/Acidentes/Modal/AcidenteDetailsModal.jsx'
import { AcidenteCancelModal } from '../components/Acidentes/Modal/AcidenteCancelModal.jsx'
import { AcidenteDuplicateModal } from '../components/Acidentes/Modal/AcidenteDuplicateModal.jsx'
import { AcidentesImportModal } from '../components/Acidentes/AcidentesImportModal.jsx'
import { ACIDENTES_HISTORY_DEFAULT } from '../config/AcidentesConfig.js'
import { cancelAcidente, getAcidenteHistory, downloadAcidenteTemplate, importAcidentePlanilha } from '../services/acidentesService.js'
import { downloadAcidentesCsv } from '../utils/acidentesExport.js'
import { usePessoas } from '../hooks/usePessoas.js'
import { useLocais } from '../hooks/useLocais.js'
import { usePartes } from '../hooks/usePartes.js'
import { useAcidenteForm } from '../hooks/useAcidenteForm.js'
import { AcidentesProvider, useAcidentesContext } from '../context/AcidentesContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'

import '../styles/AcidentesPage.css'
import '../styles/AcidentesTableStatus.css'

export function AcidentesPage() {
  return (
    <AcidentesProvider>
      <AcidentesPageContent />
    </AcidentesProvider>
  )
}

function AcidentesPageContent() {
  const {
    acidentes,
    acidentesFiltrados,
    isLoading: isLoadingAcidentes,
    error: listError,
    reload: reloadAcidentes,
    filters,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    tiposFiltro,
    centrosServico,
    agentesFiltro,
    agentes,
    isLoadingAgentes,
    agentesError,
  } = useAcidentesContext()
  const { pessoas, isLoading: isLoadingPessoas, error: pessoasError } = usePessoas()
  const { locais, isLoading: isLoadingLocais, error: locaisError } = useLocais()
  const { partes, isLoading: isLoadingPartes, error: partesError } = usePartes()
  const { reportError } = useErrorLogger('acidentes')

  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...ACIDENTES_HISTORY_DEFAULT }))
  const [detailsState, setDetailsState] = useState({ open: false, acidente: null })
  const [cancelState, setCancelState] = useState({ open: false, acidente: null, error: null, isSaving: false })
  const [importOpen, setImportOpen] = useState(false)
  const [importInfo, setImportInfo] = useState(null)
  const [importLoading, setImportLoading] = useState(false)

  const handleExportCsv = () => {
    const filename = `acidentes-${new Date().toISOString().slice(0, 10)}.csv`
    downloadAcidentesCsv(acidentesFiltrados, { filename })
  }

  const {
    form,
    formError,
    isSaving,
    duplicateState,
    handleFormChange,
    handleSubmit,
    confirmDuplicate,
    closeDuplicateModal,
    startEdit,
    cancelEdit,
    editingAcidente,
    tipoOpcoes,
    tiposError,
    isLoadingTipos,
    lesaoOpcoes,
    lesoesError,
    isLoadingLesoes,
    centrosServicoPessoas,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    clearPessoaSelection,
  } = useAcidenteForm({
    pessoas,
    locais,
    agenteOpcoes: agentes,
    acidentes,
    onSaved: async () => {
      setHistoryCache({})
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT })
      await reloadAcidentes()
    },
    onError: (err, ctx) => {
      reportError(err, { area: 'submit_acidente', ...ctx })
    },
  })

  const openHistory = async (acidente) => {
    const cached = historyCache[acidente.id]
    if (cached) {
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, registros: cached })
      return
    }

    setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, isLoading: true })

    try {
      const registros = (await getAcidenteHistory(acidente.id)) ?? []
      setHistoryCache((prev) => ({ ...prev, [acidente.id]: registros }))
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, registros })
    } catch (err) {
      reportError(err, { area: 'history_acidente', acidenteId: acidente.id })
      setHistoryState({
        ...ACIDENTES_HISTORY_DEFAULT,
        open: true,
        acidente,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistory = () => {
    setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT })
  }

  const openDetails = (acidente) => {
    setDetailsState({ open: true, acidente })
  }

  const closeDetails = () => {
    setDetailsState({ open: false, acidente: null })
  }

  const openCancelModal = (acidente) => {
    setCancelState({ open: true, acidente, error: null, isSaving: false, motivo: '' })
  }

  const closeCancelModal = () => {
    setCancelState({ open: false, acidente: null, error: null, isSaving: false, motivo: '' })
  }

  const confirmCancel = async () => {
    const alvo = cancelState.acidente
    if (!alvo?.id) return
    setCancelState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      await cancelAcidente(alvo.id, { motivo: cancelState.motivo })
      await reloadAcidentes()
      setHistoryCache({})
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT })
      closeCancelModal()
    } catch (err) {
      reportError(err, { area: 'cancel_acidente', acidenteId: alvo.id })
      setCancelState((prev) => ({ ...prev, error: err.message || 'Não foi possível cancelar o acidente.', isSaving: false }))
    }
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<AlertIcon size={28} />}
        title="Acidentes"
        subtitle="Registre acidentes de trabalho, filtre e acompanhe os indicadores."
        actions={<HelpButton topic="acidentes" />}
      />

      <AcidentesForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingAcidente={editingAcidente}
        onCancel={cancelEdit}
        onOpenImportMassa={() => setImportOpen(true)}
        error={formError}
        pessoasError={pessoasError}
        isLoadingPessoas={isLoadingPessoas}
        locais={locais}
        locaisError={locaisError}
        isLoadingLocais={isLoadingLocais}
        agentes={agentes}
        agentesError={agentesError}
        isLoadingAgentes={isLoadingAgentes}
        tipos={tipoOpcoes}
        tiposError={tiposError}
        isLoadingTipos={isLoadingTipos}
        lesoes={lesaoOpcoes}
        lesoesError={lesoesError}
        isLoadingLesoes={isLoadingLesoes}
        partes={partes}
        partesError={partesError}
        isLoadingPartes={isLoadingPartes}
        centrosServico={centrosServicoPessoas}
        pessoaSearchValue={pessoaSearchValue}
        pessoaSuggestions={pessoaSuggestions}
        pessoaDropdownOpen={pessoaDropdownOpen}
        isSearchingPessoas={isSearchingPessoas}
        pessoaSearchError={pessoaSearchError}
        onPessoaInputChange={handlePessoaInputChange}
        onPessoaSelect={handlePessoaSelect}
        onPessoaFocus={handlePessoaFocus}
        onPessoaBlur={handlePessoaBlur}
        onPessoaClear={clearPessoaSelection}
        disablePessoaEdit={Boolean(editingAcidente)}
      />

      <AcidenteDuplicateModal
        state={duplicateState}
        onClose={closeDuplicateModal}
        onConfirm={confirmDuplicate}
        isSaving={isSaving}
      />

      <AcidentesFilters
        filters={filters}
        tipos={tiposFiltro}
        centrosServico={centrosServico}
        agentes={agentesFiltro}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Registros de Acidentes</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleExportCsv}
              aria-label="Exportar lista de acidentes em CSV"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <SpreadsheetIcon size={16} />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={reloadAcidentes}
              disabled={isLoadingAcidentes}
              aria-label="Atualizar lista de acidentes"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshIcon size={16} />
              <span>Atualizar</span>
            </button>
          </div>
        </header>
        {listError ? <p className="feedback feedback--error">{listError}</p> : null}
        {isLoadingAcidentes ? <p className="feedback">Carregando...</p> : null}
        {!isLoadingAcidentes ? (
          <AcidentesTable
            acidentes={acidentesFiltrados}
            onEdit={startEdit}
            onHistory={openHistory}
            onDetails={openDetails}
            onCancel={openCancelModal}
            editingId={editingAcidente?.id ?? null}
            isSaving={isSaving}
            historyState={historyState}
          />
        ) : null}
      </section>

      <AcidentesHistoryModal state={historyState} onClose={closeHistory} />
      <AcidenteDetailsModal open={detailsState.open} acidente={detailsState.acidente} onClose={closeDetails} />
      <AcidenteCancelModal
        state={cancelState}
        onClose={closeCancelModal}
        onConfirm={confirmCancel}
        onMotivoChange={(motivo) => setCancelState((prev) => ({ ...prev, motivo }))}
        isSaving={cancelState.isSaving}
      />
      <AcidentesImportModal
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
            const { blob, filename } = await downloadAcidenteTemplate()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'acidente_template.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
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
            const result = await importAcidentePlanilha(file)
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
            await reloadAcidentes()
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
