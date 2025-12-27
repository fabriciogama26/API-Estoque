import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon } from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { HhtMensalForm } from '../components/Acidentes/HhtMensal/Form/HhtMensalForm.jsx'
import { HhtMensalFilters } from '../components/Acidentes/HhtMensal/Filters/HhtMensalFilters.jsx'
import { HhtMensalTable } from '../components/Acidentes/HhtMensal/Table/HhtMensalTable.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { HhtMensalHistoryModal } from '../components/Acidentes/HhtMensal/Modal/HhtMensalHistoryModal.jsx'
import { HhtMensalDeleteModal } from '../components/Acidentes/HhtMensal/Modal/HhtMensalDeleteModal.jsx'
import { HhtMensalDetailsModal } from '../components/Acidentes/HhtMensal/Modal/HhtMensalDetailsModal.jsx'
import { HHT_MENSAL_FILTER_DEFAULT, HHT_MENSAL_FORM_DEFAULT, HHT_MENSAL_HISTORY_DEFAULT } from '../config/HhtMensalConfig.js'
import { listCentrosServico } from '../services/saidasService.js'
import {
  createHhtMensal,
  deleteHhtMensal,
  getHhtMensalHistory,
  getHhtMensalPessoasCount,
  listHhtMensal,
  updateHhtMensal,
} from '../services/hhtMensalService.js'
import { buildMesRefFromMonth, normalizeModo } from '../utils/hhtMensalUtils.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'

