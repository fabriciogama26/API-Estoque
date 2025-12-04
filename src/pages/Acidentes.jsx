import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon } from '../components/icons.jsx'
import { AcidentesForm } from '../components/Acidentes/Form/AcidentesForm.jsx'
import { AcidentesFilters } from '../components/Acidentes/Filters/AcidentesFilters.jsx'
import { AcidentesTable } from '../components/Acidentes/Table/AcidentesTable.jsx'
import { AcidentesHistoryModal } from '../components/Acidentes/Modal/AcidentesHistoryModal.jsx'
import { AcidenteDetailsModal } from '../components/Acidentes/Modal/AcidenteDetailsModal.jsx'
import { ACIDENTES_HISTORY_DEFAULT } from '../config/AcidentesConfig.js'
import { getAcidenteHistory } from '../services/acidentesService.js'
import { usePessoas } from '../hooks/usePessoas.js'
import { useLocais } from '../hooks/useLocais.js'
import { usePartes } from '../hooks/usePartes.js'
import { useAcidenteForm } from '../hooks/useAcidenteForm.js'
import { AcidentesProvider, useAcidentesContext } from '../context/AcidentesContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'

import '../styles/AcidentesPage.css'

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
    agenteOpcoesNomes,
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

  const {
    form,
    formError,
    isSaving,
    handleFormChange,
    handleSubmit,
    startEdit,
    cancelEdit,
    resetForm,
    editingAcidente,
    tipoOpcoes,
    tiposError,
    isLoadingTipos,
    lesaoOpcoes,
    lesoesError,
    isLoadingLesoes,
    centrosServicoPessoas,
  } = useAcidenteForm({
    pessoas,
    locais,
    agenteOpcoes: agenteOpcoesNomes,
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
        error={formError}
        pessoas={pessoas}
        pessoasError={pessoasError}
        isLoadingPessoas={isLoadingPessoas}
        locais={locais}
        locaisError={locaisError}
        isLoadingLocais={isLoadingLocais}
        agentes={agenteOpcoesNomes}
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
          <h2>Acidentes registrados</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={reloadAcidentes}
            disabled={isLoadingAcidentes}
          >
            Atualizar
          </button>
        </header>
        {listError ? <p className="feedback feedback--error">{listError}</p> : null}
        {isLoadingAcidentes ? <p className="feedback">Carregando...</p> : null}
        {!isLoadingAcidentes ? (
          <AcidentesTable
            acidentes={acidentesFiltrados}
            onEdit={startEdit}
            onHistory={openHistory}
            onDetails={openDetails}
            editingId={editingAcidente?.id ?? null}
            isSaving={isSaving}
            historyState={historyState}
          />
        ) : null}
      </section>

      <AcidentesHistoryModal state={historyState} onClose={closeHistory} />
      <AcidenteDetailsModal open={detailsState.open} acidente={detailsState.acidente} onClose={closeDetails} />
    </div>
  )
}
