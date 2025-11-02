import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { PeopleIcon } from '../components/icons.jsx'
import { PessoasForm } from '../components/Pessoas/PessoasForm.jsx'
import { PessoasFilters } from '../components/Pessoas/PessoasFilters.jsx'
import { PessoasTable } from '../components/Pessoas/PessoasTable.jsx'
import { PessoasHistoryModal } from '../components/Pessoas/PessoasHistoryModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { dataClient as api } from '../services/dataClient.js'
import {
  PESSOAS_FILTER_DEFAULT,
  PESSOAS_FORM_DEFAULT,
  PESSOAS_HISTORY_DEFAULT,
} from '../config/PessoasConfig.js'
import {
  createPessoaPayload,
  updatePessoaPayload,
  sortPessoasByNome,
  extractCentrosServico,
  extractCargos,
  extractSetores,
  extractTiposExecucao,
} from '../rules/PessoasRules.js'
import { resolveUsuarioNome } from '../utils/PessoasUtils.js'

import '../styles/PessoasPage.css'

const formatDateInputValue = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

const buildPessoasQuery = (filters) => {
  const query = {}
  const termo = filters.termo?.trim()
  if (termo) {
    query.termo = termo
  }
  const centroServico = filters.centroServico ?? filters.local
  if (centroServico && centroServico.toLowerCase() !== 'todos') {
    query.centroServico = centroServico
  }
  const cargo = filters.cargo
  if (cargo && cargo.toLowerCase() !== 'todos') {
    query.cargo = cargo
  }
  const setor = filters.setor
  if (setor && setor.toLowerCase() !== 'todos') {
    query.setor = setor
  }
  return query
}

