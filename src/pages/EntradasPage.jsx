import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { EntryIcon, EditIcon, HistoryIcon } from '../components/icons.jsx'
import { EntradasHistoryModal } from '../components/Entradas/EntradasHistoryModal.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  materialId: '',
  quantidade: '',
  centroCusto: '',
  dataEntrada: '',
}

const filterInitial = {
  termo: '',
  registradoPor: '',
  centroCusto: '',
  dataInicio: '',
  dataFim: '',
}

const MATERIAL_SEARCH_MIN_CHARS = 2
const MATERIAL_SEARCH_MAX_RESULTS = 10
const MATERIAL_SEARCH_DEBOUNCE_MS = 250

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

const formatDisplayDate = (value) => {
  if (!value) {
    return 'Nao informado'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado'
  }
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const HISTORY_INITIAL = {
  open: false,
  entrada: null,
  registros: [],
  isLoading: false,
  error: null,
}

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

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
    if (vistos.has(texto.toLowerCase())) {
      return false
    }
    vistos.add(texto.toLowerCase())
    return true
  })
  return partes.join(' | ')
}

const normalizeCentroCustoOptions = (lista) => {
  const mapa = new Map()
  ;(Array.isArray(lista) ? lista : []).forEach((item, index) => {
    const rawNome = typeof item === 'string' ? item : item?.nome
    const displayName = (rawNome ?? '').toString().trim()
    if (!displayName) {
      return
    }
    const id = item?.id ?? displayName
    const chave = item?.id ?? normalizeSearchValue(displayName)
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: id || `centro-${index}`,
        nome: displayName,
      })
    }
  })
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

