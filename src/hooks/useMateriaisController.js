import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useErrorLogger } from './useErrorLogger.js'
import {
  HISTORY_MODAL_DEFAULT,
  MATERIAIS_FILTER_DEFAULT,
  createMateriaisFormDefault,
} from '../config/MateriaisConfig.js'
import {
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_PROTECAO_MAOS,
  GRUPO_MATERIAL_VESTIMENTA,
  createMaterialPayload,
  filterMateriais,
  parseCaracteristicaEpi,
  resolveUsuarioNome,
  sortMateriaisByNome,
  updateMaterialPayload,
  validateMaterialForm,
} from '../routes/rules/MateriaisRules.js'
import { formatCurrency } from '../utils/MateriaisUtils.js'
import {
  normalizeSelectionItem,
  normalizeSelectionKey,
  normalizeSelectionList,
  selectionToArray,
} from '../utils/selectionUtils.js'
import {
  findOptionByValue,
  isGrupo,
  isValidUuid,
  mapHistoryWithUsuario,
  normalizeSelectionWithCurrent,
} from '../utils/MateriaisUtils.js'
import { sanitizeDigits, formatCurrencyInput } from '../utils/MateriaisUtils.js'
import {
  createMaterial,
  getMaterial,
  listCalcados,
  listCaracteristicas,
  listCores,
  listFabricantes,
  listGrupos,
  listItensDoGrupo,
  listMateriaisDetalhado,
  listTamanhos,
  priceHistory,
  updateMaterial,
} from '../services/materiaisService.js'

