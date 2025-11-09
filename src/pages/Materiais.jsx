import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { MateriaisForm } from '../components/Materiais/MateriaisForm.jsx'
import { MateriaisFilters } from '../components/Materiais/MateriaisFilters.jsx'
import { MateriaisTable } from '../components/Materiais/MateriaisTable.jsx'
import { MateriaisHistoryModal } from '../components/Materiais/MateriaisHistoryModal.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  HISTORY_MODAL_DEFAULT,
  MATERIAIS_FILTER_DEFAULT,
  createMateriaisFormDefault,
} from '../config/MateriaisConfig.js'
import {
  createMaterialPayload,
  filterMateriais,
  resolveUsuarioNome,
  validateMaterialForm,
  sortMateriaisByNome,
  updateMaterialPayload,
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_VESTIMENTA,
  GRUPO_MATERIAL_PROTECAO_MAOS,
  parseCaracteristicaEpi,
} from '../rules/MateriaisRules.js'
import { formatCurrency, formatCurrencyInput, sanitizeDigits } from '../utils/MateriaisUtils.js'
import {
  normalizeSelectionItem,
  normalizeSelectionKey,
  normalizeSelectionList,
  selectionToArray,
} from '../utils/selectionUtils.js'
import '../styles/MateriaisPage.css'

const normalizeGrupo = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const isGrupo = (value, target) => normalizeGrupo(value) === normalizeGrupo(target)

const findOptionByValue = (options, valor) => {
  const alvo = typeof valor === 'string' ? valor.trim() : valor
  if (!alvo) {
    return null
  }

  return options.find((item) => {
    const id = item?.id ?? item?.value ?? item?.valor ?? item?.nome
    return id === alvo || item?.nome === alvo
  })
}

