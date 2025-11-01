import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon } from '../components/icons.jsx'
import { AcidentesForm } from '../components/Acidentes/AcidentesForm.jsx'
import { AcidentesFilters } from '../components/Acidentes/AcidentesFilters.jsx'
import { AcidentesTable } from '../components/Acidentes/AcidentesTable.jsx'
import { AcidentesHistoryModal } from '../components/Acidentes/AcidentesHistoryModal.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  ACIDENTES_FORM_DEFAULT,
  ACIDENTES_FILTER_DEFAULT,
  ACIDENTES_HISTORY_DEFAULT,
} from '../config/AcidentesConfig.js'
import {
  resolveUsuarioNome,
  validateAcidenteForm,
  createAcidentePayload,
  updateAcidentePayload,
  filterAcidentes,
  extractAgentes,
  extractCentrosServico,
  extractTipos,
} from '../rules/AcidentesRules.js'

import '../styles/AcidentesPage.css'

const toInputDate = (value) => {
  if (!value) {
    return ''
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
      .filter(Boolean)
  }
  if (value === undefined || value === null) {
    return []
  }
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const normalizeAgenteNome = (valor) => {
  if (typeof valor === 'string') {
    return valor.trim()
  }
  if (valor === undefined || valor === null) {
    return ''
  }
  return String(valor).trim()
}

const normalizeAgenteKey = (valor) =>
  normalizeAgenteNome(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const extractAgenteNome = (entrada) => {
  if (!entrada) {
    return ''
  }
  if (typeof entrada === 'string') {
    return entrada
  }
  if (typeof entrada === 'object') {
    return (
      entrada.nome ??
      entrada.label ??
      entrada.value ??
      entrada.descricao ??
      ''
    )
  }
  return ''
}

export function AcidentesPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({ ...ACIDENTES_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...ACIDENTES_FILTER_DEFAULT }))
  const [acidentes, setAcidentes] = useState([])
  const [editingAcidente, setEditingAcidente] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...ACIDENTES_HISTORY_DEFAULT }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [listError, setListError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [pessoasError, setPessoasError] = useState(null)
  const [isLoadingPessoas, setIsLoadingPessoas] = useState(false)
  const [locais, setLocais] = useState([])
  const [locaisError, setLocaisError] = useState(null)
  const [isLoadingLocais, setIsLoadingLocais] = useState(false)
  const [agenteOpcoes, setAgenteOpcoes] = useState([])
  const [agentesError, setAgentesError] = useState(null)
  const [isLoadingAgentes, setIsLoadingAgentes] = useState(false)
  const [tipoOpcoes, setTipoOpcoes] = useState([])
  const [tiposError, setTiposError] = useState(null)
  const [isLoadingTipos, setIsLoadingTipos] = useState(false)
  const [lesaoOpcoes, setLesaoOpcoes] = useState([])
  const [lesoesError, setLesoesError] = useState(null)
  const [isLoadingLesoes, setIsLoadingLesoes] = useState(false)
  const [partesOpcoes, setPartesOpcoes] = useState([])
  const [partesError, setPartesError] = useState(null)
  const [isLoadingPartes, setIsLoadingPartes] = useState(false)

  const loadAcidentes = useCallback(async () => {
    setIsLoading(true)
    setListError(null)
    try {
      const response = await api.acidentes.list()
      setAcidentes(response ?? [])
    } catch (err) {
      setListError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadPessoas = useCallback(async () => {
    setIsLoadingPessoas(true)
    setPessoasError(null)
    try {
      const response = await api.pessoas.list()
      setPessoas(response ?? [])
    } catch (err) {
      setPessoasError(err.message)
    } finally {
      setIsLoadingPessoas(false)
    }
  }, [])

  const loadAgentes = useCallback(async () => {
    setIsLoadingAgentes(true)
    setAgentesError(null)
    try {
      const response = await api.acidentes.agents()
      const lista = Array.isArray(response)
        ? response
            .map((item) => {
              if (!item) {
                return null
              }
              if (typeof item === 'string') {
                const nome = normalizeAgenteNome(item)
                return nome ? { id: null, nome } : null
              }
              const nome = normalizeAgenteNome(item.nome ?? item.label ?? item.value)
              if (!nome) {
                return null
              }
              return {
                id: item.id ?? item.agenteId ?? null,
                nome,
              }
            })
            .filter(Boolean)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        : []
      setAgenteOpcoes(lista)
    } catch (err) {
      setAgentesError(err.message)
      setAgenteOpcoes([])
    } finally {
      setIsLoadingAgentes(false)
    }
  }, [])

  const loadPartes = useCallback(async () => {
    setIsLoadingPartes(true)
    setPartesError(null)
    try {
      const response = await api.acidentes.parts()
      setPartesOpcoes(Array.isArray(response) ? response : [])
    } catch (err) {
      setPartesError(err.message)
      setPartesOpcoes([])
    } finally {
      setIsLoadingPartes(false)
    }
  }, [])

  const loadLocais = useCallback(async () => {
    setIsLoadingLocais(true)
    setLocaisError(null)
    try {
      const response = await api.acidentes.locals()
      setLocais(Array.isArray(response) ? response : [])
    } catch (err) {
      setLocaisError(err.message)
      setLocais([])
    } finally {
      setIsLoadingLocais(false)
    }
  }, [])

  useEffect(() => {
    loadAcidentes()
  }, [loadAcidentes])

  useEffect(() => {
    loadPessoas()
  }, [loadPessoas])

  useEffect(() => {
    loadAgentes()
  }, [loadAgentes])

  useEffect(() => {
    loadLocais()
  }, [loadLocais])

  useEffect(() => {
    loadPartes()
  }, [loadPartes])

  const agenteSelecionadoInfo = useMemo(() => {
    const alvo = normalizeAgenteKey(form.agente ?? '')
    if (!alvo) {
      return null
    }
    return (
      agenteOpcoes.find((item) => {
        if (!item) {
          return false
        }
        const nomeItem = extractAgenteNome(item)
        return normalizeAgenteKey(nomeItem) === alvo
      }) ?? null
    )
  }, [agenteOpcoes, form.agente])

  const agenteAtualPayload = useMemo(() => {
    const nome = normalizeAgenteNome(form.agente)
    if (agenteSelecionadoInfo && typeof agenteSelecionadoInfo === 'object') {
      const nomeOficial = normalizeAgenteNome(
        agenteSelecionadoInfo.nome ?? extractAgenteNome(agenteSelecionadoInfo),
      )
      const payloadNome = nomeOficial || nome
      return {
        nome: payloadNome,
        id: agenteSelecionadoInfo.id ?? agenteSelecionadoInfo.agenteId ?? null,
      }
    }
    if (nome) {
      return { nome, id: null }
    }
    return null
  }, [agenteSelecionadoInfo, form.agente])

  useEffect(() => {
    let cancelado = false
    if (!agenteAtualPayload) {
      setLesaoOpcoes([])
      setLesoesError(null)
      setIsLoadingLesoes(false)
      return () => {
        cancelado = true
      }
    }
    const fetchLesoes = async () => {
      const fetcher = api?.acidentes?.lesions
      if (typeof fetcher !== 'function') {
        if (!cancelado) {
          setLesaoOpcoes([])
          setLesoesError(null)
          setIsLoadingLesoes(false)
        }
        return
      }
      setIsLoadingLesoes(true)
      setLesoesError(null)
      setLesaoOpcoes([])
      try {
        const response = await fetcher(agenteAtualPayload)
        if (!cancelado) {
          setLesaoOpcoes(Array.isArray(response) ? response : [])
        }
      } catch (err) {
        if (!cancelado) {
          setLesoesError(err.message)
          setLesaoOpcoes([])
        }
      } finally {
        if (!cancelado) {
          setIsLoadingLesoes(false)
        }
      }
    }
    fetchLesoes()
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  useEffect(() => {
    if (!agenteAtualPayload) {
      setTipoOpcoes([])
      setTiposError(null)
      setIsLoadingTipos(false)
      return
    }
    let cancelado = false
    setIsLoadingTipos(true)
    setTiposError(null)
    setTipoOpcoes([])
    api.acidentes
      .agentTypes(agenteAtualPayload)
      .then((lista) => {
        if (!cancelado) {
          setTipoOpcoes(Array.isArray(lista) ? lista : [])
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setTiposError(err.message)
          setTipoOpcoes([])
        }
      })
      .finally(() => {
        if (!cancelado) {
          setIsLoadingTipos(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  const pessoasPorMatricula = useMemo(() => {
    const map = new Map()
    pessoas.forEach((pessoa) => {
      if (!pessoa?.matricula) {
        return
      }
      map.set(String(pessoa.matricula), pessoa)
    })
    return map
  }, [pessoas])

  const centrosServicoPessoas = useMemo(() => {
    const valores = new Set()
    pessoas.forEach((pessoa) => {
      const centro = (pessoa?.centroServico ?? pessoa?.setor ?? '').trim()
      if (!centro) {
        return
      }
      valores.add(centro)
    })
    return Array.from(valores).sort((a, b) => a.localeCompare(b))
  }, [pessoas])

  const resolveLocalDisponivel = useCallback(
    (valor) => {
      const alvo = valor?.trim()
      if (!alvo) {
        return ''
      }
      const matchDireto = locais.find((item) => item === alvo)
      if (matchDireto) {
        return matchDireto
      }
      const normalizar = (texto) =>
        texto
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const alvoNormalizado = normalizar(alvo)
      return locais.find((item) => normalizar(item) === alvoNormalizado) ?? ''
    },
    [locais],
  )

  const handleFormChange = (event) => {
    const { name, value } = event.target
    if (name === 'matricula') {
      setForm((prev) => {
        const next = { ...prev, matricula: value }
        const pessoa = pessoasPorMatricula.get(value)
        if (pessoa) {
          next.nome = pessoa.nome ?? ''
          next.cargo = pessoa.cargo ?? ''
          const centroServico = pessoa.centroServico ?? pessoa.setor ?? pessoa.local ?? ''
          next.centroServico = centroServico
          next.setor = centroServico
          const localBase = pessoa.local ?? centroServico
          next.local = resolveLocalDisponivel(localBase)
        } else if (!value) {
          next.nome = ''
          next.cargo = ''
          next.centroServico = ''
          next.setor = ''
          next.local = ''
        }
        return next
      })
      return
    }
    if (name === 'agentes') {
      const lista = Array.isArray(value)
        ? value
            .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
            .filter(Boolean)
        : parseList(value)
      setForm((prev) => {
        const agenteAtual = lista.length ? lista[lista.length - 1] : ''
        const next = { ...prev, agentes: lista, agente: agenteAtual }
        if (!lista.length) {
          next.tipos = []
          next.tipo = ''
          next.lesoes = []
          next.lesao = ''
        }
        return next
      })
      if (!lista.length) {
        setTipoOpcoes([])
        setTiposError(null)
      }
      return
    }
    if (name === 'agente') {
      setForm((prev) => {
        if (prev.agente === value) {
          return prev
        }
        const next = { ...prev, agente: value }
        if (!value) {
          next.tipos = []
          next.tipo = ''
          next.lesoes = []
          next.lesao = ''
        }
        return next
      })
      if (!value) {
        setTipoOpcoes([])
        setTiposError(null)
      }
      return
    }
    if (name === 'tipo') {
      setForm((prev) => ({ ...prev, tipo: value }))
      return
    }
    if (name === 'tipos') {
      const lista = Array.isArray(value)
        ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
        : parseList(value)
      setForm((prev) => ({ ...prev, tipos: lista, tipo: lista.join('; ') }))
      return
    }
    if (name === 'lesoes') {
      const lista = Array.isArray(value)
        ? value.filter((item) => item && item.trim())
        : typeof value === 'string' && value
          ? [value.trim()].filter(Boolean)
          : []
      setForm((prev) => ({ ...prev, lesoes: lista, lesao: lista[0] ?? '' }))
      return
    }
    if (name === 'partesLesionadas') {
      const lista = Array.isArray(value)
        ? value.filter((item) => item && item.trim())
        : typeof value === 'string' && value
        ? [value.trim()].filter(Boolean)
        : []
      setForm((prev) => ({ ...prev, partesLesionadas: lista }))
      return
    }
    if (name === 'local') {
      setForm((prev) => ({ ...prev, local: resolveLocalDisponivel(value) }))
      return
    }
    if (name === 'centroServico') {
      setForm((prev) => ({ ...prev, centroServico: value, setor: value }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    if (name === "centroServico") {
      setFilters((prev) => ({ ...prev, centroServico: value, setor: value }))
      return
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
  }

  const handleFilterClear = () => {
    setFilters({ ...ACIDENTES_FILTER_DEFAULT })
  }

  const resetForm = () => {
    setForm({ ...ACIDENTES_FORM_DEFAULT })
    setEditingAcidente(null)
    setTipoOpcoes([])
    setTiposError(null)
    setIsLoadingTipos(false)
    setLesoesError(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const validationError = validateAcidenteForm(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSaving(true)

    try {
      const usuario = resolveUsuarioNome(user)

      if (editingAcidente) {
        await api.acidentes.update(editingAcidente.id, updateAcidentePayload(form, usuario))
      } else {
        await api.acidentes.create(createAcidentePayload(form, usuario))
      }

      resetForm()
      setHistoryCache({})
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT })
      await loadAcidentes()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (acidente) => {
    setEditingAcidente(acidente)
    const lesoesSelecionadas =
      Array.isArray(acidente.lesoes) && acidente.lesoes.length
        ? acidente.lesoes.slice()
        : acidente.lesao
          ? [acidente.lesao]
          : []
    const agentesSelecionados = parseList(acidente.agentes?.length ? acidente.agentes : acidente.agente)
    const tiposSelecionados = parseList(acidente.tipos?.length ? acidente.tipos : acidente.tipo)
    setForm({
      matricula: acidente.matricula || '',
      nome: acidente.nome || '',
      cargo: acidente.cargo || '',
      data: toInputDate(acidente.data),
      diasPerdidos: acidente.diasPerdidos !== null && acidente.diasPerdidos !== undefined ? String(acidente.diasPerdidos) : '',
      diasDebitados:
        acidente.diasDebitados !== null && acidente.diasDebitados !== undefined ? String(acidente.diasDebitados) : '',
      tipo: tiposSelecionados.join('; '),
      tipos: tiposSelecionados,
      agente: agentesSelecionados[agentesSelecionados.length - 1] || '',
      agentes: agentesSelecionados,
      cid: acidente.cid || '',
      lesao: lesoesSelecionadas[0] || '',
      lesoes: lesoesSelecionadas,
      parteLesionada: acidente.parteLesionada || '',
      hht:
        acidente.hht !== null && acidente.hht !== undefined ? String(acidente.hht) : '',
      centroServico: acidente.centroServico || acidente.setor || '',
      setor: acidente.centroServico || acidente.setor || '',
      local: resolveLocalDisponivel(acidente.local || acidente.centroServico || ''),
      partesLesionadas:
        Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
          ? acidente.partesLesionadas.slice()
          : acidente.parteLesionada
            ? [acidente.parteLesionada]
            : [],
      cat: acidente.cat || '',
    })
    setTipoOpcoes([])
    setTiposError(null)
  }

  const cancelEdit = () => {
    resetForm()
  }

  const openHistory = async (acidente) => {
    const cached = historyCache[acidente.id]
    if (cached) {
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, registros: cached })
      return
    }

    setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, isLoading: true })

    try {
      const registros = (await api.acidentes.history(acidente.id)) ?? []
      setHistoryCache((prev) => ({ ...prev, [acidente.id]: registros }))
      setHistoryState({ ...ACIDENTES_HISTORY_DEFAULT, open: true, acidente, registros })
    } catch (err) {
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

  const acidentesFiltrados = useMemo(
    () => filterAcidentes(acidentes, filters),
    [acidentes, filters],
  )

  const tiposFiltro = useMemo(() => extractTipos(acidentes), [acidentes])
  const centrosServico = useMemo(() => extractCentrosServico(acidentes), [acidentes])
  const agenteOpcoesNomes = useMemo(() => {
    const mapa = new Map()
    agenteOpcoes.forEach((item) => {
      const nome = normalizeAgenteNome(extractAgenteNome(item))
      if (!nome) {
        return
      }
      const chave = normalizeAgenteKey(nome)
      if (!mapa.has(chave)) {
        mapa.set(chave, nome)
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [agenteOpcoes])

  const agentesFiltro = useMemo(() => extractAgentes(acidentes), [acidentes])

  return (
    <div className="stack">
      <PageHeader
        icon={<AlertIcon size={28} />}
        title="Acidentes"
        subtitle="Registre acidentes de trabalho, filtre e acompanhe os indicadores."
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
        partes={partesOpcoes}
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
          <button type="button" className="button button--ghost" onClick={loadAcidentes} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {listError ? <p className="feedback feedback--error">{listError}</p> : null}
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <AcidentesTable
            acidentes={acidentesFiltrados}
            onEdit={startEdit}
            onHistory={openHistory}
            editingId={editingAcidente?.id ?? null}
            isSaving={isSaving}
            historyState={historyState}
          />
        ) : null}
      </section>

      <AcidentesHistoryModal state={historyState} onClose={closeHistory} />
    </div>
  )
}
