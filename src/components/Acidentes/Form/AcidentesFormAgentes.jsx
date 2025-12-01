import { useEffect, useMemo, useState } from 'react'
import { AddIcon } from '../../icons.jsx'
import { normalizeText, parseList } from '../../../utils/acidentesUtils.js'

export function AcidentesFormAgentes({
  form,
  onChange,
  agentes = [],
  isLoadingAgentes = false,
  tipos = [],
  isLoadingTipos = false,
  inline = false,
}) {
  const [agenteSelecionado, setAgenteSelecionado] = useState('')
  const [tipoSelecionado, setTipoSelecionado] = useState('')

  const currentAgentes = useMemo(
    () => parseList(form.agentes?.length ? form.agentes : form.agente),
    [form.agentes, form.agente],
  )
  const currentTipos = useMemo(
    () => parseList(form.tipos?.length ? form.tipos : form.tipo),
    [form.tipos, form.tipo],
  )

  useEffect(() => {
    setAgenteSelecionado('')
    setTipoSelecionado('')
  }, [form.agente])

  const agenteOptions = useMemo(() => {
    const map = new Map()
    const addOption = (valor) => {
      const nome = normalizeText(valor)
      if (!nome) {
        return
      }
      const chave = nome.toLocaleLowerCase('pt-BR')
      if (!map.has(chave)) {
        map.set(chave, nome)
      }
    }
    if (Array.isArray(agentes)) {
      agentes.forEach(addOption)
    }
    addOption(form.agente)
    addOption(agenteSelecionado)
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [agentes, agenteSelecionado, form.agente])

  const tipoOptions = useMemo(() => {
    const map = new Map()
    const addOption = (valor) => {
      const nome = normalizeText(valor)
      if (!nome) {
        return
      }
      const chave = nome.toLocaleLowerCase('pt-BR')
      if (!map.has(chave)) {
        map.set(chave, nome)
      }
    }
    if (Array.isArray(tipos)) {
      tipos.forEach(addOption)
    }
    addOption(tipoSelecionado)
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [tipos, tipoSelecionado])

  const updateAgentes = (lista) => {
    const normalizados = lista.map((item) => normalizeText(item)).filter(Boolean)
    const ultimoSelecionado = normalizados[normalizados.length - 1] ?? ''
    onChange({ target: { name: 'agentes', value: normalizados } })
    onChange({ target: { name: 'agente', value: ultimoSelecionado } })
  }

  const updateTipos = (lista) => {
    onChange({ target: { name: 'tipos', value: lista } })
    onChange({ target: { name: 'tipo', value: lista.join('; ') } })
  }

  const adicionarAgenteSelecionado = () => {
    const valor = normalizeText(agenteSelecionado)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentAgentes.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setAgenteSelecionado('')
      return
    }
    updateAgentes([...currentAgentes, valor])
    setAgenteSelecionado('')
  }

  const adicionarTipoSelecionado = () => {
    const valor = normalizeText(tipoSelecionado)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentTipos.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setTipoSelecionado('')
      return
    }
    updateTipos([...currentTipos, valor])
    setTipoSelecionado('')
  }

  const removerAgente = (agenteParaRemover) => {
    const chave = normalizeText(agenteParaRemover).toLocaleLowerCase('pt-BR')
    const atualizadas = currentAgentes.filter(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') !== chave,
    )
    updateAgentes(atualizadas)
  }

  const removerTipo = (tipoParaRemover) => {
    const chave = normalizeText(tipoParaRemover).toLocaleLowerCase('pt-BR')
    const atualizadas = currentTipos.filter(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') !== chave,
    )
    updateTipos(atualizadas)
  }

  const podeAdicionarAgente = (() => {
    const valor = normalizeText(agenteSelecionado)
    if (!valor) {
      return false
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    return !currentAgentes.some(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave,
    )
  })()

  const podeAdicionarTipo = (() => {
    const valor = normalizeText(tipoSelecionado)
    if (!valor) {
      return false
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    return !currentTipos.some(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave,
    )
  })()

  const agentePlaceholder = isLoadingAgentes ? 'Carregando agentes...' : 'Selecione o agente'
  const tipoPlaceholder = isLoadingTipos
    ? 'Carregando tipos...'
    : currentAgentes.length
      ? 'Selecione o tipo'
      : 'Selecione o agente primeiro'

  const noAgentesDisponiveis = agenteOptions.length === 0
  const noTiposDisponiveis = tipoOptions.length === 0
  const shouldDisableAgente = (isLoadingAgentes && noAgentesDisponiveis) || noAgentesDisponiveis
  const shouldDisableTipoBase = !currentAgentes.length && !currentTipos.length
  const shouldDisableTipo =
    shouldDisableTipoBase ||
    (isLoadingTipos && noTiposDisponiveis) ||
    (noTiposDisponiveis && !currentTipos.length)

  const content = (
    <>
      <label className="field">
        <span>Agente <span className="asterisco">*</span></span>
        <div className="multi-select">
          <select
            name="agenteSelecionado"
            value={agenteSelecionado}
            onChange={(event) => setAgenteSelecionado(event.target.value)}
            required={!currentAgentes.length}
            disabled={shouldDisableAgente}
          >
            <option value="">{agentePlaceholder}</option>
            {agenteOptions.map((agente) => (
              <option key={agente} value={agente}>
                {agente}
              </option>
            ))}
          </select>
          <div className="multi-select__actions">
            <button
              type="button"
              className="icon-button"
              onClick={adicionarAgenteSelecionado}
              disabled={!podeAdicionarAgente || shouldDisableAgente}
              aria-label="Adicionar agente"
              title="Adicionar agente"
            >
              <AddIcon size={16} />
            </button>
          </div>
          <div className="multi-select__chips">
            {currentAgentes.length ? (
              currentAgentes.map((agente) => (
                <button
                  type="button"
                  key={agente}
                  className="chip"
                  onClick={() => {
                    setAgenteSelecionado('')
                    setTipoSelecionado('')
                    removerAgente(agente)
                  }}
                  aria-label={`Remover ${agente}`}
                >
                  {agente} <span aria-hidden="true">x</span>
                </button>
              ))
            ) : (
              <span className="multi-select__placeholder">Nenhum agente selecionado</span>
            )}
          </div>
        </div>
      </label>

      <label className="field">
        <span>Tipo <span className="asterisco">*</span></span>
        <div className="multi-select">
          <select
            name="tipoSelecionado"
            value={tipoSelecionado}
            onChange={(event) => setTipoSelecionado(event.target.value)}
            required={!currentTipos.length}
            disabled={shouldDisableTipo}
          >
            <option value="">{tipoPlaceholder}</option>
            {tipoOptions.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
          <div className="multi-select__actions">
            <button
              type="button"
              className="icon-button"
              onClick={adicionarTipoSelecionado}
              disabled={!podeAdicionarTipo || shouldDisableTipo}
              aria-label="Adicionar tipo"
              title="Adicionar tipo"
            >
              <AddIcon size={16} />
            </button>
          </div>
          <div className="multi-select__chips">
            {currentTipos.length ? (
              currentTipos.map((tipo) => (
                <button
                  type="button"
                  key={tipo}
                  className="chip"
                  onClick={() => {
                    setTipoSelecionado('')
                    removerTipo(tipo)
                  }}
                  aria-label={`Remover ${tipo}`}
                >
                  {tipo} <span aria-hidden="true">x</span>
                </button>
              ))
            ) : (
              <span className="multi-select__placeholder">Nenhum tipo selecionado</span>
            )}
          </div>
        </div>
      </label>
    </>
  )

  if (inline) {
    return content
  }

  return <div className="form__grid form__grid--two">{content}</div>
}
