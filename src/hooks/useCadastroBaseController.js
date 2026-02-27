import { useCallback, useEffect, useMemo, useState } from 'react'
import { useErrorLogger } from './useErrorLogger.js'
import {
  listBasicRegistration,
  createBasicRegistration,
  updateBasicRegistration,
  inactivateBasicRegistration,
  listBasicRegistrationHistory,
} from '../services/basicRegistrationService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { resolveEffectiveAppUser } from '../services/effectiveUserService.js'
import { isLocalMode } from '../config/runtime.js'

const TABLES = [
  { key: 'fabricantes', label: 'Fabricantes', nameLabel: 'Fabricante', hasOrder: false },
  { key: 'cargos', label: 'Cargos', nameLabel: 'Cargo', capsLock: true },
  { key: 'centros_custo', label: 'Centros de custo', nameLabel: 'Centro de custo' },
  {
    key: 'centros_servico',
    label: 'Centros de servico',
    nameLabel: 'Centro de servico',
    dependsOn: ['centros_custo'],
    relationField: 'centroCustoId',
    relationLabel: 'Centro de custo',
  },
  {
    key: 'centros_estoque',
    label: 'Centros de estoque',
    nameLabel: 'Centro de estoque',
    hasOrder: false,
    dependsOn: ['centros_custo'],
    relationField: 'centroCustoId',
    relationLabel: 'Centro de custo',
  },
  {
    key: 'setores',
    label: 'Setores',
    nameLabel: 'Setor',
    dependsOn: ['centros_servico', 'centros_custo'],
    relationField: 'centroServicoId',
    relationLabel: 'Centro de servico',
  },
]

const DEFAULT_FILTERS = { termo: '', ativo: 'ativos' }

const buildDefaultForm = () => ({
  nome: '',
  ativo: true,
  centroCustoId: '',
  centroServicoId: '',
})

const resolveTableConfig = (key) => TABLES.find((item) => item.key === key) || TABLES[0]

