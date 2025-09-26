import { Fragment, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/MateriaisPage.css'

const initialForm = {
  nome: '',
  fabricante: '',
  validadeDias: '',
  ca: '',
  valorUnitario: '',
}

const filterInitial = {
  termo: '',
  status: 'todos',
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
  const [filters, setFilters] = useState(filterInitial)
  const [materiais, setMateriais] = useState([])
  const [histories, setHistories] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingMaterial, setEditingMaterial] = useState(null)

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
      const valorUnitarioNumber = Number(form.valorUnitario.replace(/\D/g, '')) / 100 || 0
      const basePayload = {
        nome: form.nome.trim(),
        fabricante: form.fabricante.trim(),
        validadeDias: Number(form.validadeDias),
        ca: form.ca,
        valorUnitario: valorUnitarioNumber,
      }
      const usuario = user?.name || user?.username || 'sistema'
      if (editingMaterial) {
        await api.materiais.update(editingMaterial.id, {
          ...basePayload,
          usuarioResponsavel: usuario,
        })
      } else {
        await api.materiais.create({
          ...basePayload,
          usuarioCadastro: usuario,
        })
      }
      cancelEdit()
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

  const startEdit = (material) => {
    setEditingMaterial(material)
    setForm({
      nome: material.nome,
      fabricante: material.fabricante,
      validadeDias: String(material.validadeDias ?? ''),
      ca: material.ca || '',
      valorUnitario: formatCurrency(material.valorUnitario),
    })
  }

  const cancelEdit = () => {
    setEditingMaterial(null)
    setForm(initialForm)
  }

  const materiaisFiltrados = useMemo(() => {
    const termo = filters.termo.trim().toLowerCase()

    return materiais.filter((material) => {
      if (filters.status === 'ativos' && material.ativo === false) {
        return false
      }

      if (filters.status === 'inativos' && material.ativo !== false) {
        return false
      }

      if (!termo) {
        return true
      }

      const alvo = [
        material.nome || '',
        material.fabricante || '',
        material.ca || '',
      ]
        .join(' ')
        .toLowerCase()

      return alvo.includes(termo)
    })
  }, [materiais, filters])

  const materiaisOrdenados = useMemo(
    () => materiaisFiltrados.slice().sort((a, b) => a.nome.localeCompare(b.nome)),
    [materiaisFiltrados],
  )

  return (
    <div className="stack">
      <PageHeader
        icon={<MaterialIcon size={28} />}
        title="Materiais"
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
            <span>CA</span>
            <input name="ca" value={form.ca} onChange={handleChange} placeholder="12345" inputMode="numeric" />
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
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : editingMaterial ? 'Salvar alteracoes' : 'Salvar material'}
          </button>
          {editingMaterial ? (
            <button type="button" className="button button--ghost" onClick={cancelEdit} disabled={isSaving}>
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>

      <form className="form form--inline" onSubmit={handleFilterSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleFilterChange}
            placeholder="EPI, fabricante ou CA"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="todos">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--ghost">Aplicar</button>
          <button type="button" className="button button--ghost" onClick={handleFilterClear}>Limpar</button>
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
                          <div className="data-table__actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => startEdit(material)}
                              disabled={editingMaterial?.id === material.id || isSaving}
                            >
                              {editingMaterial?.id === material.id ? 'Editando' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => toggleHistory(material.id)}
                            >
                              {historyOpen ? 'Ocultar historico' : 'Ver historico'}
                            </button>
                          </div>
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

