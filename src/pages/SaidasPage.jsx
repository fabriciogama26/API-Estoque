import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ExitIcon } from '../components/icons.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  pessoaId: '',
  materialId: '',
  quantidade: '',
  centroCusto: '',
  centroServico: '',
  dataEntrega: '',
}

const filterInitial = {
  termo: '',
  pessoaId: '',
  materialId: '',
  centroCusto: '',
  centroServico: '',
  status: '',
  dataInicio: '',
  dataFim: '',
}

const buildSaidasQuery = (filters) => {
  const query = {}
  if (filters.pessoaId) {
    query.pessoaId = filters.pessoaId
  }
  if (filters.materialId) {
    query.materialId = filters.materialId
  }
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
  }
  const centroServico = filters.centroServico?.trim()
  if (centroServico) {
    query.centroServico = centroServico
  }
  const status = filters.status?.trim()
  if (status) {
    query.status = status
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

export function SaidasPage() {
  const { user } = useAuth()
  const [Nomes, setNomes] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState(filterInitial)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (params = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const [NomesData, materiaisData, saidasData] = await Promise.all([
        api.pessoas.list(),
        api.materiais.list(),
        api.saidas.list(buildSaidasQuery(params)),
      ])
      setNomes(NomesData ?? [])
      setMateriais(materiaisData ?? [])
      setSaidas(saidasData ?? [])
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
    if (name === 'pessoaId') {
      setForm((prev) => {
        const Nome = NomesMap.get(value)
        return {
          ...prev,
          pessoaId: value,
          centroServico: Nome?.centroServico ?? Nome?.local ?? prev.centroServico,
        }
      })
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.dataEntrega) {
      setError('Informe a data de entrega.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: Number(form.quantidade),
        centroCusto: form.centroCusto.trim(),
        centroServico: form.centroServico.trim(),
        dataEntrega: form.dataEntrega,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      await api.saidas.create(payload)
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

  const NomesMap = useMemo(() => {
    const map = new Map()
    Nomes.forEach((item) => map.set(item.id, item))
    return map
  }, [Nomes])

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => map.set(item.id, { ...item, valorUnitario: Number(item.valorUnitario ?? 0) }))
    return map
  }, [materiais])

  const statusOptions = useMemo(() => {
    const values = new Set()
    saidas.forEach((item) => {
      if (item?.status) {
        values.add(item.status)
      }
    })
    return Array.from(values).sort()
  }, [saidas])

  return (
    <div className="stack">
      <PageHeader
        icon={<ExitIcon size={28} />}
        title="Saidas"
        subtitle="Controle entregas de EPIs garantindo disponibilidade e rastreabilidade."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field">
            <span>Nome*</span>
            <select name="pessoaId" value={form.pessoaId} onChange={handleChange} required>
              <option value="">Selecione uma Nome</option>
              {Nomes.map((Nome) => (
                <option key={Nome.id} value={Nome.id}>
                  {Nome.nome} - {Nome.local}
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
            <span>Centro de servico*</span>
            <input
              name="centroServico"
              value={form.centroServico}
              onChange={handleChange}
              required
              placeholder="Ex: Operacao"
            />
          </label>
        <label className="field">
          <span>Data de entrega*</span>
          <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} required />
        </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar saida'}
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
            placeholder="Nome, material ou responsavel"
          />
        </label>
        <label className="field">
          <span>Nome</span>
          <select name="pessoaId" value={filters.pessoaId} onChange={handleFilterChange}>
            <option value="">Todas</option>
            {Nomes.map((Nome) => (
              <option key={Nome.id} value={Nome.id}>
                {Nome.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Material</span>
          <select name="materialId" value={filters.materialId} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {materiais.map((material) => (
              <option key={material.id} value={material.id}>
                {material.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Centro de custo</span>
          <input
            name="centroCusto"
            value={filters.centroCusto}
            onChange={handleFilterChange}
            placeholder="Ex: CC-OPER"
          />
        </label>
        <label className="field">
          <span>Centro de servico</span>
          <input
            name="centroServico"
            value={filters.centroServico}
            onChange={handleFilterChange}
            placeholder="Ex: Operacao"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
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
          <h2>Historico de saidas</h2>
          <button type="button" className="button button--ghost" onClick={() => load(filters)} disabled={isLoading}>
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
                  <th>Nome</th>
                  <th>Quantidade</th>
                  <th>Centro de custo</th>
                  <th>Centro de servico</th>
                  <th>Status</th>
                  <th>Data entrega</th>
                  <th>Data troca</th>
                  <th>Valor total</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((saida) => {
                  const Nome = NomesMap.get(saida.pessoaId)
                  const material = materiaisMap.get(saida.materialId)
                  const total = (material?.valorUnitario ?? 0) * Number(saida.quantidade ?? 0)

                  return (
                    <tr key={saida.id}>
                      <td>
                        <strong>{material?.nome || 'Material removido'}</strong>
                        <p className="data-table__muted">{material?.fabricante || 'Nao informado'}</p>
                      </td>
                      <td>
                        <strong>{Nome?.nome || 'Nome removida'}</strong>
                        <p className="data-table__muted">{(Nome?.centroServico ?? Nome?.local) || 'Nao informado'}</p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>{saida.centroCusto || '-'}</td>
                      <td>{saida.centroServico || '-'}</td>
                      <td>{saida.status || '-'}</td>
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

























