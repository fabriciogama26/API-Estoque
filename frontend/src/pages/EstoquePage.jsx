import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { api } from '../services/api.js'

const initialFilters = {
  ano: '',
  mes: '',
  termo: '',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function normalizarTermo(termo) {
  return termo ? termo.trim().toLowerCase() : ''
}

function combinaComTermo(material = {}, termoNormalizado = '') {
  if (!termoNormalizado) {
    return true
  }
  const alvo = `${material.nome || ''} ${material.fabricante || ''}`.toLowerCase()
  return alvo.includes(termoNormalizado)
}

export function EstoquePage() {
  const [filters, setFilters] = useState(initialFilters)
  const [estoque, setEstoque] = useState({ itens: [], alertas: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (params = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.estoque.current({
        ano: params.ano || undefined,
        mes: params.mes || undefined,
      })
      setEstoque({ itens: data?.itens ?? [], alertas: data?.alertas ?? [] })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(initialFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const handleClear = () => {
    setFilters(initialFilters)
    load(initialFilters)
  }

  const termoNormalizado = useMemo(() => normalizarTermo(filters.termo), [filters.termo])

  const itensFiltrados = useMemo(
    () => estoque.itens.filter((item) => combinaComTermo(item, termoNormalizado)),
    [estoque.itens, termoNormalizado],
  )

  const alertasFiltrados = useMemo(
    () => estoque.alertas.filter((item) => combinaComTermo(item, termoNormalizado)),
    [estoque.alertas, termoNormalizado],
  )

  const totalValor = itensFiltrados.reduce((acc, item) => acc + Number(item.valorTotal ?? 0), 0)

  return (
    <div className="stack">
      <PageHeader
        title="Estoque atual"
        subtitle="Consulte saldo por material, valor total e alertas de estoque minimo."
      />

      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Ano</span>
          <input type="number" name="ano" value={filters.ano} onChange={handleChange} placeholder="2025" />
        </label>
        <label className="field">
          <span>Mes</span>
          <input type="number" min="1" max="12" name="mes" value={filters.mes} onChange={handleChange} placeholder="1" />
        </label>
        <label className="field">
          <span>Material ou fabricante</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleChange}
            placeholder="ex: bota, 3M, luva"
          />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isLoading}>
            {isLoading ? 'Filtrando...' : 'Aplicar filtros'}
          </button>
          <button type="button" className="button button--ghost" onClick={handleClear}>
            Limpar filtros
          </button>
        </div>
      </form>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <section className="card">
        <header className="card__header">
          <h2>Alertas de estoque</h2>
        </header>
        {alertasFiltrados.length ? (
          <ul className="alert-list">
            {alertasFiltrados.map((alerta) => {
              const deficit = Math.max(Number(alerta.estoqueMinimo ?? 0) - Number(alerta.estoqueAtual ?? 0), 0)
              return (
                <li key={alerta.materialId} className="alert-list__item">
                  <span className="badge badge--alert">{alerta.nome?.split(' ')[0] || 'Material'}</span>
                  <span>
                    Estoque atual: <strong>{alerta.estoqueAtual}</strong>
                    {' '}| Minimo: <strong>{alerta.estoqueMinimo}</strong>
                    {deficit > 0 ? <span className="alert-list__deficit"> - faltam {deficit}</span> : null}
                  </span>
                  <span className="alert-list__material">{alerta.nome} - {alerta.fabricante}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="feedback">Nenhum alerta no periodo.</p>
        )}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Resumo</h2>
          <span>Total em estoque: {formatCurrency(totalValor)}</span>
        </header>
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Itens</h2>
        </header>
        {itensFiltrados.length === 0 ? <p className="feedback">Sem materiais cadastrados ou filtrados.</p> : null}
        <div className="list">
          {itensFiltrados.map((item) => (
            <article key={item.materialId} className={`list__item${item.alerta ? ' list__item--alert' : ''}`}>
              <header className="list__item-header">
                <div>
                  <h3>{item.nome}</h3>
                  <p>{item.fabricante}</p>
                </div>
                <div className="list__item-meta">
                  <span>Quantidade: {item.quantidade}</span>
                  <span>Valor unitario: {formatCurrency(item.valorUnitario)}</span>
                  <span>Valor total: {formatCurrency(item.valorTotal)}</span>
                  <span>Estoque minimo: {item.estoqueMinimo}</span>
                </div>
              </header>
              <div className="list__item-body">
                <span>Validade (dias): {item.validadeDias}</span>
                <span>CA: {item.ca}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