export function MateriaisPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => createMateriaisFormDefault())
  const [filters, setFilters] = useState(() => ({ ...MATERIAIS_FILTER_DEFAULT }))
  const [materiais, setMateriais] = useState([])
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

  const loadMaterialGroups = useCallback(async () => {
    setIsLoadingGroups(true)
    setGroupsError(null)
    try {
      const grupos = await api.materiais.groups()
      const lista = normalizeSelectionList(selectionToArray(grupos))
      setMaterialGroups(lista)
    } catch (err) {
      setGroupsError(err.message)
      setMaterialGroups([])
    } finally {
      setIsLoadingGroups(false)
    }
  }, [])

  const loadFabricantes = useCallback(async () => {
    setIsLoadingFabricantes(true)
    setFabricanteError(null)
    try {
      const lista = await api.materiais.fabricantes?.()
      setFabricanteOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setFabricanteError(err.message)
      setFabricanteOptions([])
    } finally {
      setIsLoadingFabricantes(false)
    }
  }, [])

  const loadMateriais = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const items = await api.materiais.listDetalhado()
      setMateriais(items ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMateriais()
  }, [loadMateriais])

  useEffect(() => {
    loadMaterialGroups()
  }, [loadMaterialGroups])

  const loadCaracteristicas = useCallback(async () => {
    setIsLoadingCaracteristicas(true)
    setCaracteristicaError(null)
    try {
      const lista = await api.materiais.caracteristicas()
      setCaracteristicaOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setCaracteristicaError(err.message)
      setCaracteristicaOptions([])
    } finally {
      setIsLoadingCaracteristicas(false)
    }
  }, [])

  const loadCores = useCallback(async () => {
    setIsLoadingCores(true)
    setCorError(null)
    try {
      const lista = await api.materiais.cores()
      setCorOptions(normalizeSelectionList(selectionToArray(lista)))
    } catch (err) {
      setCorError(err.message)
      setCorOptions([])
    } finally {
      setIsLoadingCores(false)
    }
  }, [])

  const loadCalcados = useCallback(async () => {
    setIsLoadingCalcados(true)
    setCalcadoError(null)
    try {
      const lista = await api.materiais.medidasCalcado()
      setCalcadoOptions(Array.isArray(lista) ? lista : [])
    } catch (err) {
      setCalcadoError(err.message)
      setCalcadoOptions([])
    } finally {
      setIsLoadingCalcados(false)
    }
  }, [])

  const loadTamanhos = useCallback(async () => {
    setIsLoadingTamanhos(true)
    setTamanhoError(null)
    try {
      const lista = await api.materiais.medidasVestimenta()
      setTamanhoOptions(Array.isArray(lista) ? lista : [])
    } catch (err) {
      setTamanhoError(err.message)
      setTamanhoOptions([])
    } finally {
      setIsLoadingTamanhos(false)
    }
  }, [])

  useEffect(() => {
    loadCaracteristicas()
    loadCores()
    loadCalcados()
    loadTamanhos()
    loadFabricantes()
  }, [loadCaracteristicas, loadCores, loadCalcados, loadTamanhos, loadFabricantes])

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
    api.materiais
      .items(grupoId)
      .then((lista) => {
        if (!cancelado) {
          setMaterialItems(normalizeSelectionList(selectionToArray(lista)))
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setItemsError(err.message)
          setMaterialItems([])
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
  }, [form.grupoMaterialId])

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
        grupoMaterialId: value,
        grupoMaterial: nomeGrupo,
        grupoMaterialNome: nomeGrupo,
        nome: '',
        numeroCalcado: isGrupo(nomeGrupo, GRUPO_MATERIAL_CALCADO) ? prev.numeroCalcado : '',
        numeroVestimenta:
          isGrupo(nomeGrupo, GRUPO_MATERIAL_VESTIMENTA) ||
          isGrupo(nomeGrupo, GRUPO_MATERIAL_PROTECAO_MAOS)
            ? prev.numeroVestimenta
            : '',
      }))
      setMaterialItems([])
      setItemsError(null)
      return
    }

    if (name === 'nome') {
      const selecionado = findOptionByValue(materialItems, value) ?? normalizeSelectionItem(value)
      setForm((prev) => ({
        ...prev,
        nome: selecionado?.nome ?? value,
      }))
      return
    }

    if (name === 'fabricante') {
      const selecionado = findOptionByValue(fabricanteOptions, value) ?? normalizeSelectionItem(value)
      setForm((prev) => ({
        ...prev,
        fabricante: value,
        fabricanteNome: selecionado?.nome ?? value,
      }))
      return
    }

    if (name === 'numeroCalcado') {
      setForm((prev) => ({ ...prev, numeroCalcado: sanitizeDigits(value) }))
      return
    }

    if (name === 'numeroVestimenta') {
      setForm((prev) => ({ ...prev, numeroVestimenta: value }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddCaracteristica = (valor) => {
    setForm((prev) => {
      const selecionada = normalizeSelectionItem(
        findOptionByValue(caracteristicaOptions, valor) ?? valor,
      )

      if (!selecionada) {
        return prev
      }

      const atual = normalizeSelectionList(prev.caracteristicaEpi)

      if (
        atual.some((item) => {
          if (item.id && selecionada.id) {
            return item.id === selecionada.id
          }
          return normalizeSelectionKey(item.nome) === normalizeSelectionKey(selecionada.nome)
        })
      ) {
        return prev
      }

      const atualizada = [...atual, selecionada].sort((a, b) => a.nome.localeCompare(b.nome))

      return {
        ...prev,
        caracteristicaEpi: atualizada,
        caracteristicas_epi: atualizada.map((item) => item.id).filter(Boolean),
      }
    })
  }

  const handleRemoveCaracteristica = (valor) => {
    setForm((prev) => {
      const atualizada = normalizeSelectionList(prev.caracteristicaEpi).filter(
        (item) => item.id !== valor && item.nome !== valor,
      )

      return {
        ...prev,
        caracteristicaEpi: atualizada,
        caracteristicas_epi: atualizada.map((item) => item.id).filter(Boolean),
      }
    })
  }

  const handleAddCor = (valor) => {
    setForm((prev) => {
      const selecionada = normalizeSelectionItem(findOptionByValue(corOptions, valor) ?? valor)

      if (!selecionada) {
        return prev
      }

      const atual = normalizeSelectionList(prev.cores)

      if (
        atual.some((item) => {
          if (item.id && selecionada.id) {
            return item.id === selecionada.id
          }
          return normalizeSelectionKey(item.nome) === normalizeSelectionKey(selecionada.nome)
        })
      ) {
        return prev
      }

      const atualizada = [...atual, selecionada].sort((a, b) => a.nome.localeCompare(b.nome))

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
      const atualizada = normalizeSelectionList(prev.cores).filter(
        (item) => item.id !== valor && item.nome !== valor,
      )

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
  }

  const handleFilterClear = () => {
    setFilters({ ...MATERIAIS_FILTER_DEFAULT })
  }

  const resetForm = () => {
    setEditingMaterial(null)
    setForm(createMateriaisFormDefault())
    setMaterialItems([])
    setItemsError(null)
    setIsLoadingItems(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const validationError = validateMaterialForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)

    try {
      const usuario = resolveUsuarioNome(user)

      if (editingMaterial) {
        await api.materiais.update(editingMaterial.id, updateMaterialPayload(form, usuario))
      } else {
        await api.materiais.create(createMaterialPayload(form, usuario))
      }

      resetForm()
      setHistoryCache({})
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT })
      await loadMateriais()
      await loadMaterialGroups()
    } catch (err) {
      setError(err.message)
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
      const data = await api.materiais.priceHistory(material.id)
      const items = (data ?? []).map((registro) => {
        const alteracoes = Array.isArray(registro?.camposAlterados)
          ? registro.camposAlterados
          : []
        const isAtualizacao = alteracoes.length > 0
        const usuarioResolved = (
          isAtualizacao ? material.usuarioAtualizacaoNome : material.usuarioCadastroNome
        )
        return {
          ...registro,
          usuarioResponsavel: usuarioResolved || registro.usuarioResponsavel || '-',
        }
      })
      setHistoryCache((prev) => ({ ...prev, [material.id]: items }))
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, items })
    } catch (err) {
      setError(err.message)
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

  const startEdit = (material) => {
    const grupoMaterialDisplay =
      material.grupoMaterialNome || material.grupoMaterial || ''
    const nomeEpiDisplay = material.nomeItemRelacionado || material.nome || ''
    const numeroCalcadoDisplay =
      material.numeroCalcadoNome || material.numeroCalcado || ''
    const numeroVestimentaDisplay =
      material.numeroVestimentaNome || material.numeroVestimenta || ''
    const grupoSelecionado = normalizeSelectionItem({
      id: material.grupoMaterialId || material.grupoMaterial || grupoMaterialDisplay || material.id,
      nome: grupoMaterialDisplay,
    })
    const itemSelecionado = normalizeSelectionItem({
      id: material.materialItemNome || nomeEpiDisplay,
      nome: nomeEpiDisplay,
    })
    const fabricanteSelecionado = normalizeSelectionItem({
      id: material.fabricante || material.fabricanteNome,
      nome: material.fabricanteNome || material.fabricante || '',
    })

    const caracteristicas = normalizeSelectionList(
      Array.isArray(material.caracteristicas) && material.caracteristicas.length
        ? material.caracteristicas
        : parseCaracteristicaEpi(material.caracteristicaEpi).map((nome) => ({ id: nome, nome })),
    )

    const cores = normalizeSelectionList(
      Array.isArray(material.cores) && material.cores.length
        ? material.cores
        : material.corMaterial
          ? [{ id: material.corMaterial, nome: material.corMaterial }]
          : [],
    )

    setEditingMaterial(material)
    if (grupoSelecionado) {
      setMaterialGroups((prev) => normalizeSelectionList([...prev, grupoSelecionado]))
    }
    if (itemSelecionado) {
      setMaterialItems((prev) => normalizeSelectionList([...prev, itemSelecionado]))
    }
    if (fabricanteSelecionado) {
      setFabricanteOptions((prev) => normalizeSelectionList([...prev, fabricanteSelecionado]))
    }
    setForm({
      nome: nomeEpiDisplay,
      fabricante: fabricanteSelecionado?.nome || '',
      validadeDias: String(material.validadeDias ?? ''),
      ca: material.ca || '',
      valorUnitario: formatCurrency(material.valorUnitario),
      grupoMaterial: grupoMaterialDisplay,
      grupoMaterialNome: grupoMaterialDisplay,
      grupoMaterialId: grupoSelecionado?.id ?? '',
      numeroCalcado: numeroCalcadoDisplay,
      numeroVestimenta: numeroVestimentaDisplay,
      caracteristicaEpi: caracteristicas,
      caracteristicas_epi: caracteristicas.map((item) => item.id).filter(Boolean),
      corMaterial: cores[0]?.nome ?? '',
      cores,
      coresIds: cores.map((item) => item.id).filter(Boolean),
      descricao: material.descricao || '',
    })
    setItemsError(null)
  }

  const cancelEdit = () => {
    resetForm()
  }

  const materiaisFiltrados = useMemo(
    () => filterMateriais(materiais, filters),
    [materiais, filters],
  )

  const materiaisOrdenados = useMemo(
    () => sortMateriaisByNome(materiaisFiltrados),
    [materiaisFiltrados],
  )

  return (
    <div className="stack">
      <PageHeader
        icon={<MaterialIcon size={28} />}
        title="Materiais"
        subtitle="Cadastre EPIs com validade, CA e mantenha historico de precos."
      />

      <MateriaisForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingMaterial={editingMaterial}
        onCancel={cancelEdit}
        error={error}
        materialGroups={materialGroups}
        isLoadingGroups={isLoadingGroups}
        groupsError={groupsError}
        materialItems={materialItems}
        isLoadingItems={isLoadingItems}
        itemsError={itemsError}
        fabricanteOptions={fabricanteOptions}
        isLoadingFabricantes={isLoadingFabricantes}
        fabricanteError={fabricanteError}
        caracteristicaOptions={caracteristicaOptions}
        isLoadingCaracteristicas={isLoadingCaracteristicas}
        caracteristicaError={caracteristicaError}
        corOptions={corOptions}
        isLoadingCores={isLoadingCores}
        corError={corError}
        calcadoOptions={calcadoOptions}
        isLoadingCalcado={isLoadingCalcados}
        calcadoError={calcadoError}
        tamanhoOptions={tamanhoOptions}
        isLoadingTamanho={isLoadingTamanhos}
        tamanhoError={tamanhoError}
        onAddCaracteristica={handleAddCaracteristica}
        onRemoveCaracteristica={handleRemoveCaracteristica}
        onAddCor={handleAddCor}
        onRemoveCor={handleRemoveCor}
      />

      <MateriaisFilters
        filters={filters}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Materiais cadastrados</h2>
          <button type="button" className="button button--ghost" onClick={loadMateriais} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <MateriaisTable
            materiais={materiaisOrdenados}
            onEdit={startEdit}
            onHistory={openHistory}
            editingId={editingMaterial?.id ?? null}
            isSaving={isSaving}
            historyModal={historyModal}
          />
        ) : null}
      </section>

      <MateriaisHistoryModal modal={historyModal} onClose={closeHistoryModal} />
    </div>
  )
}