const buildEntradasQuery = (filters) => {
  const query = {}
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
  }
  const registradoPor = filters.registradoPor?.trim()
  if (registradoPor) {
    query.registradoPor = registradoPor
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

export function EntradasPage() {
  const { user } = useAuth()
  const [materiais, setMateriais] = useState([])
  const [entradas, setEntradas] = useState([])
const [centrosCusto, setCentrosCusto] = useState([])
const [editingEntrada, setEditingEntrada] = useState(null)
const [form, setForm] = useState(initialForm)
const [filters, setFilters] = useState(filterInitial)
const [isSaving, setIsSaving] = useState(false)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState(null)
const [currentPage, setCurrentPage] = useState(1)
  const [materialSearchValue, setMaterialSearchValue] = useState('')
  const [materialSuggestions, setMaterialSuggestions] = useState([])
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false)
const [materialSearchError, setMaterialSearchError] = useState(null)
const materialSearchTimeoutRef = useRef(null)
const materialBlurTimeoutRef = useRef(null)
const [historyState, setHistoryState] = useState({ ...HISTORY_INITIAL })

  const load = async (params = filters, { resetPage = false, refreshCatalogs = false } = {}) => {
    if (resetPage) {
      setCurrentPage(1)
    }
    setIsLoading(true)
    setError(null)
    try {
      const shouldReloadMateriais = refreshCatalogs || materiais.length === 0
      const shouldReloadCentros = refreshCatalogs || centrosCusto.length === 0
      const [materiaisData, centrosData, entradasData] = await Promise.all([
        shouldReloadMateriais ? api.materiais.list() : Promise.resolve(null),
        shouldReloadCentros && api?.centrosCusto && typeof api.centrosCusto.list === 'function'
          ? api.centrosCusto.list()
          : Promise.resolve(null),
        api.entradas.list(buildEntradasQuery(params)),
      ])
      if (materiaisData) {
        setMateriais(materiaisData ?? [])
      }
      if (centrosData) {
        setCentrosCusto(normalizeCentroCustoOptions(centrosData ?? []))
      }
      setEntradas(entradasData ?? [])
      if (!centrosData) {
        const derivados = normalizeCentroCustoOptions([
          ...centrosCusto,
          ...(entradasData ?? []).map((entrada) => ({
            id: entrada.centroCustoId || entrada.centroCusto,
            nome: entrada.centroCusto || entrada.centroCustoId || '',
          })),
        ])
        if (derivados.length > 0) {
          setCentrosCusto(derivados)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(filterInitial, { resetPage: true, refreshCatalogs: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const isEditMode = Boolean(editingEntrada)
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        materialId: form.materialId,
        quantidade: form.quantidade,
        centroCusto: form.centroCusto.trim(),
        dataEntrada: form.dataEntrada,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      if (!payload.materialId) {
        throw new Error('Selecione um material valido.')
      }
      if (!payload.dataEntrada) {
        throw new Error('Informe a data da entrada.')
      }
      if (isEditMode) {
        await api.entradas.update(editingEntrada.id, payload)
      } else {
        await api.entradas.create(payload)
      }
      cancelEdit()
      await load(filters, { resetPage: !isEditMode, refreshCatalogs: true })
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

  const handleMaterialInputChange = (event) => {
    const { value } = event.target
    if (materialBlurTimeoutRef.current) {
      clearTimeout(materialBlurTimeoutRef.current)
      materialBlurTimeoutRef.current = null
    }
    setMaterialSearchValue(value)
    setForm((prev) => ({ ...prev, materialId: '' }))
    setMaterialSearchError(null)
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
    setEditingEntrada(null)
  }

  const startEditEntrada = (entrada) => {
    if (!entrada) {
      return
    }
    const material = materiaisMap.get(entrada.materialId)
    setEditingEntrada(entrada)
    setForm({
      materialId: entrada.materialId,
      quantidade: String(entrada.quantidade ?? ''),
      centroCusto: entrada.centroCustoId || entrada.centroCusto || '',
      dataEntrada: formatDateToInput(entrada.dataEntrada),
    })
    setMaterialSearchValue(
      material ? formatMaterialSummary(material) : entrada.materialId || ''
    )
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingEntrada(null)
    setForm({ ...initialForm })
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
  }

  const openHistory = async (entrada) => {
    if (!entrada?.id) {
      return
    }
    setHistoryState({ ...HISTORY_INITIAL, open: true, entrada, isLoading: true })
    try {
      const registros = await api.entradas.history(entrada.id)
      setHistoryState({
        open: true,
        entrada,
        isLoading: false,
        registros: registros ?? [],
        error: null,
      })
    } catch (err) {
      setHistoryState({
        ...HISTORY_INITIAL,
        open: true,
        entrada,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistory = () => {
    setHistoryState({ ...HISTORY_INITIAL })
  }

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [materiais])

  const centrosCustoMap = useMemo(() => {
    const map = new Map()
    centrosCusto.forEach((item) => {
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
  }, [centrosCusto])

  const resolveCentroCustoLabel = useCallback(
    (entrada) => {
      if (!entrada) {
        return ''
      }
      const candidatos = [entrada.centroCustoId, entrada.centroCusto]
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
      return entrada.centroCustoId || entrada.centroCusto || ''
    },
    [centrosCustoMap]
  )

  const registeredOptions = useMemo(() => {
    const mapa = new Map()
    entradas.forEach((entrada) => {
      const nome = entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || 'Nao informado'
      const id = entrada.usuarioResponsavelId || nome
      if (!nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [entradas])

  const centroCustoFilterOptions = useMemo(() => {
    const mapa = new Map()
    entradas.forEach((entrada) => {
      const nome = resolveCentroCustoLabel(entrada)
      if (!nome) {
        return
      }
      const chave = normalizeSearchValue(nome)
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          id: entrada.centroCustoId || entrada.centroCusto || nome,
          nome,
        })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [entradas, resolveCentroCustoLabel])

  const fallbackMaterialSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      return materiais
        .filter((material) => materialMatchesTerm(material, normalized))
        .slice(0, MATERIAL_SEARCH_MAX_RESULTS)
    },
    [materiais]
  )

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
        if (api?.materiais?.search) {
          resultados = await api.materiais.search({
            termo,
            limit: MATERIAL_SEARCH_MAX_RESULTS,
          })
        } else {
          resultados = fallbackMaterialSearch(termo)
        }
        if (!cancelled) {
          setMaterialSuggestions(resultados ?? [])
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
    const totalPages = Math.max(1, Math.ceil(entradas.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [entradas.length])

  useEffect(() => {
    return () => {
      if (materialBlurTimeoutRef.current) {
        clearTimeout(materialBlurTimeoutRef.current)
      }
    }
  }, [])

const normalizedSearchTerm = normalizeSearchValue(filters.termo)
const startTimestamp = filters.dataInicio ? Date.parse(`${filters.dataInicio}T00:00:00Z`) : null
const endTimestamp = filters.dataFim ? Date.parse(`${filters.dataFim}T23:59:59Z`) : null

const filteredEntradas = useMemo(() => {
  return entradas.filter((entrada) => {
      const dataEntrada = entrada.dataEntrada ? Date.parse(entrada.dataEntrada) : null
      if (startTimestamp && (dataEntrada === null || dataEntrada < startTimestamp)) {
        return false
      }
      if (endTimestamp && (dataEntrada === null || dataEntrada > endTimestamp)) {
        return false
      }
      if (filters.registradoPor) {
        const candidatos = [
          entrada.usuarioResponsavelId,
          entrada.usuarioResponsavel,
          entrada.usuarioResponsavelNome,
        ]
          .map((valor) => (valor ? String(valor).trim() : ''))
        if (!candidatos.includes(filters.registradoPor)) {
          return false
        }
      }
      if (filters.centroCusto) {
        const entradaLabel = resolveCentroCustoLabel(entrada)
        const normalizedFilter = normalizeSearchValue(filters.centroCusto)
        const filterLabel =
          centrosCustoMap.get(filters.centroCusto) ||
          centrosCustoMap.get(normalizedFilter) ||
          (!isLikelyUuid(filters.centroCusto) ? filters.centroCusto : '')
        const matchesById = Boolean(entrada.centroCustoId) && entrada.centroCustoId === filters.centroCusto
        const matchesByLabel =
          Boolean(filterLabel) &&
          normalizeSearchValue(entradaLabel || entrada.centroCusto || '') === normalizeSearchValue(filterLabel)
        if (!matchesById && !matchesByLabel) {
          return false
        }
      }
      if (normalizedSearchTerm) {
        const material = materiaisMap.get(entrada.materialId)
        const resumo = normalizeSearchValue(material ? formatMaterialSummary(material) : '')
        if (!resumo.includes(normalizedSearchTerm)) {
          return false
        }
      }
      return true
    })
  }, [
    entradas,
    filters.registradoPor,
    filters.centroCusto,
    normalizedSearchTerm,
    materiaisMap,
    startTimestamp,
    endTimestamp,
    resolveCentroCustoLabel,
    centrosCustoMap,
  ])

  const paginatedEntradas = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return filteredEntradas.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [filteredEntradas, currentPage])

  const shouldShowMaterialDropdown =
    materialDropdownOpen &&
    !form.materialId &&
    (isSearchingMaterials || materialSearchError || materialSuggestions.length > 0)

  const hasCentrosCusto = centrosCusto.length > 0
  const isEditing = Boolean(editingEntrada)

  return (
    <div className="stack">
      <PageHeader
        icon={<EntryIcon size={28} />}
        title="Entradas"
        subtitle="Registre novas entradas e mantenha rastreabilidade do estoque."
      />

      <form className="form" onSubmit={handleSubmit}>
        {isEditing ? (
          <div className="form__notice">
            <span>Editando entrada #{editingEntrada?.id?.slice(0, 8) || ''}</span>
            <button type="button" className="button button--ghost" onClick={cancelEdit} disabled={isSaving}>
              Cancelar edição
            </button>
          </div>
        ) : null}
        <div className="form__grid">
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
                placeholder="Busque por nome, grupo, tamanho ou fabricante"
                aria-autocomplete="list"
                aria-expanded={shouldShowMaterialDropdown}
                autoComplete="off"
                spellCheck="false"
              />
              <input type="hidden" name="materialId" value={form.materialId} />
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
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>Centro de custo*</span>
            {hasCentrosCusto ? (
              <select name="centroCusto" value={form.centroCusto} onChange={handleChange} required>
                <option value="">Selecione um centro</option>
                {centrosCusto.map((item) => (
                  <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                    {item.nome}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="centroCusto"
                value={form.centroCusto}
                onChange={handleChange}
                required
                placeholder="Informe o centro de custo"
              />
            )}
          </label>
        <label className="field">
          <span>Data da entrada*</span>
          <input type="date" name="dataEntrada" value={form.dataEntrada} onChange={handleChange} required />
        </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? (isEditing ? 'Salvando...' : 'Registrando...') : isEditing ? 'Salvar alterações' : 'Registrar entrada'}
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
            placeholder="Buscar por material"
          />
        </label>
        <label className="field">
          <span>Registrado por</span>
          <select name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {registeredOptions.map((item) => (
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
          <h2>Historico de entradas</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => load(filters, { refreshCatalogs: true })}
            disabled={isLoading}
          >
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && entradas.length === 0 ? <p className="feedback">Nenhuma entrada registrada.</p> : null}
        {entradas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Descrição</th>
                  <th>Quantidade</th>
                  <th>Centro de custo</th>
                  <th>Valor total</th>
                  <th>Data</th>
                  <th>Registrado por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntradas.map((entrada) => {
                  const material = materiaisMap.get(entrada.materialId)
                  const valorUnitario = Number(material?.valorUnitario ?? 0)
                  const total = valorUnitario * Number(entrada.quantidade ?? 0)
                  const centroCustoLabel = resolveCentroCustoLabel(entrada) || '-'
                  const materialResumo = material ? formatMaterialSummary(material) : 'Material removido'
                  const materialIdLabel = material?.id || entrada.materialId || 'Nao informado'
                  const descricaoMaterial = material?.descricao || 'Nao informado'
                  return (
                    <tr key={entrada.id}>
                      <td>
                        <strong>{materialResumo}</strong>
                        <p className="data-table__muted">ID: {materialIdLabel}</p>
                      </td>
                      <td>{descricaoMaterial}</td>
                      <td>{entrada.quantidade}</td>
                      <td>{centroCustoLabel}</td>
                      <td>{formatCurrency(total)}</td>
                      <td>{formatDisplayDate(entrada.dataEntrada)}</td>
                      <td>{entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || 'Nao informado'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--ghost button--icon"
                            onClick={() => startEditEntrada(entrada)}
                            aria-label={`Editar entrada ${entrada.id}`}
                            title="Editar entrada"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="button button--ghost button--icon"
                            onClick={() => openHistory(entrada)}
                            aria-label={`Historico da entrada ${entrada.id}`}
                            title="Historico da entrada"
                          >
                            <HistoryIcon size={16} />
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
          totalItems={filteredEntradas.length}
          pageSize={TABLE_PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>
      <EntradasHistoryModal state={historyState} onClose={closeHistory} />
    </div>
  )
}


