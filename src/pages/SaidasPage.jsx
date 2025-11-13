import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ExitIcon, EditIcon, HistoryIcon, CancelIcon } from '../components/icons.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { SaidasHistoryModal } from '../components/Saidas/SaidasHistoryModal.jsx'
import '../styles/MateriaisPage.css'

const initialForm = {
  pessoaId: '',
  materialId: '',
  quantidade: '',
  centroCusto: '',
  centroCustoId: '',
  centroServico: '',
  centroServicoId: '',
  dataEntrega: '',
}

const filterInitial = {
  termo: '',
  registradoPor: '',
  centroCusto: '',
  centroServico: '',
  status: '',
  dataInicio: '',
  dataFim: '',
}

const HISTORY_INITIAL = {
  open: false,
  saida: null,
  registros: [],
  isLoading: false,
  error: null,
}

const CANCEL_INITIAL = {
  open: false,
  saida: null,
  motivo: '',
  isSubmitting: false,
  error: null,
}

const MATERIAL_SEARCH_MIN_CHARS = 2
const MATERIAL_SEARCH_MAX_RESULTS = 10
const MATERIAL_SEARCH_DEBOUNCE_MS = 250
const PESSOA_SEARCH_MIN_CHARS = 2
const PESSOA_SEARCH_MAX_RESULTS = 10
const PESSOA_SEARCH_DEBOUNCE_MS = 250

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

const normalizeSearchValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const materialMatchesTerm = (material, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    material?.nome,
    material?.nomeItemRelacionado,
    material?.materialItemNome,
    material?.grupoMaterial,
    material?.grupoMaterialNome,
    material?.numeroCalcado,
    material?.numeroVestimenta,
    material?.numeroEspecifico,
    material?.fabricante,
    material?.fabricanteNome,
    material?.corMaterial,
    material?.coresTexto,
    material?.ca,
    material?.id,
  ]
  return campos
    .map((campo) => normalizeSearchValue(campo))
    .some((campo) => campo.includes(termoNormalizado))
}

const formatMaterialSummary = (material) => {
  if (!material) {
    return ''
  }
  const nome =
    [material.materialItemNome, material.nome, material.nomeId, material.id].find(
      (valor) => valor && !isLikelyUuid(valor),
    ) || ''
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ''
  const detalheCandidates = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes[0] : '',
  ]
  const detalhe = detalheCandidates.find(
    (valor) => valor && !isLikelyUuid(valor),
  ) || ''
  const corDescricao =
    material.coresTexto ||
    material.corMaterial ||
    (Array.isArray(material.coresNomes) ? material.coresNomes.join(', ') : '')
  const caracteristicaDescricao =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes)
      ? material.caracteristicasNomes.join(', ')
      : '')
  const fabricante =
    material.fabricanteNome ||
    (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : '') ||
    ''
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set()
  const partes = resumo.filter((parte) => {
    const texto = (parte || '').toString().trim()
    if (!texto) {
      return false
    }
    const chave = texto.toLowerCase()
    if (vistos.has(chave)) {
      return false
    }
    vistos.add(chave)
    return true
  })
  return partes.join(' | ')
}

const formatPessoaSummary = (pessoa) => {
  if (!pessoa) {
    return ''
  }
  const nome = (pessoa.nome || '').trim()
  const matricula = (pessoa.matricula || '').trim()
  const cargo = (pessoa.cargo || '').trim()
  if (nome && matricula) {
    return cargo ? `${nome} (${matricula}) - ${cargo}` : `${nome} (${matricula})`
  }
  return nome || matricula
}

const formatPessoaDetail = (pessoa) => {
  if (!pessoa) {
    return ''
  }
  return pessoa.cargo ? pessoa.cargo : ''
}

const pessoaMatchesTerm = (pessoa, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    pessoa?.nome,
    pessoa?.matricula,
    pessoa?.centroServico,
    pessoa?.local,
    pessoa?.setor,
    pessoa?.cargo,
  ]
  return campos
    .map((campo) => normalizeSearchValue(campo))
    .some((campo) => campo.includes(termoNormalizado))
}

const buildSaidasQuery = (filters) => {
  const query = {}
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
  }
  const centroServico = filters.centroServico?.trim()
  if (centroServico) {
    query.centroServico = centroServico
  }
  const registradoPor = filters.registradoPor?.trim()
  if (registradoPor) {
    query.registradoPor = registradoPor
  }
  const status = filters.status?.trim()
  if (status) {
    query.status = status
  }
  if (filters.dataInicio) {
    query.dataInicio = filters.dataInicio
  }
  if (filters.dataFim) {
    query.dataFim = filters.dataFim
  }
  const termo = filters.termo?.trim()
  if (termo) {
    query.termo = termo
  }
  return query
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

const formatDisplayDateTime = (value) => {
  if (!value) {
    return 'Nao informado'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado'
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone,
  })
}

