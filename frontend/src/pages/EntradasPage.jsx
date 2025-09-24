import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  materialId: '',
  quantidade: '',
  dataEntrada: '',
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
        title="Entradas de materiais"
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

      <section className="card">
        <header className="card__header">
          <h2>Historico de entradas</h2>
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
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