export function PessoasPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({ ...PESSOAS_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...PESSOAS_FILTER_DEFAULT }))
  const [pessoas, setPessoas] = useState([])
  const [pessoasOptions, setPessoasOptions] = useState([])
  const [editingPessoa, setEditingPessoa] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...PESSOAS_HISTORY_DEFAULT }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [referencias, setReferencias] = useState({
    centrosServico: [],
    setores: [],
    cargos: [],
    tiposExecucao: [],
  })

  const refreshReferencias = useCallback(async () => {
    if (!api.references || typeof api.references.pessoas !== 'function') {
      return
    }
    try {
      const data = await api.references.pessoas()
      setReferencias({
        centrosServico: data?.centrosServico ?? [],
        setores: data?.setores ?? [],
        cargos: data?.cargos ?? [],
        tiposExecucao: data?.tiposExecucao ?? [],
      })
    } catch (err) {
      console.warn('Falha ao carregar referencias de pessoas.', err)
    }
  }, [api])

  const loadPessoas = useCallback(
    async (params, refreshOptions = false) => {
      setIsLoading(true)
      setError(null)
      try {
        const query = buildPessoasQuery(params)
        const needsOptionsRefresh = refreshOptions || pessoasOptions.length === 0
        const [optionsData, filteredData] = await Promise.all([
          needsOptionsRefresh ? api.pessoas.list() : Promise.resolve(null),
          api.pessoas.list(query),
        ])

        if (optionsData) {
          setPessoasOptions(optionsData ?? [])
          await refreshReferencias()
        }
        setPessoas(filteredData ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    },
    [pessoasOptions.length, refreshReferencias],
  )

  useEffect(() => {
    loadPessoas(PESSOAS_FILTER_DEFAULT, true)
  }, [loadPessoas])

  useEffect(() => {
    refreshReferencias()
  }, [refreshReferencias])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    if (name === 'centroServico') {
      setForm((prev) => ({ ...prev, centroServico: value, local: value }))
      return
    }
    if (name === 'tipoExecucao') {
      setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    if (name === 'centroServico') {
      setFilters((prev) => ({ ...prev, centroServico: value, local: value }))
      return
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    loadPessoas(filters)
  }

  const handleFilterClear = () => {
    const nextFilters = { ...PESSOAS_FILTER_DEFAULT }
    setFilters(nextFilters)
    loadPessoas(nextFilters)
  }

  const resetForm = () => {
    setEditingPessoa(null)
    setForm({ ...PESSOAS_FORM_DEFAULT })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const usuario = resolveUsuarioNome(user)
      if (editingPessoa) {
        await api.pessoas.update(editingPessoa.id, updatePessoaPayload(form, usuario))
      } else {
        await api.pessoas.create(createPessoaPayload(form, usuario))
      }

      resetForm()
      setHistoryCache({})
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
      await loadPessoas(filters, true)
      await refreshReferencias()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (pessoa) => {
    setEditingPessoa(pessoa)
    setForm({
      nome: pessoa.nome || '',
      matricula: pessoa.matricula || '',
      centroServico: pessoa.centroServico ?? pessoa.local ?? '',
      local: pessoa.centroServico ?? pessoa.local ?? '',
      setor: pessoa.setor ?? '',
      cargo: pessoa.cargo || '',
      dataAdmissao: formatDateInputValue(pessoa.dataAdmissao),
      tipoExecucao: pessoa.tipoExecucao || '',
    })
  }

  const cancelEdit = () => {
    resetForm()
  }

  const openHistory = async (pessoa) => {
    setError(null)

    const cached = historyCache[pessoa.id]
    if (cached) {
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, registros: cached })
      return
    }

    setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, isLoading: true })
    try {
      const registros = (await api.pessoas.history(pessoa.id)) ?? []
      setHistoryCache((prev) => ({ ...prev, [pessoa.id]: registros }))
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, registros })
    } catch (err) {
      setHistoryState({
        ...PESSOAS_HISTORY_DEFAULT,
        open: true,
        pessoa,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistory = () => {
    setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
  }

  const pessoasOrdenadas = useMemo(
    () => sortPessoasByNome(pessoas),
    [pessoas],
  )

  const centrosServico = useMemo(() => {
    const referenciasNomes = (referencias.centrosServico ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) {
      return referenciasNomes
    }
    return extractCentrosServico(pessoasOptions)
  }, [referencias.centrosServico, pessoasOptions])

  const setores = useMemo(() => {
    const referenciasNomes = (referencias.setores ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) {
      return referenciasNomes
    }
    return extractSetores(pessoasOptions)
  }, [referencias.setores, pessoasOptions])

  const cargos = useMemo(() => {
    const referenciasNomes = (referencias.cargos ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) {
      return referenciasNomes
    }
    return extractCargos(pessoasOptions)
  }, [referencias.cargos, pessoasOptions])

  const tiposExecucao = useMemo(() => {
    const referenciasNomes = (referencias.tiposExecucao ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) {
      return referenciasNomes
    }
    return extractTiposExecucao(pessoasOptions)
  }, [referencias.tiposExecucao, pessoasOptions])

  const formOptions = useMemo(
    () => ({
      centrosServico,
      setores,
      cargos,
      tiposExecucao,
    }),
    [centrosServico, setores, cargos, tiposExecucao],
  )

  return (
    <div className="stack">
      <PageHeader
        icon={<PeopleIcon size={28} />}
        title="Pessoas"
        subtitle="Registre e atualize colaboradores com historico de edicoes."
      />

      <PessoasForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingPessoa={editingPessoa}
        onCancel={cancelEdit}
        error={error}
        options={formOptions}
      />

      <PessoasFilters
        filters={filters}
        centrosServico={centrosServico}
        setores={setores}
        cargos={cargos}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Lista de pessoas</h2>
          <button type="button" className="button button--ghost" onClick={() => loadPessoas(filters, true)} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <PessoasTable
            pessoas={pessoasOrdenadas}
            editingId={editingPessoa?.id ?? null}
            isSaving={isSaving}
            onEdit={startEdit}
            onHistory={openHistory}
            historyState={historyState}
          />
        ) : null}
      </section>

      <PessoasHistoryModal state={historyState} onClose={closeHistory} />
    </div>
  )
}





