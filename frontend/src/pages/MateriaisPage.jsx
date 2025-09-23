import { Fragment, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import './MateriaisPage.css'

const initialForm = {
  nome: '',
  fabricante: '',
  validadeDias: '',
  ca: '',
  valorUnitario: '',
  estoqueMinimo: '',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

export function MateriaisPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [materiais, setMateriais] = useState([])
  const [histories, setHistories] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const items = await api.materiais.list()
      setMateriais(items ?? [])
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

    if (name === 'ca') {
      const digits = value.replace(/\D/g, '')
      setForm((prev) => ({ ...prev, ca: digits }))
      return
    }

    if (name === 'valorUnitario') {
      const digits = value.replace(/\D/g, '')
      const formatted = digits
        ? (Number(digits) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : ''
      setForm((prev) => ({ ...prev, valorUnitario: formatted }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const valorUnitarioNumber = Number(form.valorUnitario.replace(/\D/g, '')) / 100 || 0
      const payload = {
        nome: form.nome.trim(),
        fabricante: form.fabricante.trim(),
        validadeDias: Number(form.validadeDias),
        ca: form.ca,
        valorUnitario: valorUnitarioNumber,
        estoqueMinimo: form.estoqueMinimo ? Number(form.estoqueMinimo) : undefined,
        usuarioCadastro: user?.name || user?.username || 'sistema',
      }
      await api.materiais.create(payload)
      setForm(initialForm)
      setHistories({})
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleHistory = async (materialId) => {
    if (!histories[materialId]) {
      try {
        const data = await api.materiais.priceHistory(materialId)
        setHistories((prev) => ({ ...prev, [materialId]: data ?? [] }))
      } catch (err) {
        setError(err.message)
      }
    } else {
      setHistories((prev) => {
        const next = { ...prev }
        delete next[materialId]
        return next
      })
    }
  }

  const materiaisOrdenados = useMemo(() => (
    materiais.slice().sort((a, b) => a.nome.localeCompare(b.nome))
  ), [materiais])

  return (
    <div className="stack">
      <PageHeader
        title="Cadastro de materiais"
        subtitle="Cadastre EPIs com validade, CA e mantenha historico de precos."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field">
            <span>EPI*</span>
            <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Capacete" />
          </label>
          <label className="field">
            <span>Fabricante*</span>
            <input name="fabricante" value={form.fabricante} onChange={handleChange} required placeholder="3M" />
          </label>
          <label className="field">
            <span>Validade (dias)*</span>
            <input type="number" min="1" name="validadeDias" value={form.validadeDias} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>CA*</span>
            <input name="ca" value={form.ca} onChange={handleChange} required placeholder="12345" inputMode="numeric" />
          </label>
          <label className="field">
            <span>Valor unitario*</span>
            <input
              name="valorUnitario"
              value={form.valorUnitario}
              onChange={handleChange}
              placeholder="R$ 0,00"
              inputMode="decimal"
              required
            />
          </label>
          <label className="field">
            <span>Estoque minimo</span>
            <input type="number" min="0" name="estoqueMinimo" value={form.estoqueMinimo} onChange={handleChange} placeholder="0" />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar material'}
          </button>
        </div>
      </form>

      <section className="card">
        <header className="card__header">
          <h2>Materiais cadastrados</h2>
          <button type="button" className="button button--ghost" onClick={load} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && materiaisOrdenados.length === 0 ? <p className="feedback">Nenhum material cadastrado.</p> : null}
        {materiaisOrdenados.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>CA</th>
                  <th>Validade (dias)</th>
                  <th>Valor unitario</th>
                  <th>Estoque minimo</th>
                  <th>Registrado por</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {materiaisOrdenados.map((material) => {
                  const historyOpen = Boolean(histories[material.id])
                  return (
                    <Fragment key={material.id}>
                      <tr>
                        <td>
                          <strong>{material.nome}</strong>
                          <p className="data-table__muted">{material.fabricante}</p>
                        </td>
                        <td>{material.ca}</td>
                        <td>{material.validadeDias}</td>
                        <td>{formatCurrency(material.valorUnitario)}</td>
                        <td>{material.estoqueMinimo}</td>
                        <td>{material.usuarioCadastro || '-'}</td>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => toggleHistory(material.id)}
                          >
                            {historyOpen ? 'Ocultar historico' : 'Ver historico'}
                          </button>
                        </td>
                      </tr>
                      {historyOpen ? (
                        <tr className="data-table__history">
                          <td colSpan={7}>
                            {histories[material.id].length === 0 ? (
                              <p className="feedback">Nenhum historico registrado.</p>
                            ) : (
                              <ul className="history-list">
                                {histories[material.id].map((registro) => (
                                  <li key={registro.id}>
                                    <span>{new Date(registro.dataRegistro).toLocaleString('pt-BR')}</span>
                                    <span>{formatCurrency(registro.valorUnitario)}</span>
                                    <span>{registro.usuarioResponsavel}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
