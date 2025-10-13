import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon } from '../components/icons.jsx'
import { AcidentesForm } from '../components/Acidentes/AcidentesForm.jsx'
import { AcidentesFilters } from '../components/Acidentes/AcidentesFilters.jsx'
import { AcidentesTable } from '../components/Acidentes/AcidentesTable.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ACIDENTES_FORM_DEFAULT, ACIDENTES_FILTER_DEFAULT } from '../config/AcidentesConfig.js'
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

export function AcidentesPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({ ...ACIDENTES_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...ACIDENTES_FILTER_DEFAULT }))
  const [acidentes, setAcidentes] = useState([])
  const [editingAcidente, setEditingAcidente] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [listError, setListError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [pessoasError, setPessoasError] = useState(null)
  const [isLoadingPessoas, setIsLoadingPessoas] = useState(false)

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

  useEffect(() => {
    loadAcidentes()
  }, [loadAcidentes])

  useEffect(() => {
    loadPessoas()
  }, [loadPessoas])

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
          next.local = ''
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
      await loadAcidentes()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (acidente) => {
    setEditingAcidente(acidente)
    setForm({
      matricula: acidente.matricula || '',
      nome: acidente.nome || '',
      cargo: acidente.cargo || '',
      data: toInputDate(acidente.data),
      diasPerdidos: acidente.diasPerdidos !== null && acidente.diasPerdidos !== undefined ? String(acidente.diasPerdidos) : '',
      diasDebitados:
        acidente.diasDebitados !== null && acidente.diasDebitados !== undefined ? String(acidente.diasDebitados) : '',
      tipo: acidente.tipo || '',
      agente: acidente.agente || '',
      cid: acidente.cid || '',
      lesao: acidente.lesao || '',
      parteLesionada: acidente.parteLesionada || '',
      hht:
        acidente.hht !== null && acidente.hht !== undefined ? String(acidente.hht) : '',
      centroServico: acidente.centroServico || acidente.setor || '',
      setor: acidente.centroServico || acidente.setor || '',
      local: acidente.local || acidente.centroServico || '',
      cat: acidente.cat || '',
    })
  }

  const cancelEdit = () => {
    resetForm()
  }

  const acidentesFiltrados = useMemo(
    () => filterAcidentes(acidentes, filters),
    [acidentes, filters],
  )

  const tipos = useMemo(() => extractTipos(acidentes), [acidentes])
  const centrosServico = useMemo(() => extractCentrosServico(acidentes), [acidentes])
  const agentes = useMemo(() => extractAgentes(acidentes), [acidentes])

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
      />

      <AcidentesFilters
        filters={filters}
        tipos={tipos}
        centrosServico={centrosServico}
        agentes={agentes}
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
            editingId={editingAcidente?.id ?? null}
            isSaving={isSaving}
          />
        ) : null}
      </section>
    </div>
  )
}