const formatDisplayDate = (value) => {
  if (!value) {
    return 'Nao informado'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado'
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return date.toLocaleDateString('pt-BR', { timeZone })
}

const formatDateToInput = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

export function SaidasPage() {
  const { user } = useAuth()
  const [Nomes, setNomes] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [centrosCustoOptions, setCentrosCustoOptions] = useState([])
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState(filterInitial)
  const [editingSaida, setEditingSaida] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [historyState, setHistoryState] = useState(HISTORY_INITIAL)
  const [cancelState, setCancelState] = useState(CANCEL_INITIAL)
  const [materialSearchValue, setMaterialSearchValue] = useState('')
  const [materialEstoque, setMaterialEstoque] = useState(null)
  const [materialEstoqueLoading, setMaterialEstoqueLoading] = useState(false)
  const [materialEstoqueError, setMaterialEstoqueError] = useState(null)
  const [materialSuggestions, setMaterialSuggestions] = useState([])
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false)
  const [materialSearchError, setMaterialSearchError] = useState(null)
  const materialSearchTimeoutRef = useRef(null)
  const materialBlurTimeoutRef = useRef(null)
  const [pessoaSearchValue, setPessoaSearchValue] = useState('')
  const [pessoaSuggestions, setPessoaSuggestions] = useState([])
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const [isSearchingPessoas, setIsSearchingPessoas] = useState(false)
  const [pessoaSearchError, setPessoaSearchError] = useState(null)
  const pessoaSearchTimeoutRef = useRef(null)
  const pessoaBlurTimeoutRef = useRef(null)

  const isSaidaCancelada = useCallback((saida) => {
    const texto = (saida?.status || '').toString().trim().toLowerCase()
    return texto === 'cancelado'
  }, [])

  const load = async (params = filters, { resetPage = false } = {}) => {
    if (resetPage) {
      setCurrentPage(1)
    }
    setIsLoading(true)
    setError(null)
    try {
      const materiaisPromise =
        api?.entradas?.materialOptions && typeof api.entradas.materialOptions === 'function'
          ? api.entradas.materialOptions()
          : api.materiais.list()
      const shouldLoadCentrosCusto =
        centrosCustoOptions.length === 0 && api?.centrosCusto && typeof api.centrosCusto.list === 'function'
      const shouldLoadCentrosServico =
        centrosServicoOptions.length === 0 && api?.centrosServico && typeof api.centrosServico.list === 'function'
      const [NomesData, materiaisData, saidasData, centrosCustoData, centrosServicoData] = await Promise.all([
        api.pessoas.list(),
        materiaisPromise,
        api.saidas.list(buildSaidasQuery(params)),
        shouldLoadCentrosCusto ? api.centrosCusto.list() : Promise.resolve(null),
        shouldLoadCentrosServico ? api.centrosServico.list() : Promise.resolve(null),
      ])
      setNomes(NomesData ?? [])
      setMateriais(materiaisData ?? [])
      setSaidas(saidasData ?? [])
      if (centrosCustoData) {
        setCentrosCustoOptions(centrosCustoData ?? [])
      }
      if (centrosServicoData) {
        setCentrosServicoOptions(centrosServicoData ?? [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(filterInitial, { resetPage: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetFormState = useCallback(() => {
    setForm({ ...initialForm })
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
    setMaterialEstoqueLoading(false)
  }, [])

  const cancelEditSaida = useCallback(() => {
    setEditingSaida(null)
    resetFormState()
    setError(null)
  }, [resetFormState])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.pessoaId) {
      setError('Selecione um colaborador valido.')
      return
    }
    if (!form.materialId) {
      setError('Selecione um material valido.')
      return
    }
    if (!form.dataEntrega) {
      setError('Informe a data de entrega.')
      return
    }
    const isEditMode = Boolean(editingSaida)
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: Number(form.quantidade),
        centroCusto: form.centroCusto.trim(),
        centroCustoId: form.centroCustoId,
        centroServico: form.centroServico.trim(),
        centroServicoId: form.centroServicoId,
        dataEntrega: form.dataEntrega,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      if (isEditMode) {
        await api.saidas.update(editingSaida.id, payload)
      } else {
        await api.saidas.create(payload)
      }
      setEditingSaida(null)
      resetFormState()
      await load(filters, { resetPage: !isEditMode })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    load(filters, { resetPage: true })
  }

  const handleFilterClear = () => {
    setFilters({ ...filterInitial })
    load(filterInitial, { resetPage: true })
  }

  const openHistorySaida = useCallback(async (saida) => {
    if (!saida?.id) {
      return
    }
    setHistoryState({
      ...HISTORY_INITIAL,
      open: true,
      saida,
      isLoading: true,
    })
    try {
      const registros = await api.saidas.history(saida.id)
      setHistoryState({
        open: true,
        saida,
        registros: registros ?? [],
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setHistoryState({
        open: true,
        saida,
        registros: [],
        isLoading: false,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }, [])

  const closeHistorySaida = useCallback(() => {
    setHistoryState({ ...HISTORY_INITIAL })
  }, [])

  const openCancelSaida = useCallback(
    (saida) => {
      if (!saida || isSaidaCancelada(saida)) {
        return
      }
      setCancelState({
        ...CANCEL_INITIAL,
        open: true,
        saida,
      })
    },
    [isSaidaCancelada]
  )

  const closeCancelSaida = useCallback(() => {
    setCancelState({ ...CANCEL_INITIAL })
  }, [])

  const handleCancelMotivoChange = (event) => {
    const { value } = event.target
    setCancelState((prev) => ({ ...prev, motivo: value }))
  }

  const confirmCancelSaida = useCallback(async () => {
    if (!cancelState.saida?.id) {
      return
    }
    const motivoTrimmed = cancelState.motivo.trim()
    if (!motivoTrimmed) {
      setCancelState((prev) => ({
        ...prev,
        error: 'Informe o motivo do cancelamento.',
      }))
      return
    }
    setCancelState((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      await api.saidas.cancel(cancelState.saida.id, { motivo: motivoTrimmed })
      setCancelState({ ...CANCEL_INITIAL })
      setEditingSaida(null)
      resetFormState()
      await load(filters, { resetPage: false })
    } catch (err) {
      setCancelState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Falha ao cancelar saida.',
      }))
    }
  }, [cancelState.saida, cancelState.motivo, filters, load, resetFormState])

  const handleMaterialInputChange = (event) => {
    const { value } = event.target
    if (materialBlurTimeoutRef.current) {
      clearTimeout(materialBlurTimeoutRef.current)
      materialBlurTimeoutRef.current = null
    }
    setMaterialSearchValue(value)
    setForm((prev) => ({ ...prev, materialId: '' }))
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
    if (value.trim().length >= MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialDropdownOpen(true)
    } else {
      setMaterialDropdownOpen(false)
      setMaterialSuggestions([])
      setMaterialSearchError(null)
    }
  }

  const handleMaterialSelect = (material) => {
    if (!material) {
      return
    }
    setForm((prev) => ({ ...prev, materialId: material.id }))
    setMaterialSearchValue(formatMaterialSummary(material))
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
  }

  const handleMaterialFocus = () => {
    if (materialBlurTimeoutRef.current) {
      clearTimeout(materialBlurTimeoutRef.current)
      materialBlurTimeoutRef.current = null
    }
    if (!form.materialId && materialSearchValue.trim().length >= MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialDropdownOpen(true)
    }
  }

  const handleMaterialBlur = () => {
    materialBlurTimeoutRef.current = setTimeout(() => {
      setMaterialDropdownOpen(false)
    }, 120)
  }

  const handleMaterialClear = () => {
    setForm((prev) => ({ ...prev, materialId: '' }))
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
    setMaterialEstoqueLoading(false)
  }

  const handlePessoaInputChange = (event) => {
    const { value } = event.target
    if (pessoaBlurTimeoutRef.current) {
      clearTimeout(pessoaBlurTimeoutRef.current)
      pessoaBlurTimeoutRef.current = null
    }
    setPessoaSearchValue(value)
    setForm((prev) => ({ ...prev, pessoaId: '' }))
    setPessoaSearchError(null)
    if (value.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    } else {
      setPessoaDropdownOpen(false)
      setPessoaSuggestions([])
      setPessoaSearchError(null)
    }
  }

  const handlePessoaSelect = (pessoa) => {
    if (!pessoa) {
      return
    }
    const centroServicoNome = pessoa.centroServico ?? pessoa.setor ?? pessoa.local ?? ''
    const centroCustoNome = pessoa.centroCusto ?? ''
    setForm((prev) => ({
      ...prev,
      pessoaId: pessoa.id,
      centroServico: centroServicoNome,
      centroServicoId: pessoa.centroServicoId ?? '',
      centroCusto: centroCustoNome,
      centroCustoId: pessoa.centroCustoId ?? '',
    }))
    setPessoaSearchValue(formatPessoaSummary(pessoa))
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }

  const handlePessoaFocus = () => {
    if (pessoaBlurTimeoutRef.current) {
      clearTimeout(pessoaBlurTimeoutRef.current)
      pessoaBlurTimeoutRef.current = null
    }
    if (!form.pessoaId && pessoaSearchValue.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    }
  }

  const handlePessoaBlur = () => {
    pessoaBlurTimeoutRef.current = setTimeout(() => {
      setPessoaDropdownOpen(false)
    }, 120)
  }

  const handlePessoaClear = () => {
    setForm((prev) => ({
      ...prev,
      pessoaId: '',
      centroCusto: '',
      centroCustoId: '',
      centroServico: '',
      centroServicoId: '',
    }))
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }

  const NomesMap = useMemo(() => {
    const map = new Map()
    Nomes.forEach((item) => map.set(item.id, item))
    return map
  }, [Nomes])

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => map.set(item.id, { ...item, valorUnitario: Number(item.valorUnitario ?? 0) }))
    return map
  }, [materiais])

  const startEditSaida = useCallback(
    (saida) => {
      if (!saida) {
        return
      }
      if (isSaidaCancelada(saida)) {
        setError('Saídas canceladas não podem ser editadas.')
        return
      }
      const pessoa = NomesMap.get(saida.pessoaId)
      const material = materiaisMap.get(saida.materialId)
      setEditingSaida(saida)
      setForm({
        pessoaId: saida.pessoaId || '',
        materialId: saida.materialId || '',
        quantidade:
          saida.quantidade !== undefined && saida.quantidade !== null ? String(saida.quantidade) : '',
        centroCusto: saida.centroCusto || '',
        centroCustoId: saida.centroCustoId || '',
        centroServico: saida.centroServico || '',
        centroServicoId: saida.centroServicoId || '',
        dataEntrega: formatDateToInput(saida.dataEntrega),
      })
      setPessoaSearchValue(formatPessoaSummary(pessoa) || saida.pessoaId || '')
      setPessoaSuggestions([])
      setPessoaDropdownOpen(false)
      setPessoaSearchError(null)
      setMaterialSearchValue(material ? formatMaterialSummary(material) : saida.materialId || '')
      setMaterialSuggestions([])
      setMaterialDropdownOpen(false)
      setMaterialSearchError(null)
      setError(null)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [NomesMap, materiaisMap, isSaidaCancelada]
  )

  const statusOptions = useMemo(() => {
    const mapa = new Map()
    saidas.forEach((item) => {
      if (!item) {
        return
      }
      const id = item.statusId || (isLikelyUuid(item.status) ? item.status : null)
      const nome = item.statusNome || item.status || ''
      if (!id || !nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas])

  const statusLabelMap = useMemo(() => {
    const map = new Map()
    statusOptions.forEach((item) => {
      map.set(item.id, item.nome)
    })
    return map
  }, [statusOptions])

  const renderStatusChip = useCallback(
    (saida) => {
      const rawStatus = saida?.status || ''
      const texto =
        saida?.statusNome ||
        statusLabelMap.get(saida?.statusId) ||
        statusLabelMap.get(rawStatus) ||
        (isLikelyUuid(rawStatus) ? 'Status indefinido' : rawStatus) ||
        '-'
      const cancelada = isSaidaCancelada(saida)
      const className = cancelada ? 'status-chip status-chip--cancelado' : 'status-chip'
      return <span className={className}>{texto || '-'}</span>
    },
    [isSaidaCancelada, statusLabelMap]
  )

  const registradoOptions = useMemo(() => {
    const mapa = new Map()
    saidas.forEach((saida) => {
      const nome = saida.usuarioResponsavelNome || saida.usuarioResponsavel || 'Nao informado'
      const id = saida.usuarioResponsavelId || nome
      if (!nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas])

  const centrosCustoMap = useMemo(() => {
    const map = new Map()
    centrosCustoOptions.forEach((item) => {
      const nome = (item?.nome ?? '').toString().trim()
      if (!nome) {
        return
      }
      if (item.id) {
        map.set(item.id, nome)
      }
      map.set(nome, nome)
      map.set(normalizeSearchValue(nome), nome)
    })
    return map
  }, [centrosCustoOptions])

  const centrosServicoMap = useMemo(() => {
    const map = new Map()
    centrosServicoOptions.forEach((item) => {
      const nome = (item?.nome ?? '').toString().trim()
      if (!nome) {
        return
      }
      if (item.id) {
        map.set(item.id, nome)
      }
      map.set(nome, nome)
      map.set(normalizeSearchValue(nome), nome)
    })
    return map
  }, [centrosServicoOptions])

  const resolveCentroCustoLabel = useCallback(
    (saida) => {
      if (!saida) {
        return ''
      }
      const candidatos = [saida.centroCustoId, saida.centroCusto]
      for (const raw of candidatos) {
        if (!raw) {
          continue
        }
        const texto = raw.toString().trim()
        if (!texto) {
          continue
        }
        const label =
          centrosCustoMap.get(raw) ||
          centrosCustoMap.get(texto) ||
          centrosCustoMap.get(normalizeSearchValue(texto))
        if (label) {
          return label
        }
        if (!isLikelyUuid(texto)) {
          return texto
        }
      }
      return saida.centroCusto || ''
    },
    [centrosCustoMap]
  )

  const resolveCentroServicoLabel = useCallback(
    (saida) => {
      if (!saida) {
        return ''
      }
      const candidatos = [saida.centroServicoId, saida.centroServico]
      for (const raw of candidatos) {
        if (!raw) {
          continue
        }
        const texto = raw.toString().trim()
        if (!texto) {
          continue
        }
        const label =
          centrosServicoMap.get(raw) ||
          centrosServicoMap.get(texto) ||
          centrosServicoMap.get(normalizeSearchValue(texto))
        if (label) {
          return label
        }
        if (!isLikelyUuid(texto)) {
          return texto
        }
      }
      return saida.centroServico || ''
    },
    [centrosServicoMap]
  )

  const centroCustoFilterOptions = useMemo(() => {
    const mapa = new Map()
    ;(saidas ?? []).forEach((saida) => {
      if (!saida) {
        return
      }
      const id = saida.centroCustoId || saida.centroCusto
      const nome = resolveCentroCustoLabel(saida)
      if (!id || !nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas, resolveCentroCustoLabel])

  const centroServicoFilterOptions = useMemo(() => {
    const mapa = new Map()
    ;(saidas ?? []).forEach((saida) => {
      if (!saida) {
        return
      }
      const id = saida.centroServicoId || saida.centroServico
      const nome = resolveCentroServicoLabel(saida)
      if (!id || !nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas, resolveCentroServicoLabel])

  const fallbackPessoaSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      return Nomes.filter((pessoa) => pessoaMatchesTerm(pessoa, normalized)).slice(
        0,
        PESSOA_SEARCH_MAX_RESULTS,
      )
    },
    [Nomes],
  )

  const fallbackMaterialSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      const partes = normalized.split('|').map((parte) => parte.trim()).filter(Boolean)
      return materiais
        .filter((material) => {
          if (!partes.length) {
            return materialMatchesTerm(material, normalized)
          }
          const textoResumo = normalizeSearchValue(formatMaterialSummary(material))
          return partes.every((parte) => textoResumo.includes(parte))
        })
        .slice(0, MATERIAL_SEARCH_MAX_RESULTS)
    },
    [materiais],
  )

  useEffect(() => {
    if (!form.pessoaId) {
      return
    }
    const selecionada = NomesMap.get(form.pessoaId)
    if (selecionada) {
      setPessoaSearchValue(formatPessoaSummary(selecionada))
      setForm((prev) => ({
        ...prev,
        centroServico:
          selecionada.centroServico ??
          selecionada.setor ??
          selecionada.local ??
          prev.centroServico ??
          '',
        centroServicoId: selecionada.centroServicoId ?? prev.centroServicoId ?? '',
        centroCusto: selecionada.centroCusto ?? prev.centroCusto ?? '',
        centroCustoId: selecionada.centroCustoId ?? prev.centroCustoId ?? '',
      }))
    }
  }, [form.pessoaId, NomesMap])

  useEffect(() => {
    if (!form.materialId) {
      return
    }
    const selecionado = materiaisMap.get(form.materialId)
    if (selecionado) {
      setMaterialSearchValue(formatMaterialSummary(selecionado))
    }
  }, [form.materialId, materiaisMap])

  useEffect(() => {
    if (!form.materialId) {
      setMaterialEstoque(null)
      setMaterialEstoqueError(null)
      setMaterialEstoqueLoading(false)
      return
    }
    let cancelled = false
    setMaterialEstoqueLoading(true)
    setMaterialEstoqueError(null)
    ;(async () => {
      try {
        if (api?.estoque?.saldo) {
          const resultado = await api.estoque.saldo(form.materialId)
          if (!cancelled) {
            setMaterialEstoque(Number(resultado?.saldo ?? 0))
          }
        } else {
          setMaterialEstoque(null)
        }
      } catch (err) {
        if (!cancelled) {
          setMaterialEstoqueError(err.message || 'Falha ao consultar estoque.')
          setMaterialEstoque(null)
        }
      } finally {
        if (!cancelled) {
          setMaterialEstoqueLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form.materialId, api])

  useEffect(() => {
    if (pessoaSearchTimeoutRef.current) {
      clearTimeout(pessoaSearchTimeoutRef.current)
      pessoaSearchTimeoutRef.current = null
    }
    const termo = pessoaSearchValue.trim()
    if (form.pessoaId || termo.length < PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSuggestions([])
      setIsSearchingPessoas(false)
      setPessoaSearchError(null)
      setPessoaDropdownOpen(false)
      return
    }
    let cancelled = false
    setIsSearchingPessoas(true)
    pessoaSearchTimeoutRef.current = setTimeout(async () => {
      setPessoaSearchError(null)
      try {
        let resultados = []
        if (api?.pessoas?.search) {
          resultados = await api.pessoas.search({
            termo,
            limit: PESSOA_SEARCH_MAX_RESULTS,
          })
        } else if (api?.pessoas?.list) {
          resultados = await api.pessoas.list({ termo })
        } else {
          resultados = fallbackPessoaSearch(termo)
        }
        if (!Array.isArray(resultados)) {
          resultados = []
        }
        if (!cancelled) {
          setPessoaSuggestions((resultados ?? []).slice(0, PESSOA_SEARCH_MAX_RESULTS))
          setPessoaDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setPessoaSearchError(err.message || 'Falha ao buscar pessoas.')
          setPessoaSuggestions([])
          setPessoaDropdownOpen(true)
        }
      } finally {
        if (!cancelled) {
          setIsSearchingPessoas(false)
        }
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (pessoaSearchTimeoutRef.current) {
        clearTimeout(pessoaSearchTimeoutRef.current)
        pessoaSearchTimeoutRef.current = null
      }
    }
  }, [pessoaSearchValue, form.pessoaId, fallbackPessoaSearch])

  useEffect(() => {
    if (materialSearchTimeoutRef.current) {
      clearTimeout(materialSearchTimeoutRef.current)
      materialSearchTimeoutRef.current = null
    }
    const termo = materialSearchValue.trim()
    if (form.materialId || termo.length < MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialSuggestions([])
      setIsSearchingMaterials(false)
      setMaterialSearchError(null)
      setMaterialDropdownOpen(false)
      return
    }
    let cancelled = false
    setIsSearchingMaterials(true)
    materialSearchTimeoutRef.current = setTimeout(async () => {
      setMaterialSearchError(null)
      try {
        let resultados = []
        if (api?.entradas?.searchMateriais) {
          resultados = await api.entradas.searchMateriais({
            termo,
            limit: MATERIAL_SEARCH_MAX_RESULTS,
          })
        } else if (api?.materiais?.search) {
          resultados = await api.materiais.search({
            termo,
            limit: MATERIAL_SEARCH_MAX_RESULTS,
          })
        } else {
          resultados = fallbackMaterialSearch(termo)
        }
        if (!Array.isArray(resultados)) {
          resultados = []
        }
        if (
          resultados.length < MATERIAL_SEARCH_MAX_RESULTS &&
          typeof fallbackMaterialSearch === 'function'
        ) {
          const fallbackResultados = fallbackMaterialSearch(termo) ?? []
          if (fallbackResultados.length) {
            const vistos = new Set(
              resultados.map((item) => (item?.id ? String(item.id) : formatMaterialSummary(item))),
            )
            fallbackResultados.some((material) => {
              const chave = material?.id ? String(material.id) : formatMaterialSummary(material)
              if (!vistos.has(chave)) {
                resultados.push(material)
                vistos.add(chave)
              }
              return resultados.length >= MATERIAL_SEARCH_MAX_RESULTS
            })
          }
        }
        if (!cancelled) {
          setMaterialSuggestions(resultados.slice(0, MATERIAL_SEARCH_MAX_RESULTS))
          setMaterialDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setMaterialSearchError(err.message || 'Falha ao buscar materiais.')
          setMaterialSuggestions([])
          setMaterialDropdownOpen(true)
        }
      } finally {
        if (!cancelled) {
          setIsSearchingMaterials(false)
        }
      }
    }, MATERIAL_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (materialSearchTimeoutRef.current) {
        clearTimeout(materialSearchTimeoutRef.current)
        materialSearchTimeoutRef.current = null
      }
    }
  }, [materialSearchValue, form.materialId, fallbackMaterialSearch])

  useEffect(() => {
    return () => {
      if (materialBlurTimeoutRef.current) {
        clearTimeout(materialBlurTimeoutRef.current)
      }
      if (pessoaBlurTimeoutRef.current) {
        clearTimeout(pessoaBlurTimeoutRef.current)
      }
    }
  }, [])

  const selectedPessoa = form.pessoaId ? NomesMap.get(form.pessoaId) : null
  const selectedCentroCustoLabel =
    selectedPessoa?.centroCusto ||
    (form.centroCustoId ? centrosCustoMap.get(form.centroCustoId) : '') ||
    form.centroCusto ||
    ''
  const selectedCentroServicoLabel =
    selectedPessoa?.centroServico ||
    (form.centroServicoId ? centrosServicoMap.get(form.centroServicoId) : '') ||
    form.centroServico ||
    ''

  const normalizedSearchTerm = normalizeSearchValue(filters.termo)
  const startTimestamp = filters.dataInicio ? Date.parse(`${filters.dataInicio}T00:00:00Z`) : null
  const endTimestamp = filters.dataFim ? Date.parse(`${filters.dataFim}T23:59:59Z`) : null

  const filteredSaidas = useMemo(() => {
    return saidas.filter((saida) => {
      const dataEntrega = saida.dataEntrega ? Date.parse(saida.dataEntrega) : null
      if (startTimestamp && (dataEntrega === null || dataEntrega < startTimestamp)) {
        return false
      }
      if (endTimestamp && (dataEntrega === null || dataEntrega > endTimestamp)) {
        return false
      }
      if (filters.status) {
        const candidatos = [
          saida.statusId,
          saida.status,
          normalizeSearchValue(saida.status),
        ]
          .map((valor) => (valor ? String(valor).trim() : ''))
          .filter(Boolean)
        const alvoNormalizado = normalizeSearchValue(filters.status)
        const inclui =
          candidatos.includes(filters.status) ||
          candidatos.includes(alvoNormalizado)
        if (!inclui) {
          return false
        }
      }
      if (filters.registradoPor) {
        const candidatos = [
          saida.usuarioResponsavelId,
          saida.usuarioResponsavel,
          saida.usuarioResponsavelNome,
        ]
          .map((valor) => (valor ? String(valor).trim() : ''))
        if (!candidatos.includes(filters.registradoPor)) {
          return false
        }
      }
      if (filters.centroCusto) {
        const saidaLabel = resolveCentroCustoLabel(saida)
        const normalizedFilter = normalizeSearchValue(filters.centroCusto)
        const filterLabel =
          centrosCustoMap.get(filters.centroCusto) ||
          centrosCustoMap.get(normalizedFilter) ||
          (!isLikelyUuid(filters.centroCusto) ? filters.centroCusto : '')
        const matchesById = Boolean(saida.centroCustoId) && saida.centroCustoId === filters.centroCusto
        const matchesByLabel =
          Boolean(filterLabel) &&
          normalizeSearchValue(saidaLabel || saida.centroCusto || '') === normalizeSearchValue(filterLabel)
        if (!matchesById && !matchesByLabel) {
          return false
        }
      }
      if (filters.centroServico) {
        const saidaLabel = resolveCentroServicoLabel(saida)
        const normalizedFilter = normalizeSearchValue(filters.centroServico)
        const filterLabel =
          centrosServicoMap.get(filters.centroServico) ||
          centrosServicoMap.get(normalizedFilter) ||
          (!isLikelyUuid(filters.centroServico) ? filters.centroServico : '')
        const matchesById = Boolean(saida.centroServicoId) && saida.centroServicoId === filters.centroServico
        const matchesByLabel =
          Boolean(filterLabel) &&
          normalizeSearchValue(saidaLabel || saida.centroServico || '') === normalizeSearchValue(filterLabel)
        if (!matchesById && !matchesByLabel) {
          return false
        }
      }
      if (normalizedSearchTerm) {
        const pessoa = NomesMap.get(saida.pessoaId)
        const material = materiaisMap.get(saida.materialId)
        const campos = [
          material ? formatMaterialSummary(material) : '',
          pessoa?.nome,
          pessoa?.matricula,
          pessoa?.cargo,
        ]
        const inclui = campos
          .map((campo) => normalizeSearchValue(campo))
          .some((campo) => campo.includes(normalizedSearchTerm))
        if (!inclui) {
          return false
        }
      }
      return true
    })
  }, [
    saidas,
    filters.status,
    filters.registradoPor,
    filters.centroCusto,
    filters.centroServico,
    normalizedSearchTerm,
    startTimestamp,
    endTimestamp,
    NomesMap,
    materiaisMap,
    resolveCentroCustoLabel,
    resolveCentroServicoLabel,
    centrosCustoMap,
    centrosServicoMap,
  ])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSaidas.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [filteredSaidas.length])

  const paginatedSaidas = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return filteredSaidas.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [filteredSaidas, currentPage])

  const shouldShowPessoaDropdown =
    pessoaDropdownOpen &&
    !form.pessoaId &&
    (isSearchingPessoas || pessoaSearchError || pessoaSuggestions.length > 0)

  const shouldShowMaterialDropdown =
    materialDropdownOpen &&
    !form.materialId &&
    (isSearchingMaterials || materialSearchError || materialSuggestions.length > 0)

  const isEditing = Boolean(editingSaida)
  const canConfirmCancel = cancelState.motivo.trim().length > 0 && !cancelState.isSubmitting

  return (
    <div className="stack">
      <PageHeader
        icon={<ExitIcon size={28} />}
        title="Saidas"
        subtitle="Controle entregas de EPIs garantindo disponibilidade e rastreabilidade."
      />

      <form className="form" onSubmit={handleSubmit}>
        {isEditing ? (
          <div className="form__notice">
            <span>Editando saída #{editingSaida?.id?.slice(0, 8) || ''}</span>
            <button
              type="button"
              className="button button--ghost"
              onClick={cancelEditSaida}
              disabled={isSaving}
            >
              Cancelar edição
            </button>
          </div>
        ) : null}
        <div className="form__grid form__grid--two">
          <label className="field field--autocomplete">
            <span>Nome*</span>
            <div className="autocomplete">
              <input
                type="text"
                className="autocomplete__input"
                value={pessoaSearchValue}
                onChange={handlePessoaInputChange}
                onFocus={handlePessoaFocus}
                onBlur={handlePessoaBlur}
                placeholder="Busque por nome ou matricula"
                aria-autocomplete="list"
                aria-expanded={shouldShowPessoaDropdown}
                autoComplete="off"
                spellCheck="false"
              />
              <input type="hidden" name="pessoaId" value={form.pessoaId} readOnly />
              {form.pessoaId ? (
                <button
                  type="button"
                  className="autocomplete__clear"
                  onClick={handlePessoaClear}
                  aria-label="Limpar pessoa selecionada"
                >
                  x
                </button>
              ) : null}
              {shouldShowPessoaDropdown ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingPessoas ? (
                    <p className="autocomplete__feedback">Buscando pessoas...</p>
                  ) : null}
                  {!isSearchingPessoas && pessoaSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{pessoaSearchError}</p>
                  ) : null}
                  {!isSearchingPessoas && !pessoaSearchError && pessoaSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhuma pessoa encontrada.</p>
                  ) : null}
                  {pessoaSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handlePessoaSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatPessoaSummary(item)}</span>
                      <span className="autocomplete__secondary">
                        {formatPessoaDetail(item)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field field--autocomplete">
            <span>Material*</span>
            <div className="autocomplete">
              <input
                type="text"
                className="autocomplete__input"
                value={materialSearchValue}
                onChange={handleMaterialInputChange}
                onFocus={handleMaterialFocus}
                onBlur={handleMaterialBlur}
                placeholder="Busque por nome, grupo ou fabricante"
                aria-autocomplete="list"
                aria-expanded={shouldShowMaterialDropdown}
                autoComplete="off"
                spellCheck="false"
              />
              <input type="hidden" name="materialId" value={form.materialId} readOnly />
              {form.materialId ? (
                <button
                  type="button"
                  className="autocomplete__clear"
                  onClick={handleMaterialClear}
                  aria-label="Limpar material selecionado"
                >
                  x
                </button>
              ) : null}
              {shouldShowMaterialDropdown ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingMaterials ? (
                    <p className="autocomplete__feedback">Buscando materiais...</p>
                  ) : null}
                  {!isSearchingMaterials && materialSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{materialSearchError}</p>
                  ) : null}
                  {!isSearchingMaterials && !materialSearchError && materialSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhum material encontrado.</p>
                  ) : null}
                  {materialSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleMaterialSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatMaterialSummary(item)}</span>
                      <span className="autocomplete__secondary">ID: {item.nomeId || item.id}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field">
            <span>Em estoque</span>
            <input
              type="text"
              value={
                materialEstoqueLoading
                  ? 'Calculando...'
                  : materialEstoqueError
                    ? 'Erro ao consultar'
                    : materialEstoque !== null && materialEstoque !== undefined
                      ? String(materialEstoque)
                      : '-'
              }
              readOnly
            />
            {materialEstoqueError ? (
              <small className="field__hint field__hint--error">{materialEstoqueError}</small>
            ) : null}
          </label>
          <label className="field">
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
        <label className="field">
          <span>Centro de custo*</span>
          <>
            <input
              name="centroCusto"
              value={selectedCentroCustoLabel}
              readOnly
              placeholder="Selecionado automaticamente"
            />
            <input type="hidden" name="centroCustoId" value={form.centroCustoId} />
          </>
        </label>
        <label className="field">
          <span>Centro de servico*</span>
          <>
            <input
              name="centroServico"
              value={selectedCentroServicoLabel}
              readOnly
              placeholder="Selecionado automaticamente"
            />
            <input type="hidden" name="centroServicoId" value={form.centroServicoId} />
          </>
        </label>
        <label className="field">
          <span>Data de entrega*</span>
          <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} required />
        </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? (isEditing ? 'Salvando...' : 'Registrando...') : isEditing ? 'Salvar alterações' : 'Registrar saida'}
          </button>
        </div>
      </form>

      <form className="form form--inline" onSubmit={handleFilterSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleFilterChange}
            placeholder="Pessoa, material ou responsável"
          />
        </label>
        <label className="field">
          <span>Registrado por</span>
          <select name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {registradoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Centro de custo</span>
          <select name="centroCusto" value={filters.centroCusto} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {centroCustoFilterOptions.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Centro de serviço</span>
          <select name="centroServico" value={filters.centroServico} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {centroServicoFilterOptions.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Data inicial</span>
          <input type="date" name="dataInicio" value={filters.dataInicio} onChange={handleFilterChange} />
        </label>
        <label className="field">
          <span>Data final</span>
          <input type="date" name="dataFim" value={filters.dataFim} onChange={handleFilterChange} />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--ghost">Aplicar</button>
          <button type="button" className="button button--ghost" onClick={handleFilterClear}>Limpar</button>
        </div>
      </form>

      <section className="card">
        <header className="card__header">
          <h2>Historico de saidas</h2>
          <button type="button" className="button button--ghost" onClick={() => load(filters)} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && filteredSaidas.length === 0 ? (
          <p className="feedback">Nenhuma saida registrada.</p>
        ) : null}
        {filteredSaidas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Nome</th>
                  <th>Quantidade</th>
                  <th>Centro de custo</th>
                  <th>Centro de servico</th>
                  <th>Status</th>
                  <th>Data entrega</th>
                  <th>Data troca</th>
                  <th>Valor total</th>
                  <th>Registrado por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSaidas.map((saida) => {
                  const Nome = NomesMap.get(saida.pessoaId)
                  const material = materiaisMap.get(saida.materialId)
                  const total = (material?.valorUnitario ?? 0) * Number(saida.quantidade ?? 0)
                  const centroCustoLabel = resolveCentroCustoLabel(saida) || '-'
                  const centroServicoLabel = resolveCentroServicoLabel(saida) || '-'
                  const materialResumo = material ? formatMaterialSummary(material) : 'Material removido'
                  const materialIdLabel = material?.id || saida.materialId || 'Nao informado'
                  const pessoaCargo = Nome?.cargo || 'Cargo nao informado'
                  const registradoPor = saida.usuarioResponsavelNome || saida.usuarioResponsavel || 'Nao informado'
                  const rowClass = isSaidaCancelada(saida) ? 'data-table__row data-table__row--cancelado' : ''

                  return (
                    <tr key={saida.id} className={rowClass || undefined}>
                      <td>
                        <strong>{materialResumo}</strong>
                        <p className="data-table__muted">ID: {materialIdLabel}</p>
                      </td>
                      <td>
                        <strong>{Nome?.nome || 'Nome removida'}</strong>
                        <p className="data-table__muted">{pessoaCargo}</p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>{centroCustoLabel}</td>
                      <td>{centroServicoLabel}</td>
                      <td>{renderStatusChip(saida)}</td>
                      <td>{formatDisplayDateTime(saida.dataEntrega)}</td>
                      <td>{saida.dataTroca ? formatDisplayDate(saida.dataTroca) : 'Nao informado'}</td>
                      <td>{formatCurrency(total)}</td>
                      <td>{registradoPor}</td>
                      <td>
                        <div className="table-actions materiais-data-table__actions">
                          <button
                            type="button"
                            className="materiais-table-action-button"
                            onClick={() => startEditSaida(saida)}
                            aria-label={`Editar saída ${saida.id}`}
                            title="Editar saída"
                            disabled={isSaidaCancelada(saida)}
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="materiais-table-action-button"
                            onClick={() => openHistorySaida(saida)}
                            aria-label={`Histórico da saída ${saida.id}`}
                            title="Histórico da saída"
                          >
                            <HistoryIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="materiais-table-action-button materiais-table-action-button--danger"
                            onClick={() => openCancelSaida(saida)}
                            aria-label={`Cancelar saída ${saida.id}`}
                            title="Cancelar saída"
                            disabled={isSaidaCancelada(saida)}
                          >
                            <CancelIcon size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <TablePagination
          totalItems={filteredSaidas.length}
          pageSize={TABLE_PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>
      <SaidasHistoryModal state={historyState} onClose={closeHistorySaida} />
      {cancelState.open ? (
        <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={closeCancelSaida}>
          <div className="entradas-history__modal" onClick={(event) => event.stopPropagation()}>
            <header className="entradas-history__header">
              <div>
                <h3>Cancelar saída</h3>
                <p className="entradas-history__subtitle">{cancelState.saida?.id || ''}</p>
              </div>
              <button
                type="button"
                className="entradas-history__close"
                onClick={closeCancelSaida}
                aria-label="Fechar modal de cancelamento"
              >
                x
              </button>
            </header>
            <div className="entradas-history__body">
              <p>Informe o motivo do cancelamento. A quantidade será devolvida ao estoque.</p>
              <textarea
                className="cancel-modal__textarea"
                value={cancelState.motivo}
                onChange={handleCancelMotivoChange}
                placeholder="Motivo do cancelamento"
                rows={4}
                required
              />
              {cancelState.error ? (
                <p className="feedback feedback--error cancel-modal__feedback">{cancelState.error}</p>
              ) : null}
            </div>
            <div className="cancel-modal__actions">
              <button type="button" className="button button--ghost" onClick={closeCancelSaida} disabled={cancelState.isSubmitting}>
                Voltar
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={confirmCancelSaida}
                disabled={!canConfirmCancel}
              >
                {cancelState.isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}























