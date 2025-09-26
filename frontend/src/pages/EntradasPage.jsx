import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { EntryIcon } from '../components/icons.jsx'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  materialId: '',
  quantidade: '',
  dataEntrada: '',
}

const filterInitial = {
  termo: '',
  materialId: '',
  dataInicio: '',
  dataFim: '',
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
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState(filterInitial)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [materiaisData, entradasData] = await Promise.all([
        api.materiais.list(),
        api.entradas.list(),
      ])
      setMateriais(materiaisData ?? [])
      setEntradas(entradasData ?? [])
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
      const payload = {
        materialId: form.materialId,
        quantidade: Number(form.quantidade),
        dataEntrada: form.dataEntrada || undefined,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      await api.entradas.create(payload)
      setForm(initialForm)
      await load()
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
  }

  const handleFilterClear = () => {
    setFilters(filterInitial)
  }

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [materiais])

  const filteredEntradas = useMemo(() => {
    const termo = filters.termo.trim().toLowerCase()

    return entradas.filter((entrada) => {
      const material = materiaisMap.get(entrada.materialId)

      if (filters.materialId && entrada.materialId !== filters.materialId) {
        return false
      }

      if (filters.dataInicio) {
        const data = entrada.dataEntrada ? new Date(entrada.dataEntrada) : null
        const inicio = new Date(filters.dataInicio)
        inicio.setHours(0, 0, 0, 0)
        if (!data || data < inicio) {
          return false
        }
      }

      if (filters.dataFim) {
        const data = entrada.dataEntrada ? new Date(entrada.dataEntrada) : null
        const fim = new Date(filters.dataFim)
        fim.setHours(23, 59, 59, 999)
        if (!data || data > fim) {
          return false
        }
      }

      if (!termo) {
        return true
      }

      const alvo = [
        material?.nome || '',
        material?.fabricante || '',
        entrada.usuarioResponsavel || '',
      ]
        .join(' ')
        .toLowerCase()

      return alvo.includes(termo)
    })
  }, [entradas, filters, materiaisMap])

  return (
    <div className="stack">
      <PageHeader
        icon={<EntryIcon size={28} />}
        title="Entradas"
        subtitle="Registre novas entradas e mantenha rastreabilidade do estoque."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid">
          <label className="field">
            <span>Material*</span>
            <select name="materialId" value={form.materialId} onChange={handleChange} required>
              <option value="">Selecione um material</option>
              {materiais.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} - {item.fabricante}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>Data da entrada</span>
            <input type="date" name="dataEntrada" value={form.dataEntrada} onChange={handleChange} />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar entrada'}
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
            placeholder="Material, fabricante ou usuario"
          />
        </label>
        <label className="field">
          <span>Material</span>
          <select name="materialId" value={filters.materialId} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {materiais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} - {item.fabricante}
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
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && filteredEntradas.length === 0 ? <p className="feedback">Nenhuma entrada registrada.</p> : null}
        {filteredEntradas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>Valor total</th>
                  <th>Data</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntradas.map((entrada) => {
                  const material = materiaisMap.get(entrada.materialId)
                  const valorUnitario = Number(material?.valorUnitario ?? 0)
                  const total = valorUnitario * Number(entrada.quantidade ?? 0)
                  return (
                    <tr key={entrada.id}>
                      <td>
                        <strong>{material?.nome || 'Material removido'}</strong>
                        <p className="data-table__muted">{material?.fabricante || 'Nao informado'}</p>
                      </td>
                      <td>{entrada.quantidade}</td>
                      <td>{formatCurrency(total)}</td>
                      <td>{entrada.dataEntrada ? new Date(entrada.dataEntrada).toLocaleString('pt-BR') : 'Nao informado'}</td>
                      <td>{entrada.usuarioResponsavel || 'Nao informado'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
