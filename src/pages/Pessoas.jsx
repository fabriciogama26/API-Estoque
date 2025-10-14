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
  filterPessoas,
  sortPessoasByNome,
  extractCentrosServico,
  extractCargos,
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

export function PessoasPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({ ...PESSOAS_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...PESSOAS_FILTER_DEFAULT }))
  const [pessoas, setPessoas] = useState([])
  const [editingPessoa, setEditingPessoa] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...PESSOAS_HISTORY_DEFAULT }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadPessoas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.pessoas.list()
      setPessoas(response ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPessoas()
  }, [loadPessoas])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    if (name === 'centroServico') {
      setForm((prev) => ({ ...prev, centroServico: value, local: value }))
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
  }

  const handleFilterClear = () => {
    setFilters({ ...PESSOAS_FILTER_DEFAULT })
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
      await loadPessoas()
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

  const pessoasFiltradas = useMemo(
    () => filterPessoas(pessoas, filters),
    [pessoas, filters],
  )

  const pessoasOrdenadas = useMemo(
    () => sortPessoasByNome(pessoasFiltradas),
    [pessoasFiltradas],
  )

  const centrosServico = useMemo(() => extractCentrosServico(pessoas), [pessoas])
  const cargos = useMemo(() => extractCargos(pessoas), [pessoas])

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
      />

      <PessoasFilters
        filters={filters}
        centrosServico={centrosServico}
        cargos={cargos}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Lista de pessoas</h2>
          <button type="button" className="button button--ghost" onClick={loadPessoas} disabled={isLoading}>
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
