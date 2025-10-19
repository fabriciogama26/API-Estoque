import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { EntryIcon } from '../components/icons.jsx'
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
  materialId: '',
  centroCusto: '',
  dataInicio: '',
  dataFim: '',
}

const buildEntradasQuery = (filters) => {
  const query = {}
  if (filters.materialId) {
    query.materialId = filters.materialId
  }
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
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
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState(filterInitial)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (params = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const [materiaisData, entradasData] = await Promise.all([
        api.materiais.list(),
        api.entradas.list(buildEntradasQuery(params)),
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
    load(filterInitial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        centroCusto: form.centroCusto.trim(),
        dataEntrada: form.dataEntrada || undefined,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      await api.entradas.create(payload)
      setForm(initialForm)
      await load(filters)
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
    load(filters)
  }

  const handleFilterClear = () => {
    setFilters({ ...filterInitial })
    load(filterInitial)
  }

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [materiais])

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
            <span>Centro de custo*</span>
            <input
              name="centroCusto"
              value={form.centroCusto}
              onChange={handleChange}
              required
              placeholder="Ex: CC-OPER"
            />
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
          <span>Centro de custo</span>
          <input name="centroCusto" value={filters.centroCusto} onChange={handleFilterChange} placeholder="Ex: CC-OPER" />
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
          <button type="button" className="button button--ghost" onClick={() => load(filters)} disabled={isLoading}>
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
                  <th>Quantidade</th>
                  <th>Centro de custo</th>
                  <th>Valor total</th>
                  <th>Data</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((entrada) => {
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
                      <td>{entrada.centroCusto || '-'}</td>
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


