import { useEffect, useMemo, useState } from 'react'
import { AddIcon } from '../../icons.jsx'
import { normalizeAgenteKey, normalizeText, parseList } from '../../../utils/acidentesUtils.js'
import { AgenteHelpButton } from './AgenteHelpButton.jsx'

export function AcidentesFormAgentes({
  form,
  onChange,
  agentes = [],
  isLoadingAgentes = false,
  tipos = [],
  isLoadingTipos = false,
  lesoes = [],
  isLoadingLesoes = false,
  inline = false,
}) {
  const [tipoSelecionado, setTipoSelecionado] = useState('')
  const [lesaoSelecionada, setLesaoSelecionada] = useState('')

  const agenteOptions = useMemo(() => {
    const map = new Map()
    const buildKey = (nome) => normalizeText(nome).toLocaleLowerCase('pt-BR')
    const addOption = (item) => {
      if (!item) {
        return
      }
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (!nome) {
          return
        }
        const chave = buildKey(nome)
        const existente = map.get(chave)
        if (!existente) {
          map.set(chave, { id: null, nome, label: nome, value: nome })
        }
        return
      }
      const nome = normalizeText(item.nome ?? item.label ?? item.value)
      if (!nome) {
        return
      }
      const label = normalizeText(item.label) || nome
      const id = item.id ?? item.agenteId ?? null
      const chave = buildKey(nome)
      const existente = map.get(chave)
      if (!existente || (!existente.id && id)) {
        map.set(chave, { id, nome, label, value: String(id ?? nome) })
      }
    }
    if (Array.isArray(agentes)) {
      agentes.forEach(addOption)
    }
    if (form.agenteId) {
      addOption({ id: form.agenteId, nome: form.agente || String(form.agenteId) })
    } else {
      addOption(form.agente)
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [agentes, form.agente, form.agenteId])

  const currentAgenteValue = useMemo(() => {
    const agenteId = String(form.agenteId ?? '').trim()
    if (agenteId) {
      return agenteId
    }
    const nome = normalizeText(form.agente)
    if (!nome) {
      return ''
    }
    const alvo = normalizeAgenteKey(nome)
    const match = agenteOptions.find((item) => normalizeAgenteKey(item.nome) === alvo)
    return match ? match.value : ''
  }, [agenteOptions, form.agente, form.agenteId])

  const fallbackTipos = useMemo(
    () => parseList(form.tipos?.length ? form.tipos : form.tipo),
    [form.tipos, form.tipo],
  )

  const tipoOptions = useMemo(() => {
    const map = new Map()
    const buildKey = (nome) => normalizeText(nome).toLocaleLowerCase('pt-BR')
    const addOption = (item) => {
      if (!item) {
        return
      }
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (!nome) {
          return
        }
        const chave = buildKey(nome)
        const existente = map.get(chave)
        if (!existente) {
          map.set(chave, { id: null, nome, label: nome, value: nome })
        }
        return
      }
      const nome = normalizeText(item.nome ?? item.label ?? item.value)
      if (!nome) {
        return
      }
      const label = normalizeText(item.label) || nome
      const id = item.id ?? null
      const chave = buildKey(nome)
      const existente = map.get(chave)
      if (!existente || (!existente.id && id)) {
        map.set(chave, { id, nome, label, value: String(id ?? nome) })
      }
    }
    if (Array.isArray(tipos)) {
      tipos.forEach(addOption)
    }
    fallbackTipos.forEach(addOption)
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [fallbackTipos, tipos])

  const tipoOptionsById = useMemo(() => {
    const map = new Map()
    tipoOptions.forEach((option) => {
      if (option.id) {
        map.set(String(option.id), option)
      }
    })
    return map
  }, [tipoOptions])

  const currentTiposIds = useMemo(
    () => (Array.isArray(form.tiposIds) ? form.tiposIds.filter(Boolean) : []),
    [form.tiposIds],
  )

  const currentTiposSelecionados = useMemo(() => {
    if (currentTiposIds.length) {
      return currentTiposIds.map((id, index) => {
        const option = tipoOptionsById.get(String(id))
        const fallbackNome = fallbackTipos[index] ?? ''
        const nome = option?.nome ?? fallbackNome ?? ''
        const label = (option?.label ?? nome) || String(id)
        return {
          id: String(id),
          nome: nome || label,
          label,
        }
      })
    }
    return fallbackTipos.map((nome) => ({ id: nome, nome, label: nome }))
  }, [currentTiposIds, fallbackTipos, tipoOptionsById])

  const fallbackLesoes = useMemo(
    () =>
      Array.isArray(form.lesoes) && form.lesoes.length
        ? form.lesoes
        : form.lesao
          ? [form.lesao]
          : [],
    [form.lesao, form.lesoes],
  )

  const lesaoSelectOptions = useMemo(() => {
    const map = new Map()
    const buildKey = (nome) => normalizeText(nome).toLocaleLowerCase('pt-BR')
    const addOption = (item) => {
      if (!item) {
        return
      }
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (!nome) {
          return
        }
        const chave = buildKey(nome)
        const existente = map.get(chave)
        if (!existente) {
          map.set(chave, { id: null, nome, label: nome, value: nome })
        }
        return
      }
      const nome = normalizeText(item.nome ?? item.label ?? item.value)
      if (!nome) {
        return
      }
      const label = normalizeText(item.label) || nome
      const id = item.id ?? null
      const chave = buildKey(nome)
      const existente = map.get(chave)
      if (!existente || (!existente.id && id)) {
        map.set(chave, { id, nome, label, value: String(id ?? nome) })
      }
    }
    if (Array.isArray(lesoes)) {
      lesoes.forEach(addOption)
    }
    fallbackLesoes.forEach(addOption)
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [fallbackLesoes, lesoes])

  const lesaoOptionsById = useMemo(() => {
    const map = new Map()
    lesaoSelectOptions.forEach((option) => {
      if (option.id) {
        map.set(String(option.id), option)
      }
    })
    return map
  }, [lesaoSelectOptions])

  const currentLesoesIds = useMemo(
    () => (Array.isArray(form.lesoesIds) ? form.lesoesIds.filter(Boolean) : []),
    [form.lesoesIds],
  )

  const currentLesoesSelecionadas = useMemo(() => {
    if (currentLesoesIds.length) {
      return currentLesoesIds.map((id, index) => {
        const option = lesaoOptionsById.get(String(id))
        const fallbackNome = fallbackLesoes[index] ?? ''
        const nome = option?.nome ?? fallbackNome ?? ''
        const label = (option?.label ?? nome) || String(id)
        return {
          id: String(id),
          nome: nome || label,
          label,
        }
      })
    }
    return fallbackLesoes.map((nome) => ({ id: nome, nome, label: nome }))
  }, [currentLesoesIds, fallbackLesoes, lesaoOptionsById])

  useEffect(() => {
    setTipoSelecionado('')
    setLesaoSelecionada('')
  }, [currentAgenteValue])

  useEffect(() => {
    if (tipoSelecionado && !tipoOptions.some((option) => option.value === tipoSelecionado)) {
      setTipoSelecionado('')
    }
  }, [tipoSelecionado, tipoOptions])

  useEffect(() => {
    if (lesaoSelecionada && !lesaoSelectOptions.some((option) => option.value === lesaoSelecionada)) {
      setLesaoSelecionada('')
    }
  }, [lesaoSelecionada, lesaoSelectOptions])

  const updateAgente = (option) => {
    const agenteId = option?.id ?? ''
    const nome = option?.nome ?? ''
    onChange({ target: { name: 'agenteId', value: agenteId } })
    onChange({ target: { name: 'agente', value: nome } })
    onChange({ target: { name: 'agentes', value: nome ? [nome] : [] } })
  }

  const handleAgenteChange = (event) => {
    const value = event.target.value
    if (!value) {
      updateAgente(null)
      return
    }
    const option = agenteOptions.find((item) => item.value === value)
    updateAgente(option ?? { id: value, nome: value, label: value })
  }

  const updateTipos = (lista) => {
    const nomes = lista.map((item) => item.nome).filter(Boolean)
    const ids = lista.map((item) => item.id).filter(Boolean)
    onChange({ target: { name: 'tipos', value: nomes } })
    onChange({ target: { name: 'tipo', value: nomes.join('; ') } })
    onChange({ target: { name: 'tiposIds', value: ids } })
  }

  const updateLesoes = (lista) => {
    const nomes = lista.map((item) => item.nome).filter(Boolean)
    const ids = lista.map((item) => item.id).filter(Boolean)
    onChange({ target: { name: 'lesoes', value: nomes } })
    onChange({ target: { name: 'lesao', value: nomes[0] ?? '' } })
    onChange({ target: { name: 'lesoesIds', value: ids } })
  }

  const adicionarTipoSelecionado = () => {
    const option = tipoOptions.find((item) => item.value === tipoSelecionado)
    if (!option) {
      return
    }
    const id = option.id ?? option.value
    if (currentTiposSelecionados.some((item) => String(item.id) === String(id))) {
      setTipoSelecionado('')
      return
    }
    updateTipos([
      ...currentTiposSelecionados,
      { id: String(id), nome: option.nome, label: option.label },
    ])
    setTipoSelecionado('')
  }

  const adicionarLesaoSelecionada = () => {
    const option = lesaoSelectOptions.find((item) => item.value === lesaoSelecionada)
    if (!option) {
      return
    }
    const id = option.id ?? option.value
    if (currentLesoesSelecionadas.some((item) => String(item.id) === String(id))) {
      setLesaoSelecionada('')
      return
    }
    updateLesoes([
      ...currentLesoesSelecionadas,
      { id: String(id), nome: option.nome, label: option.label },
    ])
    setLesaoSelecionada('')
  }

  const removerTipo = (tipoId) => {
    const atualizadas = currentTiposSelecionados.filter((item) => String(item.id) !== String(tipoId))
    updateTipos(atualizadas)
  }

  const removerLesao = (lesaoId) => {
    const atualizadas = currentLesoesSelecionadas.filter((item) => String(item.id) !== String(lesaoId))
    updateLesoes(atualizadas)
  }

  const classificacoes = Array.isArray(form.classificacoesAgentes) ? form.classificacoesAgentes : []
  const agenteSelecionadoLabel =
    agenteOptions.find((item) => item.value === currentAgenteValue)?.label ||
    form.agente ||
    ''

  const buildRowKey = (row) =>
    [row.agenteId ?? '', row.tipoId ?? '', row.lesaoId ?? ''].join('|')

  const limparSelecao = () => {
    onChange({ target: { name: 'agenteId', value: '' } })
    onChange({ target: { name: 'agente', value: '' } })
    onChange({ target: { name: 'agentes', value: [] } })
    onChange({ target: { name: 'tipos', value: [] } })
    onChange({ target: { name: 'tipo', value: '' } })
    onChange({ target: { name: 'tiposIds', value: [] } })
    onChange({ target: { name: 'lesoes', value: [] } })
    onChange({ target: { name: 'lesao', value: '' } })
    onChange({ target: { name: 'lesoesIds', value: [] } })
    setTipoSelecionado('')
    setLesaoSelecionada('')
  }

  const incluirClassificacao = () => {
    if (!currentAgenteValue) {
      return
    }
    const max = Math.max(currentTiposSelecionados.length, currentLesoesSelecionadas.length)
    if (!max) {
      return
    }
    const novos = []
    for (let index = 0; index < max; index += 1) {
      const tipo = currentTiposSelecionados[index]
      const lesao = currentLesoesSelecionadas[index]
      const row = {
        agenteId: String(currentAgenteValue),
        agenteNome: agenteSelecionadoLabel,
        tipoId: tipo?.id ? String(tipo.id) : null,
        tipoNome: tipo?.label ?? tipo?.nome ?? '',
        lesaoId: lesao?.id ? String(lesao.id) : null,
        lesaoNome: lesao?.label ?? lesao?.nome ?? '',
      }
      if (!row.tipoId && !row.tipoNome && !row.lesaoId && !row.lesaoNome) {
        continue
      }
      novos.push(row)
    }
    if (!novos.length) {
      return
    }
    const existentes = classificacoes
    const existentesKeys = new Set(existentes.map(buildRowKey))
    const combinadas = [...existentes]
    novos.forEach((row) => {
      const chave = buildRowKey(row)
      if (!existentesKeys.has(chave)) {
        existentesKeys.add(chave)
        combinadas.push(row)
      }
    })
    onChange({ target: { name: 'classificacoesAgentes', value: combinadas } })
    limparSelecao()
  }

  const removerClassificacao = (index) => {
    const atualizadas = classificacoes.filter((_, idx) => idx !== index)
    onChange({ target: { name: 'classificacoesAgentes', value: atualizadas } })
  }

  const agentePlaceholder = isLoadingAgentes ? 'Carregando agentes...' : 'Selecione o agente'
  const tipoPlaceholder = isLoadingTipos
    ? 'Carregando tipos...'
    : currentAgenteValue
      ? 'Selecione o tipo'
      : 'Selecione o agente primeiro'
  const lesaoPlaceholder = isLoadingLesoes
    ? 'Carregando lesoes...'
    : currentAgenteValue
      ? 'Selecione a lesao'
      : 'Selecione o agente primeiro'

  const noAgentesDisponiveis = agenteOptions.length === 0
  const noTiposDisponiveis = tipoOptions.length === 0
  const noLesoesDisponiveis = lesaoSelectOptions.length === 0
  const shouldDisableAgente = (isLoadingAgentes && noAgentesDisponiveis) || noAgentesDisponiveis
  const shouldDisableTipoBase = !currentAgenteValue
  const shouldDisableTipo =
    shouldDisableTipoBase ||
    (isLoadingTipos && noTiposDisponiveis) ||
    (noTiposDisponiveis && !currentTiposSelecionados.length)
  const shouldDisableLesao =
    shouldDisableTipoBase ||
    (isLoadingLesoes && noLesoesDisponiveis) ||
    (noLesoesDisponiveis && !currentLesoesSelecionadas.length)

  const selectedTipoOption = tipoOptions.find((item) => item.value === tipoSelecionado)
  const selectedLesaoOption = lesaoSelectOptions.find((item) => item.value === lesaoSelecionada)
  const podeAdicionarTipo =
    Boolean(selectedTipoOption) &&
    !currentTiposSelecionados.some(
      (item) => String(item.id) === String(selectedTipoOption.id ?? selectedTipoOption.value),
    )
  const podeAdicionarLesao =
    Boolean(selectedLesaoOption) &&
    !currentLesoesSelecionadas.some(
      (item) => String(item.id) === String(selectedLesaoOption.id ?? selectedLesaoOption.value),
    )

  const podeIncluir =
    Boolean(currentAgenteValue) &&
    (currentTiposSelecionados.length > 0 || currentLesoesSelecionadas.length > 0)

  const agenteSelectId = 'acidente-agente-select'

  const content = (
    <>
      <div className="acidentes-form__grid">
        <div className="field">
          <div className="field__label-row">
            <label htmlFor={agenteSelectId} className="field__label-text field__label-text--strong">
              Agente <span className="asterisco">*</span>
            </label>
            <AgenteHelpButton />
          </div>
          <div className="multi-select">
            <select
              id={agenteSelectId}
              name="agenteId"
              value={currentAgenteValue}
              onChange={handleAgenteChange}
              disabled={shouldDisableAgente}
            >
              <option value="">{agentePlaceholder}</option>
              {agenteOptions.map((agente) => (
                <option key={agente.value} value={agente.value}>
                  {agente.label}
                </option>
              ))}
            </select>
            <div className="multi-select__chips">
              {currentAgenteValue ? (
                <span className="chip">
                  {agenteOptions.find((item) => item.value === currentAgenteValue)?.label || form.agente}
                </span>
              ) : (
                <span className="multi-select__placeholder">Nenhum agente selecionado</span>
              )}
            </div>
          </div>
        </div>

        <label className="field">
          <span>Tipo</span>
          <div className="multi-select">
            <select
              name="tipoSelecionado"
              value={tipoSelecionado}
              onChange={(event) => setTipoSelecionado(event.target.value)}
              disabled={shouldDisableTipo}
            >
              <option value="">{tipoPlaceholder}</option>
              {tipoOptions.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
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
              {currentTiposSelecionados.length ? (
                currentTiposSelecionados.map((tipo) => (
                  <button
                    type="button"
                    key={tipo.id}
                    className="chip"
                    onClick={() => removerTipo(tipo.id)}
                    aria-label={`Remover ${tipo.label}`}
                  >
                    {tipo.label} <span aria-hidden="true">x</span>
                  </button>
                ))
              ) : (
                <span className="multi-select__placeholder">Nenhum tipo selecionado</span>
              )}
            </div>
          </div>
        </label>

        <label className="field">
          <span>Lesao</span>
          <div className="multi-select">
            <select
              name="lesaoSelecionada"
              value={lesaoSelecionada}
              onChange={(event) => setLesaoSelecionada(event.target.value)}
              disabled={shouldDisableLesao}
            >
              <option value="">{lesaoPlaceholder}</option>
              {lesaoSelectOptions.map((lesao) => (
                <option key={lesao.value} value={lesao.value}>
                  {lesao.label}
                </option>
              ))}
            </select>
            <div className="multi-select__actions">
              <button
                type="button"
                className="icon-button"
                onClick={adicionarLesaoSelecionada}
                disabled={!podeAdicionarLesao || shouldDisableLesao}
                aria-label="Adicionar lesao"
                title="Adicionar lesao"
              >
                <AddIcon size={16} />
              </button>
            </div>
            <div className="multi-select__chips">
              {currentLesoesSelecionadas.length ? (
                currentLesoesSelecionadas.map((lesao) => (
                  <button
                    type="button"
                    key={lesao.id}
                    className="chip"
                    onClick={() => removerLesao(lesao.id)}
                    aria-label={`Remover ${lesao.label}`}
                  >
                    {lesao.label} <span aria-hidden="true">x</span>
                  </button>
                ))
              ) : (
                <span className="multi-select__placeholder">Nenhuma lesao selecionada</span>
              )}
            </div>
          </div>
        </label>
      </div>

      <div className="form__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={incluirClassificacao}
          disabled={!podeIncluir}
        >
          Incluir
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Tipo</th>
              <th>Lesao</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {classificacoes.length ? (
              classificacoes.map((item, index) => (
                <tr key={`${buildRowKey(item)}-${index}`}>
                  <td>{item.agenteNome ?? ''}</td>
                  <td>{item.tipoNome ?? ''}</td>
                  <td>{item.lesaoNome ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removerClassificacao(index)}
                      aria-label="Remover classificacao"
                      title="Remover classificacao"
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Nenhuma classificacao adicionada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )

  if (inline) {
    return content
  }

  return <div className="form__grid">{content}</div>
}
