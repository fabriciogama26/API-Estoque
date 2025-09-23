import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  pessoaId: '',
  materialId: '',
  quantidade: '',
  dataEntrega: '',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

export function SaidasPage() {
  const { user } = useAuth()
  const [pessoas, setPessoas] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [form, setForm] = useState(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [pessoasData, materiaisData, saidasData] = await Promise.all([
        api.pessoas.list(),
        api.materiais.list(),
        api.saidas.list(),
      ])
      setPessoas(pessoasData ?? [])
      setMateriais(materiaisData ?? [])
      setSaidas(saidasData ?? [])
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
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: Number(form.quantidade),
        dataEntrega: form.dataEntrega || undefined,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      await api.saidas.create(payload)
      setForm(initialForm)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const pessoasMap = useMemo(() => {
    const map = new Map()
    pessoas.forEach((item) => map.set(item.id, item))
    return map
  }, [pessoas])

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => map.set(item.id, { ...item, valorUnitario: Number(item.valorUnitario ?? 0) }))
    return map
  }, [materiais])

  return (
    <div className="stack">
      <PageHeader
        title="Saidas de materiais"
        subtitle="Controle entregas de EPIs garantindo disponibilidade e rastreabilidade."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field">
            <span>Pessoa*</span>
            <select name="pessoaId" value={form.pessoaId} onChange={handleChange} required>
              <option value="">Selecione uma pessoa</option>
              {pessoas.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome} - {pessoa.local}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Material*</span>
            <select name="materialId" value={form.materialId} onChange={handleChange} required>
              <option value="">Selecione um material</option>
              {materiais.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.nome} - {material.fabricante}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>Data de entrega</span>
            <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar saida'}
          </button>
        </div>
      </form>

      <section className="card">
        <header className="card__header">
          <h2>Historico de saidas</h2>
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && saidas.length === 0 ? <p className="feedback">Nenhuma saida registrada.</p> : null}
        {saidas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Pessoa</th>
                  <th>Quantidade</th>
                  <th>Status</th>
                  <th>Data entrega</th>
                  <th>Data troca</th>
                  <th>Valor total</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((saida) => {
                  const pessoa = pessoasMap.get(saida.pessoaId)
                  const material = materiaisMap.get(saida.materialId)
                  const total = (material?.valorUnitario ?? 0) * Number(saida.quantidade ?? 0)

                  return (
                    <tr key={saida.id}>
                      <td>
                        <strong>{material?.nome || 'Material removido'}</strong>
                        <p className="data-table__muted">{material?.fabricante || 'Nao informado'}</p>
                      </td>
                      <td>
                        <strong>{pessoa?.nome || 'Pessoa removida'}</strong>
                        <p className="data-table__muted">{pessoa?.local || 'Nao informado'}</p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>{saida.status}</td>
                      <td>{saida.dataEntrega ? new Date(saida.dataEntrega).toLocaleString('pt-BR') : 'Nao informado'}</td>
                      <td>{saida.dataTroca ? new Date(saida.dataTroca).toLocaleDateString('pt-BR') : 'Nao informado'}</td>
                      <td>{formatCurrency(total)}</td>
                      <td>{saida.usuarioResponsavel || 'Nao informado'}</td>
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
