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

const isValidUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

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
    const shouldReset =
      !currentNome || !isValidUuid(currentNome) || currentNome === (editingMaterial.nome || '')
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

    // Grupo de material (UUID + nome legível)
    if (name === 'grupoMaterialId') {
      const selecionado = findOptionByValue(materialGroups, value) ?? null
      const nomeGrupo = selecionado?.nome ?? ''
      setForm((prev) => ({
        ...prev,
        grupoMaterialId: selecionado?.id ?? null, // UUID real ou null
        grupoMaterial: nomeGrupo,
        grupoMaterialNome: nomeGrupo,
        nome: '',
        numeroCalcado: isGrupo(nomeGrupo, GRUPO_MATERIAL_CALCADO) ? prev.numeroCalcado : '',
        numeroCalcadoNome: isGrupo(nomeGrupo, GRUPO_MATERIAL_CALCADO)
          ? prev.numeroCalcadoNome
          : '',
        numeroVestimenta:
          isGrupo(nomeGrupo, GRUPO_MATERIAL_VESTIMENTA) ||
          isGrupo(nomeGrupo, GRUPO_MATERIAL_PROTECAO_MAOS)
            ? prev.numeroVestimenta
            : '',
        numeroVestimentaNome:
          isGrupo(nomeGrupo, GRUPO_MATERIAL_VESTIMENTA) ||
          isGrupo(nomeGrupo, GRUPO_MATERIAL_PROTECAO_MAOS)
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
        materialItemNome: selecionado?.materialItemNome ?? value, // texto legível
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

    // 1. Validação (reaproveitada para create e update)
    const erro = validateMaterialForm(form)
    if (erro) {
      setError(erro)
      return
    }

    setIsSaving(true)

    try {
      const usuario = resolveUsuarioNome(user)

      if (editingMaterial) {
        // ====== FLUXO DE EDIÇÃO ======
        // 2. Construção do payload com updateMaterialPayload
        const payload = updateMaterialPayload(form, usuario)

        // 3. Atualiza via API (gera diff textual + histórico automaticamente)
        await api.materiais.update(editingMaterial.id, payload)

        // 4. Limpa cache de histórico (foi atualizado)
        setHistoryCache((prev) => {
          const newCache = { ...prev }
          delete newCache[editingMaterial.id]
          return newCache
        })

        // 5. Feedback e reset
        resetForm()
        await loadMateriais()
      } else {
        // ====== FLUXO DE CRIAÇÃO ======
        // 2. Construção do payload com createMaterialPayload (sem histórico)
        const payload = createMaterialPayload(form, usuario)

        // 3. Cria via API (sem diff, sem histórico textual)
        await api.materiais.create(payload)

        // 4. Feedback e reset
        resetForm()
        await loadMateriais()
      }

    } catch (err) {
      // Mantém estado para correção em caso de erro
      setError(err.message || 'Falha ao salvar material.')
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

  const startEdit = async (material) => {
    if (!material || !material.id) {
      return
    }

    setError(null)
    setEditingMaterial(material)

    // 1. Carrega dados atualizados da view para garantir consistência
    let materialAtualizado = material
    try {
      materialAtualizado = await api.materiais.get(material.id)
      console.log('Material carregado para edição:', {
        id: materialAtualizado.id,
        nome: materialAtualizado.nome,
        caracteristicas: materialAtualizado.caracteristicas,
        caracteristicasIds: materialAtualizado.caracteristicasIds,
        caracteristicas_epi: materialAtualizado.caracteristicas_epi,
        caracteristicaEpi: materialAtualizado.caracteristicaEpi,
        caracteristicasTexto: materialAtualizado.caracteristicasTexto,
        cores: materialAtualizado.cores,
        coresIds: materialAtualizado.coresIds,
        corMaterial: materialAtualizado.corMaterial,
        coresTexto: materialAtualizado.coresTexto
      })
    } catch (err) {
      console.warn('Falha ao recarregar material, usando dados da listagem:', err)
    }

    // 2. Normaliza características mantendo IDs do catálogo
    let caracteristicasArray = []
    
    // Prioriza array de objetos estruturados
    if (Array.isArray(materialAtualizado.caracteristicas) && materialAtualizado.caracteristicas.length > 0) {
      caracteristicasArray = materialAtualizado.caracteristicas
    } 
    // Tenta IDs
    else if (Array.isArray(materialAtualizado.caracteristicasIds) && materialAtualizado.caracteristicasIds.length > 0) {
      caracteristicasArray = materialAtualizado.caracteristicasIds.map(id => ({ id, nome: id }))
    }
    else if (Array.isArray(materialAtualizado.caracteristicas_epi) && materialAtualizado.caracteristicas_epi.length > 0) {
      caracteristicasArray = materialAtualizado.caracteristicas_epi.map(id => ({ id, nome: id }))
    }
    // Parse do texto
    else if (materialAtualizado.caracteristicaEpi || materialAtualizado.caracteristicasTexto) {
      const texto = materialAtualizado.caracteristicaEpi || materialAtualizado.caracteristicasTexto || ''
      caracteristicasArray = parseCaracteristicaEpi(texto).map(nome => ({ id: nome, nome }))
    }

    const caracteristicasNormalizadas = normalizeSelectionList(
      caracteristicasArray.map((item) =>
        typeof item === 'string' ? { id: item, nome: item } : item
      ).filter(item => item.nome)
    )

    // 3. Normaliza cores mantendo IDs do catálogo
    let coresArray = []
    
    // Prioriza array de objetos estruturados
    if (Array.isArray(materialAtualizado.cores) && materialAtualizado.cores.length > 0) {
      coresArray = materialAtualizado.cores
    }
    // Tenta IDs
    else if (Array.isArray(materialAtualizado.coresIds) && materialAtualizado.coresIds.length > 0) {
      coresArray = materialAtualizado.coresIds.map(id => ({ id, nome: id }))
    }
    // Parse do texto
    else if (materialAtualizado.corMaterial || materialAtualizado.coresTexto) {
      const texto = materialAtualizado.corMaterial || materialAtualizado.coresTexto || ''
      const nomes = texto.split(/[;,]/).map(s => s.trim()).filter(Boolean)
      coresArray = nomes.map(nome => ({ id: nome, nome }))
    }

    const coresNormalizadas = normalizeSelectionList(
      coresArray.map((item) =>
        typeof item === 'string' ? { id: item, nome: item } : item
      ).filter(item => item.nome)
    )

    console.log('Características normalizadas:', caracteristicasNormalizadas)
    console.log('Cores normalizadas:', coresNormalizadas)

    // 4. Preenche o formulário com UUIDs (FKs) + textos legíveis
    setForm({
      // Nome do EPI: UUID de grupos_material_itens
      nome: materialAtualizado.nome || materialAtualizado.nomeId || '',
      materialItemNome: materialAtualizado.materialItemNome || materialAtualizado.nomeItemRelacionado || '',
      nomeItemRelacionado: materialAtualizado.nomeItemRelacionado || materialAtualizado.materialItemNome || '',
      
      // Fabricante: UUID ou texto
      fabricante: materialAtualizado.fabricante || '',
      fabricanteNome: materialAtualizado.fabricanteNome || materialAtualizado.fabricante || '',
      
      // Dados básicos
      validadeDias: materialAtualizado.validadeDias || '',
      ca: materialAtualizado.ca || '',
      valorUnitario: formatCurrency(materialAtualizado.valorUnitario || 0),
      estoqueMinimo: materialAtualizado.estoqueMinimo || 0,
      ativo: materialAtualizado.ativo !== false,
      descricao: materialAtualizado.descricao || '',
      
      // Grupo de material: UUID + nome
      grupoMaterial: materialAtualizado.grupoMaterialNome || materialAtualizado.grupoMaterial || '',
      grupoMaterialNome: materialAtualizado.grupoMaterialNome || materialAtualizado.grupoMaterial || '',
      grupoMaterialId: materialAtualizado.grupoMaterialId || materialAtualizado.grupoMaterial || '',
      
      // Numerações: UUIDs das FKs
      numeroCalcado: materialAtualizado.numeroCalcado || '',
      numeroCalcadoNome: materialAtualizado.numeroCalcadoNome || '',
      numeroVestimenta: materialAtualizado.numeroVestimenta || '',
      numeroVestimentaNome: materialAtualizado.numeroVestimentaNome || '',
      numeroEspecifico: materialAtualizado.numeroEspecifico || '',
      
      // Características: lista com IDs do catálogo
      caracteristicaEpi: caracteristicasNormalizadas,
      caracteristicas: caracteristicasNormalizadas,
      caracteristicasIds: caracteristicasNormalizadas.map((item) => item.id).filter(Boolean),
      caracteristicas_epi: caracteristicasNormalizadas.map((item) => item.id).filter(Boolean),
      
      // Cores: lista com IDs do catálogo
      cores: coresNormalizadas,
      coresIds: coresNormalizadas.map((item) => item.id).filter(Boolean),
      corMaterial: coresNormalizadas[0]?.nome || materialAtualizado.corMaterial || '',
    })
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