export function HhtMensalAcidentesPage() {
  const { reportError } = useErrorLogger('hht_mensal')

  const [centrosServico, setCentrosServico] = useState([])
  const [centrosError, setCentrosError] = useState(null)
  const [isLoadingCentros, setIsLoadingCentros] = useState(false)

  const [filters, setFilters] = useState({ ...HHT_MENSAL_FILTER_DEFAULT })
  const [appliedFilters, setAppliedFilters] = useState({ ...HHT_MENSAL_FILTER_DEFAULT })

  const [registros, setRegistros] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [listError, setListError] = useState(null)

  const [form, setForm] = useState({ ...HHT_MENSAL_FORM_DEFAULT })
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qtdPessoasManual, setQtdPessoasManual] = useState(false)
  const [detailsState, setDetailsState] = useState({ open: false, registro: null })

  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState({ ...HHT_MENSAL_HISTORY_DEFAULT })
  const [deleteState, setDeleteState] = useState({ open: false, registro: null, motivo: '', error: null })
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  const centrosMap = useMemo(() => new Map((centrosServico ?? []).map((item) => [item.id, item.nome])), [centrosServico])

  const loadCentrosServico = async () => {
    setCentrosError(null)
    setIsLoadingCentros(true)
    try {
      const data = await listCentrosServico()
      setCentrosServico(Array.isArray(data) ? data : [])
    } catch (err) {
      setCentrosError(err?.message ?? 'Falha ao carregar centros de servico.')
      reportError(err, { area: 'load_centros_servico' })
    } finally {
      setIsLoadingCentros(false)
    }
  }

  const loadRegistros = async (query = {}) => {
    setListError(null)
    setIsLoading(true)
    try {
      const data = await listHhtMensal({ ...query, incluirInativos: true })
      setRegistros(Array.isArray(data) ? data : [])
      setCurrentPage(1)
    } catch (err) {
      setListError(err?.message ?? 'Falha ao carregar registros.')
      reportError(err, { area: 'list_hht_mensal', query })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCentrosServico()
  }, [])

  useEffect(() => {
    loadRegistros(appliedFilters)
  }, [appliedFilters])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleFilterSubmit = () => {
    setAppliedFilters({ ...filters })
  }

  const handleFilterClear = () => {
    setFilters({ ...HHT_MENSAL_FILTER_DEFAULT })
    setAppliedFilters({ ...HHT_MENSAL_FILTER_DEFAULT })
  }

  const handleFormChange = (field, value) => {
    if (field === 'centroServicoId' || field === 'mesRefMonth') {
      setQtdPessoasManual(false)
    }
    if (field === 'qtdPessoas') {
      setQtdPessoasManual(true)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    const centroServicoId = String(form.centroServicoId ?? '').trim()
    if (!centroServicoId) {
      return
    }

    const shouldAutoFill =
      !qtdPessoasManual &&
      (!editing?.id ||
        centroServicoId !== String(editing?.centroServicoId ?? '').trim() ||
        String(form.mesRefMonth ?? '') !== String(editing?.mesRef ?? '').slice(0, 7))

    if (!shouldAutoFill) {
      return
    }

    getHhtMensalPessoasCount(centroServicoId, centrosMap.get(centroServicoId) ?? null)
      .then((total) => {
        const safe = Number.isFinite(Number(total)) ? String(Number(total)) : '0'
        setForm((prev) => ({ ...prev, qtdPessoas: safe }))
      })
      .catch((err) => {
        reportError(err, { area: 'qtd_pessoas_auto', centroServicoId })
      })
  }, [centrosMap, editing?.centroServicoId, editing?.id, editing?.mesRef, form.centroServicoId, form.mesRefMonth, qtdPessoasManual, reportError])

  const startEdit = (registro) => {
    setFormError(null)
    setQtdPessoasManual(false)
    setEditing(registro)
    setForm({
      mesRefMonth: registro?.mesRef ? String(registro.mesRef).slice(0, 7) : '',
      centroServicoId: registro?.centroServicoId ?? '',
      modo: normalizeModo(registro?.modo),
      qtdPessoas: registro?.qtdPessoas?.toString?.() ?? String(registro?.qtdPessoas ?? ''),
      horasMesBase: registro?.horasMesBase?.toString?.() ?? String(registro?.horasMesBase ?? ''),
      escalaFactor: registro?.escalaFactor?.toString?.() ?? String(registro?.escalaFactor ?? '1'),
      horasAfastamento: registro?.horasAfastamento?.toString?.() ?? String(registro?.horasAfastamento ?? '0'),
      horasFerias: registro?.horasFerias?.toString?.() ?? String(registro?.horasFerias ?? '0'),
      horasTreinamento: registro?.horasTreinamento?.toString?.() ?? String(registro?.horasTreinamento ?? '0'),
      horasOutrosDescontos:
        registro?.horasOutrosDescontos?.toString?.() ?? String(registro?.horasOutrosDescontos ?? '0'),
      horasExtras: registro?.horasExtras?.toString?.() ?? String(registro?.horasExtras ?? '0'),
      hhtInformado: registro?.hhtInformado?.toString?.() ?? String(registro?.hhtInformado ?? ''),
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    setFormError(null)
    setQtdPessoasManual(false)
    setForm({ ...HHT_MENSAL_FORM_DEFAULT })
  }

  const buildPayload = () => {
    const mesRef = buildMesRefFromMonth(form.mesRefMonth)
    if (!mesRef) {
      throw new Error('Informe o mes de referencia.')
    }
    if (!form.centroServicoId) {
      throw new Error('Selecione um centro de servico.')
    }

    const modo = normalizeModo(form.modo)
    const centroServicoNome = centrosMap.get(form.centroServicoId) ?? ''

    const payload = {
      mesRef,
      centroServicoId: form.centroServicoId,
      centroServicoNome,
      modo,
      qtdPessoas: form.qtdPessoas,
      horasMesBase: form.horasMesBase,
      escalaFactor: form.escalaFactor,
      horasAfastamento: form.horasAfastamento,
      horasFerias: form.horasFerias,
      horasTreinamento: form.horasTreinamento,
      horasOutrosDescontos: form.horasOutrosDescontos,
      horasExtras: form.horasExtras,
      hhtInformado: modo === 'manual' ? form.hhtInformado : null,
    }

    if (modo === 'simples') {
      payload.escalaFactor = 1
      payload.horasAfastamento = 0
      payload.horasFerias = 0
      payload.horasTreinamento = 0
      payload.horasOutrosDescontos = 0
      payload.horasExtras = 0
    }

    return payload
  }

  const handleSubmit = async () => {
    setFormError(null)
    setIsSaving(true)
    try {
      const payload = buildPayload()
      if (editing?.id) {
        await updateHhtMensal(editing.id, payload)
      } else {
        await createHhtMensal(payload)
      }
      setHistoryCache({})
      setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT })
      cancelEdit()
      await loadRegistros(appliedFilters)
    } catch (err) {
      setFormError(err?.message ?? 'Falha ao salvar.')
      reportError(err, { area: 'submit_hht_mensal', editingId: editing?.id ?? null })
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteModal = (registro) => {
    if (!registro?.id) {
      return
    }
    setDeleteState({ open: true, registro, motivo: '', error: null })
  }

  const closeDeleteModal = () => {
    if (isSaving) {
      return
    }
    setDeleteState({ open: false, registro: null, motivo: '', error: null })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState?.registro?.id) {
      return
    }
    const motivo = String(deleteState.motivo ?? '').trim()
    if (!motivo) {
      setDeleteState((prev) => ({ ...prev, error: 'Informe o motivo da exclusao.' }))
      return
    }

    setIsSaving(true)
    setDeleteState((prev) => ({ ...prev, error: null }))
    try {
      await deleteHhtMensal(deleteState.registro.id, motivo)
      setHistoryCache({})
      setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT })
      if (editing?.id === deleteState.registro.id) {
        cancelEdit()
      }
      await loadRegistros(appliedFilters)
      closeDeleteModal()
    } catch (err) {
      reportError(err, { area: 'delete_hht_mensal', id: deleteState.registro.id })
      setDeleteState((prev) => ({ ...prev, error: err?.message ?? 'Falha ao cancelar registro.' }))
    } finally {
      setIsSaving(false)
    }
  }

  const openHistory = async (registro) => {
    if (!registro?.id) {
      return
    }
    const cached = historyCache[registro.id]
    if (cached) {
      setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT, open: true, registro, registros: cached })
      return
    }

    setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT, open: true, registro, isLoading: true })
    try {
      const historico = (await getHhtMensalHistory(registro.id)) ?? []
      setHistoryCache((prev) => ({ ...prev, [registro.id]: historico }))
      setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT, open: true, registro, registros: historico })
    } catch (err) {
      reportError(err, { area: 'history_hht_mensal', id: registro.id })
      setHistoryState({
        ...HHT_MENSAL_HISTORY_DEFAULT,
        open: true,
        registro,
        error: err?.message ?? 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistory = () => setHistoryState({ ...HHT_MENSAL_HISTORY_DEFAULT })
  const openDetails = (registro) => setDetailsState({ open: true, registro })
  const closeDetails = () => setDetailsState({ open: false, registro: null })

  const savedHhtCalculado = editing?.hhtCalculado ?? null
  const savedHhtFinal = editing?.hhtFinal ?? null

  return (
    <div className="stack">
      <PageHeader
        icon={<AlertIcon size={28} />}
        title="HHT Mensal"
        subtitle="Cadastre o HHT (homem-hora trabalhada) por mes e centro de servico."
        actions={<HelpButton topic="hhtMensal" />}
      />

      {centrosError ? <p className="feedback feedback--error">{centrosError}</p> : null}

      <HhtMensalForm
        form={form}
        centrosServico={centrosServico}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onCancel={cancelEdit}
        isSaving={isSaving}
        isEditing={Boolean(editing?.id)}
        error={formError}
        savedHhtCalculado={savedHhtCalculado}
        savedHhtFinal={savedHhtFinal}
      />

      <HhtMensalFilters
        filters={filters}
        centrosServico={centrosServico}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
        isLoading={isLoading || isLoadingCentros}
      />

      <section className="card">
        <header className="card__header">
          <h2>Registro de HHT</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => loadRegistros(appliedFilters)}
            disabled={isLoading}
          >
            Atualizar
          </button>
        </header>
        {listError ? <p className="feedback feedback--error">{listError}</p> : null}
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <>
            <HhtMensalTable
              registros={registros.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
              onEdit={startEdit}
              onHistory={openHistory}
              onDetails={openDetails}
              onDelete={openDeleteModal}
              isSaving={isSaving}
              editingId={editing?.id ?? null}
            />
            <TablePagination
              totalItems={registros.length}
              pageSize={PAGE_SIZE}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </section>

      <HhtMensalHistoryModal state={historyState} onClose={closeHistory} />
      <HhtMensalDetailsModal state={detailsState} onClose={closeDetails} />
      <HhtMensalDeleteModal
        state={deleteState}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        onMotivoChange={(motivo) => setDeleteState((prev) => ({ ...prev, motivo, error: null }))}
        isSaving={isSaving}
      />
    </div>
  )
}