export function useCadastroBaseController() {
  const { reportError } = useErrorLogger('cadastro-base')
  const { user } = useAuth()

  const [tableKey, setTableKey] = useState(TABLES[0].key)
  const [form, setForm] = useState(buildDefaultForm)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [centrosCustoOptions, setCentrosCustoOptions] = useState([])
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])
  const [historyModal, setHistoryModal] = useState({
    open: false,
    isLoading: false,
    error: null,
    item: null,
    registros: [],
  })

  const tableConfig = useMemo(() => resolveTableConfig(tableKey), [tableKey])
  const centrosCustoMap = useMemo(
    () => new Map((centrosCustoOptions || []).map((item) => [item.id, item.nome])),
    [centrosCustoOptions],
  )
  const centrosServicoMap = useMemo(
    () => new Map((centrosServicoOptions || []).map((item) => [item.id, item.nome])),
    [centrosServicoOptions],
  )

  const buildListParams = useCallback(
    (override = {}) => {
      const termo = override.termo ?? filters.termo
      const ativoFilter = override.ativo ?? filters.ativo
      const params = { termo }
      if (ativoFilter === 'ativos') {
        params.ativo = true
      } else if (ativoFilter === 'inativos') {
        params.ativo = false
      }
      return params
    },
    [filters],
  )

  const loadList = useCallback(
    async (override = {}) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listBasicRegistration(tableKey, buildListParams(override))
        setItems(data || [])
      } catch (err) {
        setError(err.message || 'Falha ao carregar cadastro base.')
        reportError(err, { stage: 'load_list', table: tableKey })
      } finally {
        setIsLoading(false)
      }
    },
    [buildListParams, reportError, tableKey],
  )

  const loadDependencies = useCallback(async () => {
    try {
      const [centrosCusto, centrosServico] = await Promise.all([
        listBasicRegistration('centros_custo', { ativo: true }),
        listBasicRegistration('centros_servico', { ativo: true }),
      ])
      setCentrosCustoOptions(centrosCusto || [])
      setCentrosServicoOptions(centrosServico || [])
    } catch (err) {
      reportError(err, { stage: 'load_dependencies' })
    }
  }, [reportError])

  useEffect(() => {
    loadDependencies()
  }, [loadDependencies])

  useEffect(() => {
    loadList()
    setForm(buildDefaultForm())
    setEditingItem(null)
  }, [loadList, tableKey])

  const dependencyStatus = useMemo(() => {
    const deps = tableConfig.dependsOn || []
    if (!deps.length) {
      return { canSave: true, message: '' }
    }
    const missing = []
    if (deps.includes('centros_custo') && centrosCustoOptions.length === 0) {
      missing.push('Centros de custo')
    }
    if (deps.includes('centros_servico') && centrosServicoOptions.length === 0) {
      missing.push('Centros de servico')
    }
    if (missing.length) {
      return {
        canSave: false,
        message: `Nao e possivel cadastrar enquanto ${missing.join(' e ')} estiverem vazios.`,
      }
    }
    return { canSave: true, message: '' }
  }, [centrosCustoOptions.length, centrosServicoOptions.length, tableConfig.dependsOn])

  const handleTableChange = (value) => {
    setTableKey(value)
    setFilters({ ...DEFAULT_FILTERS })
    setForm(buildDefaultForm())
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    if (name === 'ativo') {
      setForm((prev) => ({ ...prev, ativo: type === 'checkbox' ? Boolean(checked) : value !== 'false' }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    if (name === 'table') {
      handleTableChange(value)
      return
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    loadList()
  }

  const handleFilterClear = () => {
    setFilters({ ...DEFAULT_FILTERS })
    loadList({ ...DEFAULT_FILTERS })
  }

  const startEdit = (item) => {
    if (!item) return
    setEditingItem(item)
    setForm({
      nome: item.nome || '',
      ativo: item.ativo !== false,
      centroCustoId: item.centroCustoId || '',
      centroServicoId: item.centroServicoId || '',
    })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const resetForm = () => {
    setEditingItem(null)
    setForm(buildDefaultForm())
  }

  const resolveActor = useCallback(async () => {
    const baseName = user?.metadata?.username || user?.name || user?.email || null
    if (isLocalMode) {
      return { actorId: user?.id || null, actorName: baseName }
    }
    if (user?.metadata?.app_user_id) {
      return { actorId: user.metadata.app_user_id, actorName: baseName }
    }
    if (!user?.id) {
      return { actorId: null, actorName: baseName }
    }
    try {
      const effective = await resolveEffectiveAppUser(user.id, { forceRefresh: true })
      const profile = effective?.profile || null
      const actorName =
        profile?.username ||
        profile?.display_name ||
        profile?.email ||
        baseName
      return { actorId: effective?.appUserId || null, actorName }
    } catch (err) {
      reportError(err, { stage: 'resolve_actor' })
      return { actorId: null, actorName: baseName }
    }
  }, [reportError, user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!dependencyStatus.canSave) {
      return
    }
    if (!form.nome || !form.nome.trim()) {
      setError('Informe o nome para cadastro.')
      return
    }
    if (tableConfig?.relationField && !form[tableConfig.relationField]) {
      setError(`Selecione ${tableConfig.relationLabel?.toLowerCase?.() || 'um registro relacionado'}.`)
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const { actorId, actorName } = await resolveActor()
      if (!actorId) {
        setError('Aguardando sincronizacao do usuario. Tente novamente em alguns segundos.')
        return
      }
      const payload = {
        nome: form.nome,
        ativo: form.ativo,
        centroCustoId: form.centroCustoId || null,
        centroServicoId: form.centroServicoId || null,
        usuarioId: actorId,
        usuarioNome: actorName,
      }
      if (editingItem?.id) {
        await updateBasicRegistration(tableKey, editingItem.id, payload)
      } else {
        await createBasicRegistration(tableKey, payload)
      }
      resetForm()
      await loadList()
      await loadDependencies()
    } catch (err) {
      setError(err.message || 'Falha ao salvar cadastro base.')
      reportError(err, { stage: 'save', table: tableKey })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInactivate = async (item) => {
    if (!item?.id) return
    setIsSaving(true)
    setError(null)
    try {
      await inactivateBasicRegistration(tableKey, item.id)
      if (editingItem?.id === item.id) {
        resetForm()
      }
      await loadList()
      await loadDependencies()
    } catch (err) {
      setError(err.message || 'Falha ao inativar item.')
      reportError(err, { stage: 'inactivate', table: tableKey })
    } finally {
      setIsSaving(false)
    }
  }

  const openHistory = async (item) => {
    if (!item?.id) return
    setHistoryModal({ open: true, isLoading: true, error: null, item, registros: [], centrosCustoMap, centrosServicoMap })
    try {
      const registros = await listBasicRegistrationHistory(tableKey, item.id)
      const filtered = (registros || []).filter((registro) => registro?.action !== 'INSERT')
      setHistoryModal({ open: true, isLoading: false, error: null, item, registros: filtered, centrosCustoMap, centrosServicoMap })
    } catch (err) {
      setHistoryModal({
        open: true,
        isLoading: false,
        error: err.message || 'Falha ao carregar historico.',
        item,
        registros: [],
        centrosCustoMap,
        centrosServicoMap,
      })
      reportError(err, { stage: 'history', table: tableKey })
    }
  }

  const closeHistory = () => {
    setHistoryModal({ open: false, isLoading: false, error: null, item: null, registros: [], centrosCustoMap, centrosServicoMap })
  }

  return {
    tableKey,
    tableConfig,
    tableOptions: TABLES,
    form,
    filters,
    items,
    isLoading,
    isSaving,
    error,
    editingItem,
    centrosCustoOptions,
    centrosServicoOptions,
    centrosCustoMap,
    centrosServicoMap,
    dependencyStatus,
    historyModal,
    setTableKey: handleTableChange,
    handleFormChange,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleSubmit,
    startEdit,
    resetForm,
    handleInactivate,
    openHistory,
    closeHistory,
    reloadList: loadList,
    reloadDependencies: loadDependencies,
  }
}
