import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { PeopleIcon } from '../components/icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../services/api.js'

const initialForm = {
  nome: '',
  matricula: '',
  local: '',
  cargo: '',
}

const filterInitial = {
  termo: '',
  local: 'todos',
  cargo: 'todos',
}

export function PessoasPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [data, setData] = useState([])
  const [filters, setFilters] = useState(filterInitial)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const pessoas = await api.pessoas.list()
      setData(pessoas ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
  }

  const handleFilterClear = () => {
    setFilters(filterInitial)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const usuario = user?.name || user?.username || 'sistema'
      await api.pessoas.create({
        ...form,
        usuarioCadastro: usuario,
      })
      setForm(initialForm)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const locais = useMemo(() => {
    const values = new Set()
    data.forEach((item) => {
      if (item?.local) {
        values.add(item.local)
      }
    })
    return Array.from(values).sort()
  }, [data])

  const cargos = useMemo(() => {
    const values = new Set()
    data.forEach((item) => {
      if (item?.cargo) {
        values.add(item.cargo)
      }
    })
    return Array.from(values).sort()
  }, [data])

  const filteredData = useMemo(() => {
    const termo = filters.termo.trim().toLowerCase()

    return data.filter((pessoa) => {
      if (filters.local !== 'todos' && pessoa.local !== filters.local) {
        return false
      }

      if (filters.cargo !== 'todos' && pessoa.cargo !== filters.cargo) {
        return false
      }

      if (!termo) {
        return true
      }

      const alvo = [
        pessoa.nome || '',
        pessoa.matricula || '',
        pessoa.local || '',
        pessoa.cargo || '',
        pessoa.usuarioCadastro || '',
      ]
        .join(' ')
        .toLowerCase()

      return alvo.includes(termo)
    })
  }, [data, filters])

  return (
    <div className="stack">
      <PageHeader
        icon={<PeopleIcon size={28} />}
        title="Pessoas"
        subtitle="Registre colaboradores permitindo nomes duplicados, mas com controle por ID interno."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid">
          <label className="field">
            <span>Nome*</span>
            <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Joao Silva" />
          </label>
          <label className="field">
            <span>Matricula*</span>
            <input name="matricula" value={form.matricula} onChange={handleChange} required placeholder="12345" />
          </label>
          <label className="field">
            <span>Local*</span>
            <input name="local" value={form.local} onChange={handleChange} required placeholder="Unidade/Setor" />
          </label>
          <label className="field">
            <span>Cargo*</span>
            <input name="cargo" value={form.cargo} onChange={handleChange} required placeholder="Tecnico de manutencao" />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar pessoa'}
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
            placeholder="Nome, matricula, local"
          />
        </label>
        <label className="field">
          <span>Local</span>
          <select name="local" value={filters.local} onChange={handleFilterChange}>
            <option value="todos">Todos</option>
            {locais.map((local) => (
              <option key={local} value={local}>
                {local}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cargo</span>
          <select name="cargo" value={filters.cargo} onChange={handleFilterChange}>
            <option value="todos">Todos</option>
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--ghost">Aplicar</button>
          <button type="button" className="button button--ghost" onClick={handleFilterClear}>Limpar</button>
        </div>
      </form>

      <section className="card">
        <header className="card__header">
          <h2>Lista de pessoas</h2>
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && filteredData.length === 0 ? <p className="feedback">Nenhuma pessoa cadastrada ainda.</p> : null}
        {filteredData.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Matricula</th>
                  <th>Local</th>
                  <th>Registrado por</th>
                  <th>Cargo</th>
                  <th>Cadastrado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((pessoa) => (
                  <tr key={pessoa.id}>
                    <td>{pessoa.nome}</td>
                    <td>{pessoa.matricula || '-'}</td>
                    <td>{pessoa.local}</td>
                    <td>{pessoa.usuarioCadastro || '-'}</td>
                    <td>{pessoa.cargo}</td>
                    <td>{pessoa.criadoEm ? new Date(pessoa.criadoEm).toLocaleDateString('pt-BR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