export function useMateriaisController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('materiais')

  const BASE_DIFF_PROMPT_DEFAULT = useMemo(
    () => ({ open: false, payload: null, id: null, editing: false, details: [] }),
    []
  )

  const [form, setForm] = useState(() => createMateriaisFormDefault())
  const [filters, setFilters] = useState(() => ({ ...MATERIAIS_FILTER_DEFAULT }))
  const [materiais, setMateriais] = useState([])
  const [materiaisBase, setMateriaisBase] = useState([])
  const [materiaisFiltrados, setMateriaisFiltrados] = useState([])
  const [historyCache, setHistoryCache] = useState({})
  const [historyModal, setHistoryModal] = useState(() => ({ ...HISTORY_MODAL_DEFAULT }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingMaterial, setEditingMaterial] = useState(null)

  const [materialGroups, setMaterialGroups] = useState([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [groupsError, setGroupsError] = useState(null)
  const [materialItems, setMaterialItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemsError, setItemsError] = useState(null)
  const [fabricanteOptions, setFabricanteOptions] = useState([])
  const [isLoadingFabricantes, setIsLoadingFabricantes] = useState(false)
  const [fabricanteError, setFabricanteError] = useState(null)
  const [caracteristicaOptions, setCaracteristicaOptions] = useState([])
  const [isLoadingCaracteristicas, setIsLoadingCaracteristicas] = useState(false)
  const [caracteristicaError, setCaracteristicaError] = useState(null)
  const [corOptions, setCorOptions] = useState([])
  const [isLoadingCores, setIsLoadingCores] = useState(false)
  const [corError, setCorError] = useState(null)
  const [calcadoOptions, setCalcadoOptions] = useState([])
  const [isLoadingCalcados, setIsLoadingCalcados] = useState(false)
  const [calcadoError, setCalcadoError] = useState(null)
  const [tamanhoOptions, setTamanhoOptions] = useState([])
  const [isLoadingTamanhos, setIsLoadingTamanhos] = useState(false)
  const [tamanhoError, setTamanhoError] = useState(null)
  const [baseDiffPrompt, setBaseDiffPrompt] = useState(BASE_DIFF_PROMPT_DEFAULT)

  const loadMateriais = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const items = await listMateriaisDetalhado()
      const lista = items ?? []
      setMateriais(lista)
      setMateriaisBase(lista)
      setMateriaisFiltrados(filterMateriais(lista, MATERIAIS_FILTER_DEFAULT, { sort: sortMateriaisByNome }))
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'materiais_load' })
    } finally {
      setIsLoading(false)
    }
  }, [reportError])

  useEffect(() => {
    loadMateriais()
  }, [loadMateriais])

  const loadMaterialGroups = useCallback(async () => {
    setIsLoadingGroups(true)
    setGroupsError(null)
    try {
      const grupos = await listGrupos()
      const lista = normalizeSelectionList(selectionToArray(grupos))
      setMaterialGroups(lista)
    } catch (err) {
      setGroupsError(err.message)
      setMaterialGroups([])
      reportError(err, { area: 'materiais_grupos' })
    } finally {
      setIsLoadingGroups(false)
    }
  }, [reportError])

  const loadFabricantes = useCallback(async () => {
    setIsLoadingFabricantes(true)
    setFabricanteError(null)
    try {
      const lista = await listFabricantes()
      setFabricanteOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setFabricanteError(err.message)
      setFabricanteOptions([])
      reportError(err, { area: 'materiais_fabricantes' })
    } finally {
      setIsLoadingFabricantes(false)
    }
  }, [reportError])

  const loadCaracteristicas = useCallback(async () => {
    setIsLoadingCaracteristicas(true)
    setCaracteristicaError(null)
    try {
      const lista = await listCaracteristicas()
      setCaracteristicaOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setCaracteristicaError(err.message)
      setCaracteristicaOptions([])
      reportError(err, { area: 'materiais_caracteristicas' })
    } finally {
      setIsLoadingCaracteristicas(false)
    }
  }, [reportError])

  const loadCores = useCallback(async () => {
    setIsLoadingCores(true)
    setCorError(null)
    try {
      const lista = await listCores()
      setCorOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setCorError(err.message)
      setCorOptions([])
      reportError(err, { area: 'materiais_cores' })
    } finally {
      setIsLoadingCores(false)
    }
  }, [reportError])

  const loadCalcados = useCallback(async () => {
    setIsLoadingCalcados(true)
    setCalcadoError(null)
    try {
      const lista = await listCalcados()
      setCalcadoOptions(Array.isArray(lista) ? lista : [])
    } catch (err) {
      setCalcadoError(err.message)
      setCalcadoOptions([])
      reportError(err, { area: 'materiais_calcados' })
    } finally {
      setIsLoadingCalcados(false)
    }
  }, [reportError])

  const loadTamanhos = useCallback(async () => {
    setIsLoadingTamanhos(true)
    setTamanhoError(null)
    try {
      const lista = await listTamanhos()
      setTamanhoOptions(Array.isArray(lista) ? lista : [])
    } catch (err) {
      setTamanhoError(err.message)
      setTamanhoOptions([])
      reportError(err, { area: 'materiais_tamanhos' })
    } finally {
      setIsLoadingTamanhos(false)
    }
  }, [reportError])

  useEffect(() => {
    loadMaterialGroups()
    loadCaracteristicas()
    loadCores()
    loadCalcados()
    loadTamanhos()
    loadFabricantes()
  }, [loadMaterialGroups, loadCaracteristicas, loadCores, loadCalcados, loadTamanhos, loadFabricantes])

  useEffect(() => {
    const grupoId = form.grupoMaterialId?.toString().trim()
    if (!grupoId) {
      setMaterialItems([])
      setItemsError(null)
      setIsLoadingItems(false)
      return
    }
    let cancelado = false
    setIsLoadingItems(true)
    setItemsError(null)
    listItensDoGrupo(grupoId)
      .then((lista) => {
        if (!cancelado) {
          setMaterialItems(normalizeSelectionList(selectionToArray(lista)))
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setItemsError(err.message)
          setMaterialItems([])
          reportError(err, { area: 'materiais_itens', grupoId })
        }
      })
      .finally(() => {
        if (!cancelado) {
          setIsLoadingItems(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [form.grupoMaterialId, reportError])

  useEffect(() => {
    if (!editingMaterial) {
      return
    }
    const targetValue =
      editingMaterial.materialItemNome ||
      editingMaterial.nomeId ||
      editingMaterial.nome ||
      editingMaterial.nomeItemRelacionado ||
      ''
    const targetKey = normalizeSelectionKey(targetValue)
    const matchedById =
      materialItems.find((item) => item.id && item.id === (editingMaterial.nomeId || editingMaterial.nome)) ?? null
    const matchedByName =
      materialItems.find((item) => normalizeSelectionKey(item.nome) === targetKey) ?? null
    const candidate = matchedById || matchedByName
    if (!candidate || !candidate.id) {
      return
    }

    const currentNome = form.nome || ''
    const shouldReset = !currentNome || !isValidUuid(currentNome) || currentNome === (editingMaterial.nome || '')
    if (!shouldReset || candidate.id === currentNome) {
      return
    }

    setForm((prev) => ({
      ...prev,
      nome: candidate.id,
      materialItemNome: candidate.nome,
      nomeItemRelacionado: candidate.nome,
    }))
  }, [editingMaterial, materialItems, form.nome])

  const handleFormChange = (event) => {
    const { name, value } = event.target

    if (name === 'ca') {
      setForm((prev) => ({ ...prev, ca: sanitizeDigits(value) }))
      return
    }

    if (name === 'valorUnitario') {
      setForm((prev) => ({ ...prev, valorUnitario: formatCurrencyInput(value) }))
      return
    }

    if (name === 'grupoMaterialId') {
      const selecionado = findOptionByValue(materialGroups, value) ?? null
      const nomeGrupo = selecionado?.nome ?? ''
      setForm((prev) => ({
        ...prev,
        grupoMaterialId: selecionado?.id ?? null,
        grupoMaterial: nomeGrupo,
        grupoMaterialNome: nomeGrupo,
        nome: '',
        numeroCalcado: isGrupo(nomeGrupo, GRUPO_MATERIAL_CALCADO) ? prev.numeroCalcado : '',
        numeroCalcadoNome: isGrupo(nomeGrupo, GRUPO_MATERIAL_CALCADO) ? prev.numeroCalcadoNome : '',
        numeroVestimenta:
          isGrupo(nomeGrupo, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(nomeGrupo, GRUPO_MATERIAL_PROTECAO_MAOS)
            ? prev.numeroVestimenta
            : '',
        numeroVestimentaNome:
          isGrupo(nomeGrupo, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(nomeGrupo, GRUPO_MATERIAL_PROTECAO_MAOS)
            ? prev.numeroVestimentaNome
            : '',
      }))
      setMaterialItems([])
      setItemsError(null)
      return
    }

    if (name === 'nome') {
      const selecionado = findOptionByValue(materialItems, value)
      setForm((prev) => ({
        ...prev,
        nome: selecionado?.id ?? '',
        materialItemNome: selecionado?.nome ?? prev.materialItemNome ?? value,
        nomeItemRelacionado: selecionado?.nome ?? prev.nomeItemRelacionado ?? value,
      }))
      return
    }

    if (name === 'fabricante') {
      const selecionado = findOptionByValue(fabricanteOptions, value) ?? normalizeSelectionItem(value)
      setForm((prev) => ({
        ...prev,
        fabricante: selecionado?.id ?? value,
        fabricanteNome: selecionado?.nome ?? value,
      }))
      return
    }

    if (name === 'numeroCalcado') {
      const selecionado = findOptionByValue(calcadoOptions, value)
      setForm((prev) => ({
        ...prev,
        numeroCalcado: selecionado?.id ?? '',
        numeroCalcadoNome: selecionado?.nome ?? value,
      }))
      return
    }

    if (name === 'numeroVestimenta') {
      const selecionado = findOptionByValue(tamanhoOptions, value)
      setForm((prev) => ({
        ...prev,
        numeroVestimenta: selecionado?.id ?? '',
        numeroVestimentaNome: selecionado?.nome ?? value,
      }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddCaracteristica = (valor) => {
    setForm((prev) => {
      const selecionada = normalizeSelectionItem(findOptionByValue(caracteristicaOptions, valor) ?? valor)
      if (!selecionada) {
        return prev
      }
      const atualizada = normalizeSelectionList([...normalizeSelectionList(prev.caracteristicaEpi), selecionada])
      if (atualizada.length === normalizeSelectionList(prev.caracteristicaEpi).length) {
        return prev
      }
      const ids = atualizada.map((item) => item.id).filter(Boolean)
      return {
        ...prev,
        caracteristicaEpi: atualizada,
        caracteristicas: atualizada,
        caracteristicasIds: ids,
        caracteristicas_epi: ids,
      }
    })
  }

  const handleRemoveCaracteristica = (valor) => {
    setForm((prev) => {
      const atualizada = normalizeSelectionList(prev.caracteristicaEpi).filter((item) => item.id !== valor && item.nome !== valor)
      const ids = atualizada.map((item) => item.id).filter(Boolean)
      return {
        ...prev,
        caracteristicaEpi: atualizada,
        caracteristicas: atualizada,
        caracteristicasIds: ids,
        caracteristicas_epi: ids,
      }
    })
  }

  const handleAddCor = (valor) => {
    setForm((prev) => {
      const selecionada = normalizeSelectionItem(findOptionByValue(corOptions, valor) ?? valor)
      if (!selecionada) {
        return prev
      }
      const atualizada = normalizeSelectionList([...normalizeSelectionList(prev.cores), selecionada])
      if (atualizada.length === normalizeSelectionList(prev.cores).length) {
        return prev
      }
      return {
        ...prev,
        cores: atualizada,
        coresIds: atualizada.map((item) => item.id).filter(Boolean),
        corMaterial: atualizada[0]?.nome ?? '',
      }
    })
  }

  const handleRemoveCor = (valor) => {
    setForm((prev) => {
      const atualizada = normalizeSelectionList(prev.cores).filter((item) => item.id !== valor && item.nome !== valor)
      return {
        ...prev,
        cores: atualizada,
        coresIds: atualizada.map((item) => item.id).filter(Boolean),
        corMaterial: atualizada[0]?.nome ?? '',
      }
    })
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setMateriaisFiltrados(filterMateriais(materiaisBase, filters, { sort: sortMateriaisByNome }))
  }

  const handleFilterClear = () => {
    const defaults = { ...MATERIAIS_FILTER_DEFAULT }
    setFilters(defaults)
    setMateriaisFiltrados(filterMateriais(materiaisBase, defaults, { sort: sortMateriaisByNome }))
  }

  const resetForm = () => {
    setEditingMaterial(null)
    setForm(createMateriaisFormDefault())
    setMaterialItems([])
    setItemsError(null)
    setIsLoadingItems(false)
  }

  const closeBaseDiffPrompt = useCallback(
    () => setBaseDiffPrompt(BASE_DIFF_PROMPT_DEFAULT),
    [BASE_DIFF_PROMPT_DEFAULT]
  )

  const confirmBaseDiff = useCallback(async () => {
    if (!baseDiffPrompt.open || !baseDiffPrompt.payload) {
      closeBaseDiffPrompt()
      return
    }
    setIsSaving(true)
    try {
      if (baseDiffPrompt.editing && baseDiffPrompt.id) {
        await updateMaterial(baseDiffPrompt.id, { ...baseDiffPrompt.payload, forceBaseCaDiff: true })
        setHistoryCache((prev) => {
          const next = { ...prev }
          delete next[baseDiffPrompt.id]
          return next
        })
      } else {
        await createMaterial({ ...baseDiffPrompt.payload, forceBaseCaDiff: true })
      }
      resetForm()
      await loadMateriais()
      closeBaseDiffPrompt()
    } catch (err) {
      setError(err.message || 'Falha ao salvar material.')
      reportError(err, { area: 'materiais_submit_base_diff', editing: baseDiffPrompt.editing })
    } finally {
      setIsSaving(false)
    }
  }, [baseDiffPrompt, closeBaseDiffPrompt, loadMateriais, reportError, resetForm])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const erro = validateMaterialForm(form)
    if (erro) {
      setError(erro)
      return
    }
    setIsSaving(true)
    try {
      const usuario = resolveUsuarioNome(user)
      if (editingMaterial) {
        const payload = updateMaterialPayload(form, usuario)
        try {
          await updateMaterial(editingMaterial.id, payload)
        } catch (err) {
          if (err?.code === 'BASE_CA_DIFF') {
            setBaseDiffPrompt({
              open: true,
              payload,
              id: editingMaterial?.id ?? null,
              editing: true,
              details: Array.isArray(err?.details) ? err.details : [],
            })
            setIsSaving(false)
            return
          } else {
            throw err
          }
        }
        setHistoryCache((prev) => {
          const next = { ...prev }
          delete next[editingMaterial.id]
          return next
        })
        resetForm()
        await loadMateriais()
      } else {
        const payload = createMaterialPayload(form, usuario)
        try {
          await createMaterial(payload)
        } catch (err) {
          if (err?.code === 'BASE_CA_DIFF') {
            setBaseDiffPrompt({
              open: true,
              payload,
              id: null,
              editing: false,
              details: Array.isArray(err?.details) ? err.details : [],
            })
            setIsSaving(false)
            return
          } else {
            throw err
          }
        }
        resetForm()
        await loadMateriais()
      }
    } catch (err) {
      setError(err.message || 'Falha ao salvar material.')
      reportError(err, { area: 'materiais_submit', editing: Boolean(editingMaterial) })
    } finally {
      setIsSaving(false)
    }
  }

  const openHistory = async (material) => {
    setError(null)
    const cached = historyCache[material.id]
    if (cached) {
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, items: cached })
      return
    }
    setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, isLoading: true })
    try {
      const data = await priceHistory(material.id)
      const items = mapHistoryWithUsuario(data, material)
      setHistoryCache((prev) => ({ ...prev, [material.id]: items }))
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, items })
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'materiais_history', materialId: material.id })
      setHistoryModal({
        ...HISTORY_MODAL_DEFAULT,
        open: true,
        material,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistoryModal = () => {
    setHistoryModal({ ...HISTORY_MODAL_DEFAULT })
  }

  const startEdit = async (material) => {
    if (!material || !material.id) {
      return
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setError(null)
    setEditingMaterial(material)
    let materialAtualizado = material
    try {
      materialAtualizado = await getMaterial(material.id)
    } catch (err) {
      reportError(err, { area: 'materiais_get', materialId: material.id })
    }
    const grupoNome = materialAtualizado.grupoMaterialNome || materialAtualizado.grupoMaterial || ''
    const grupoAtual = normalizeSelectionItem({ id: materialAtualizado.grupoMaterialId, nome: grupoNome })
    const isCalcadoGrupo = isGrupo(grupoNome, GRUPO_MATERIAL_CALCADO)
    const hasCalcadoDados =
      Boolean(materialAtualizado.numeroCalcado) || Boolean(materialAtualizado.numeroCalcadoNome)
    const isCalcado = isCalcadoGrupo || hasCalcadoDados

    const isVestimentaGrupo =
      isGrupo(grupoNome, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(grupoNome, GRUPO_MATERIAL_PROTECAO_MAOS)
    const hasVestimentaDados =
      Boolean(materialAtualizado.numeroVestimenta) || Boolean(materialAtualizado.numeroVestimentaNome)
    const isVestimenta = isVestimentaGrupo || hasVestimentaDados
    setMaterialGroups((prev) => normalizeSelectionWithCurrent(prev, grupoAtual))
    setMaterialItems((prev) => normalizeSelectionWithCurrent(prev, { id: materialAtualizado.nome, nome: materialAtualizado.materialItemNome || materialAtualizado.nome }))
    setFabricanteOptions((prev) =>
      normalizeSelectionWithCurrent(prev, { id: materialAtualizado.fabricante, nome: materialAtualizado.fabricanteNome }),
    )
    setCalcadoOptions((prev) =>
      normalizeSelectionWithCurrent(prev, {
        id: materialAtualizado.numeroCalcado ?? materialAtualizado.numeroCalcadoNome,
        nome: materialAtualizado.numeroCalcadoNome ?? materialAtualizado.numeroCalcado ?? '',
      }),
    )
    setTamanhoOptions((prev) =>
      normalizeSelectionWithCurrent(prev, {
        id: materialAtualizado.numeroVestimenta ?? materialAtualizado.numeroVestimentaNome,
        nome: materialAtualizado.numeroVestimentaNome ?? materialAtualizado.numeroVestimenta ?? '',
      }),
    )
    const caracteristicaEpi = parseCaracteristicaEpi(materialAtualizado.caracteristicaEpi || materialAtualizado.caracteristicas)
    setForm({
      ...materialAtualizado,
      grupoMaterialId: materialAtualizado.grupoMaterialId || grupoAtual?.id || null,
      grupoMaterialNome: grupoNome,
      nome: materialAtualizado.nome || materialAtualizado.nomeId || '',
      materialItemNome: materialAtualizado.materialItemNome || materialAtualizado.nomeItemRelacionado || '',
      caracteristicaEpi,
      caracteristicas: caracteristicaEpi,
      caracteristicasIds: (caracteristicaEpi || []).map((item) => item.id).filter(Boolean),
      caracteristicas_epi: (caracteristicaEpi || []).map((item) => item.id).filter(Boolean),
      cores: materialAtualizado.cores || [],
      coresIds: (materialAtualizado.cores || []).map((item) => item.id).filter(Boolean),
      corMaterial: materialAtualizado.corMaterial || materialAtualizado.cores?.[0]?.nome || '',
      numeroCalcado: isCalcado ? materialAtualizado.numeroCalcado ?? materialAtualizado.numeroCalcadoNome ?? '' : '',
      numeroCalcadoNome: isCalcado ? materialAtualizado.numeroCalcadoNome ?? materialAtualizado.numeroCalcado ?? '' : '',
      numeroVestimenta: isVestimenta
        ? materialAtualizado.numeroVestimenta ?? materialAtualizado.numeroVestimentaNome ?? ''
        : '',
      numeroVestimentaNome: isVestimenta
        ? materialAtualizado.numeroVestimentaNome ?? materialAtualizado.numeroVestimenta ?? ''
        : '',
      valorUnitario: formatCurrency(materialAtualizado.valorUnitario ?? materialAtualizado.valorUnitarioHistorico ?? 0),
    })
  }

  const materiaisOrdenados = useMemo(() => sortMateriaisByNome(materiaisFiltrados), [materiaisFiltrados])

  return {
    form,
    filters,
    materiais,
    materiaisBase,
    materiaisOrdenados,
    historyCache,
    historyModal,
    isLoading,
    isSaving,
    error,
    editingMaterial,
    materialGroups,
    isLoadingGroups,
    groupsError,
    materialItems,
    isLoadingItems,
    itemsError,
    fabricanteOptions,
    isLoadingFabricantes,
    fabricanteError,
    caracteristicaOptions,
    isLoadingCaracteristicas,
    caracteristicaError,
    corOptions,
    isLoadingCores,
    corError,
    calcadoOptions,
    isLoadingCalcados,
    calcadoError,
    tamanhoOptions,
    isLoadingTamanhos,
    tamanhoError,
    handleFormChange,
    handleAddCaracteristica,
    handleRemoveCaracteristica,
    handleAddCor,
    handleRemoveCor,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleSubmit,
    openHistory,
    closeHistoryModal,
    startEdit,
    resetForm,
    loadMateriais,
    baseDiffPrompt,
    confirmBaseDiff,
    cancelBaseDiff: closeBaseDiffPrompt,
    setCurrentPage: () => {},
  }
}
