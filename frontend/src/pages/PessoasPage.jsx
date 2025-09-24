import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../services/api.js'

const initialForm = {
  nome: '',
  matricula: '',
  local: '',
  cargo: '',
}

export function PessoasPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [data, setData] = useState([])
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

  return (
    <div className="stack">
      <PageHeader
        title="Cadastro de pessoas"
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

      <section className="card">
        <header className="card__header">
          <h2>Lista de pessoas</h2>
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && data.length === 0 ? <p className="feedback">Nenhuma pessoa cadastrada ainda.</p> : null}
        {data.length > 0 ? (
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
                {data.map((pessoa) => (
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







