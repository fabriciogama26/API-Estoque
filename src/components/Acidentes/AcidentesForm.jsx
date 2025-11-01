import { useEffect, useState } from 'react'

export function AcidentesForm({
  form,
  onChange,
  onSubmit,
  isSaving,
  editingAcidente,
  onCancel,
  error,
  pessoas = [],
  pessoasError,
  isLoadingPessoas = false,
  locais = [],
  locaisError,
  isLoadingLocais = false,
  agentes = [],
  agentesError,
  isLoadingAgentes = false,
  tipos = [],
  tiposError,
  isLoadingTipos = false,
  lesoes = [],
  lesoesError,
  isLoadingLesoes = false,
  partes = [],
  partesError,
  isLoadingPartes = false,
  centrosServico = [],
}) {
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

  const [lesaoSelecionada, setLesaoSelecionada] = useState('')
  const [parteSelecionada, setParteSelecionada] = useState('')
  const [novoAgente, setNovoAgente] = useState('')
  const [novoTipo, setNovoTipo] = useState('')
  const [agentesAdicionados, setAgentesAdicionados] = useState([])
  const [tiposAdicionados, setTiposAdicionados] = useState([])

  useEffect(() => {
    setTiposAdicionados([])
    setNovoTipo('')
  }, [form.agente])


  const pessoaOptions = (() => {
    const map = new Map()
    if (Array.isArray(pessoas)) {
      pessoas.forEach((pessoa) => {
        const value =
          pessoa?.matricula !== undefined && pessoa?.matricula !== null
            ? String(pessoa.matricula)
            : ''
        const nome = normalizeText(pessoa?.nome) || 'Sem nome'
        if (!value) {
          return
        }
        if (!map.has(value)) {
          map.set(value, `${value} - ${nome}`)
        }
      })
    }
    const matriculaAtual = normalizeText(form.matricula)
    if (matriculaAtual && !map.has(matriculaAtual)) {
      const labelNome = normalizeText(form.nome) || 'Sem nome'
      map.set(matriculaAtual, `${matriculaAtual} - ${labelNome}`)
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  })()

  const agenteOptions = (() => {
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
    agentesAdicionados.forEach(addOption)
    if (Array.isArray(agentes)) {
      agentes.forEach(addOption)
    }
    addOption(form.agente)
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  })()

  const tipoOptions = (() => {
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
    tiposAdicionados.forEach(addOption)
    if (Array.isArray(tipos)) {
      tipos.forEach(addOption)
    }
    addOption(form.tipo)
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  })()

  const lesaoOptions = Array.isArray(lesoes) ? lesoes : []
  const parteOptions = Array.isArray(partes) ? partes : []

  const currentLesoes =
    Array.isArray(form.lesoes) && form.lesoes.length
      ? form.lesoes
      : form.lesao
        ? [form.lesao]
        : []

  const currentPartes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas
    : form.parteLesionada
      ? [form.parteLesionada]
      : []

  const lesaoSelectOptions = (() => {
    const map = new Map()
    lesaoOptions.forEach((item) => {
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: nome })
        }
        return
      }
      if (item && typeof item === 'object') {
        const nome = normalizeText(item.nome ?? item.label)
        const label = normalizeText(item.label) || nome
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: label || nome })
        }
      }
    })
    currentLesoes.forEach((lesao) => {
      const nome = normalizeText(lesao)
      if (nome && !map.has(nome.toLowerCase())) {
        map.set(nome.toLowerCase(), { value: nome, label: nome })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  })()

  const parteSelectOptions = (() => {
    const map = new Map()
    parteOptions.forEach((item) => {
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: nome })
        }
        return
      }
      if (item && typeof item === 'object') {
        const nome = normalizeText(item.nome ?? item.label)
        const label = normalizeText(item.label) || nome
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: label || nome })
        }
      }
    })
    currentPartes.forEach((parte) => {
      const nome = normalizeText(parte)
      if (nome && !map.has(nome.toLowerCase())) {
        map.set(nome.toLowerCase(), { value: nome, label: nome })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  })()

  useEffect(() => {
    if (
      lesaoSelecionada &&
      !lesaoSelectOptions.some((option) => option.value === lesaoSelecionada)
    ) {
      setLesaoSelecionada('')
    }
  }, [lesaoSelecionada, lesaoSelectOptions])

  useEffect(() => {
    if (
      parteSelecionada &&
      !parteSelectOptions.some((option) => option.value === parteSelecionada)
    ) {
      setParteSelecionada('')
    }
  }, [parteSelecionada, parteSelectOptions])

  const centroServicoOptions = Array.from(
    new Set([...(centrosServico || []), form.centroServico].map(normalizeText).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const localOptions = Array.from(
    new Set([...(locais || []), form.local].map(normalizeText).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const updateLesoes = (lista) => {
    onChange({ target: { name: 'lesoes', value: lista } })
    onChange({ target: { name: 'lesao', value: lista[0] ?? '' } })
  }

  const updatePartes = (lista) => {
    onChange({ target: { name: 'partesLesionadas', value: lista } })
  }

  const adicionarNovoAgente = () => {
    const valor = normalizeText(novoAgente)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    const listaAtual = [
      ...agentesAdicionados,
      ...(Array.isArray(agentes) ? agentes : []),
      form.agente,
    ]
    const jaExiste = listaAtual.some(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave,
    )
    if (!jaExiste) {
      setAgentesAdicionados((prev) => [...prev, valor])
    }
    onChange({ target: { name: 'agente', value: valor } })
    setNovoAgente('')
  }

  const adicionarNovoTipo = () => {
    const valor = normalizeText(novoTipo)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    const listaAtual = [
      ...tiposAdicionados,
      ...(Array.isArray(tipos) ? tipos : []),
      form.tipo,
    ]
    const jaExiste = listaAtual.some(
      (item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave,
    )
    if (!jaExiste) {
      setTiposAdicionados((prev) => [...prev, valor])
    }
    onChange({ target: { name: 'tipo', value: valor } })
    setNovoTipo('')
  }

  const removerLesao = (lesaoParaRemover) => {
    const atualizadas = currentLesoes.filter((lesao) => lesao !== lesaoParaRemover)
    updateLesoes(atualizadas)
  }

  const removerParte = (parteParaRemover) => {
    const atualizadas = currentPartes.filter((parte) => parte !== parteParaRemover)
    updatePartes(atualizadas)
  }

  const handleLesoesSelectChange = (event) => {
    setLesaoSelecionada(event.target.value)
  }

  const handlePartesSelectChange = (event) => {
    setParteSelecionada(event.target.value)
  }

  const adicionarLesaoSelecionada = () => {
    const valor = normalizeText(lesaoSelecionada)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentLesoes.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setLesaoSelecionada('')
      return
    }
    updateLesoes([...currentLesoes, valor])
    setLesaoSelecionada('')
  }

  const adicionarParteSelecionada = () => {
    const valor = normalizeText(parteSelecionada)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentPartes.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setParteSelecionada('')
      return
    }
    updatePartes([...currentPartes, valor])
    setParteSelecionada('')
  }

  const handleNovoAgenteKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      adicionarNovoAgente()
    }
  }

  const handleNovoTipoKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      adicionarNovoTipo()
    }
  }

  const handleNovoAgenteBlur = () => {
    if (normalizeText(novoAgente)) {
      adicionarNovoAgente()
    }
  }

  const handleNovoTipoBlur = () => {
    if (normalizeText(novoTipo)) {
      adicionarNovoTipo()
    }
  }

  const podeAdicionarLesao = Boolean(normalizeText(lesaoSelecionada))
  const podeAdicionarParte = Boolean(normalizeText(parteSelecionada))
  const podeAdicionarAgente = Boolean(normalizeText(novoAgente))
  const podeAdicionarTipo = Boolean(normalizeText(novoTipo))

  const matriculaPlaceholder = isLoadingPessoas ? 'Carregando matriculas...' : 'Selecione a matricula'
  const agentePlaceholder = isLoadingAgentes ? 'Carregando agentes...' : 'Selecione o agente'
  const tipoPlaceholder = isLoadingTipos
    ? 'Carregando tipos...'
    : form.agente
      ? 'Selecione o tipo'
      : 'Selecione o agente primeiro'
  const centroServicoPlaceholder = isLoadingPessoas
    ? 'Carregando centros...'
    : 'Selecione o centro de servico'
  const localPlaceholder = isLoadingLocais ? 'Carregando locais...' : 'Selecione o local do acidente'
  const lesoesPlaceholder = (() => {
    if (isLoadingLesoes && lesaoSelectOptions.length === 0) {
      return 'Carregando lesoes...'
    }
    if (lesaoSelectOptions.length === 0) {
      return 'Nenhuma lesao disponivel'
    }
    return 'Selecione a lesao'
  })()

  const partesPlaceholder = (() => {
    if (isLoadingPartes && parteSelectOptions.length === 0) {
      return 'Carregando partes...'
    }
    if (parteSelectOptions.length === 0) {
      return 'Nenhuma parte disponivel'
    }
    return 'Selecione a parte lesionada'
  })()

  const shouldDisableMatricula = isLoadingPessoas && pessoaOptions.length === 0
  const shouldDisableTipo = !form.agente && !form.tipo
  const shouldDisableCentroServico = isLoadingPessoas && centroServicoOptions.length === 0
  const shouldDisableLocal = isLoadingLocais && localOptions.length === 0
  const noLesoesDisponiveis = lesaoSelectOptions.length === 0
  const noPartesDisponiveis = parteSelectOptions.length === 0

  const shouldDisableLesoes = (isLoadingLesoes && noLesoesDisponiveis) || noLesoesDisponiveis
  const shouldDisablePartes = (isLoadingPartes && noPartesDisponiveis) || noPartesDisponiveis

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid form__grid--two">
        <label className="field">
          <span>Matricula <span className="asterisco">*</span></span>
          <select
            name="matricula"
            value={form.matricula}
            onChange={onChange}
            required
            disabled={shouldDisableMatricula}
          >
            <option value="">{matriculaPlaceholder}</option>
            {pessoaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nome <span className="asterisco">*</span></span>
          <input name="nome" value={form.nome} readOnly required placeholder="Fulano de Tal" />
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <input name="cargo" value={form.cargo} readOnly required placeholder="Operador" />
        </label>
        <label className="field">
          <span>Data <span className="asterisco">*</span></span>
          <input type="date" name="data" value={form.data} onChange={onChange} required />
        </label>
        <label className="field">
          <span>Dias Perdidos <span className="asterisco">*</span></span>
          <input
            type="number"
            min="0"
            step="1"
            name="diasPerdidos"
            value={form.diasPerdidos}
            onChange={onChange}
            placeholder="0"
            required
          />
        </label>
        <label className="field">
          <span>Dias Debitados <span className="asterisco">*</span></span>
          <input
            type="number"
            min="0"
            step="1"
            name="diasDebitados"
            value={form.diasDebitados}
            onChange={onChange}
            placeholder="0"
            required
          />
        </label>
        <label className="field">
          <span>HHT</span>
          <input
            type="number"
            min="0"
            step="1"
            name="hht"
            value={form.hht}
            onChange={onChange}
            placeholder="0"
            inputMode="numeric"
          />
        </label>
        <label className="field">
          <span>Tipo <span className="asterisco">*</span></span>
          <div className="select-with-actions">
            <select
              name="tipo"
              value={form.tipo}
              onChange={onChange}
              required
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
              <div className="multi-select__input">
                <input
                  value={novoTipo}
                  onChange={(event) => setNovoTipo(event.target.value)}
                  onKeyDown={handleNovoTipoKeyDown}
                  onBlur={handleNovoTipoBlur}
                  placeholder="Digite e pressione Enter para adicionar"
                  disabled={shouldDisableTipo || isLoadingTipos}
                />
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={adicionarNovoTipo}
                disabled={!podeAdicionarTipo || shouldDisableTipo}
              >
                Adicionar
              </button>
            </div>
          </div>
        </label>
        <label className="field">
          <span>Agente <span className="asterisco">*</span></span>
          <div className="select-with-actions">
            <select
              name="agente"
              value={form.agente}
              onChange={onChange}
              required
              disabled={isLoadingAgentes && agenteOptions.length === 0}
            >
              <option value="">{agentePlaceholder}</option>
              {agenteOptions.map((agente) => (
                <option key={agente} value={agente}>
                  {agente}
                </option>
              ))}
            </select>
            <div className="multi-select__actions">
              <div className="multi-select__input">
                <input
                  value={novoAgente}
                  onChange={(event) => setNovoAgente(event.target.value)}
                  onKeyDown={handleNovoAgenteKeyDown}
                  onBlur={handleNovoAgenteBlur}
                  placeholder="Digite e pressione Enter para adicionar"
                  disabled={isLoadingAgentes}
                />
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={adicionarNovoAgente}
                disabled={!podeAdicionarAgente}
              >
                Adicionar
              </button>
            </div>
          </div>
        </label>
        <label className="field">
          <span>CID</span>
          <input name="cid" value={form.cid} onChange={onChange} placeholder="S93" />
        </label>
        <label className="field">
          <span>Lesoes <span className="asterisco">*</span></span>
          <div className="multi-select">
            <select
              name="lesoes"
              value={lesaoSelecionada}
              onChange={handleLesoesSelectChange}
              required={!currentLesoes.length}
              disabled={shouldDisableLesoes}
            >
              <option value="">{lesoesPlaceholder}</option>
              {lesaoSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="multi-select__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={adicionarLesaoSelecionada}
                disabled={!podeAdicionarLesao || shouldDisableLesoes}
              >
                Adicionar
              </button>
            </div>
            <div className="multi-select__chips">
              {currentLesoes.length ? (
                currentLesoes.map((lesao) => (
                  <button
                    type="button"
                    key={lesao}
                    className="chip"
                    onClick={() => removerLesao(lesao)}
                    aria-label={`Remover ${lesao}`}
                  >
                    {lesao} <span aria-hidden="true">x</span>
                  </button>
                ))
              ) : (
                <span className="multi-select__placeholder">Nenhuma lesao adicionada</span>
              )}
            </div>
          </div>
          <input type="hidden" name="lesao" value={form.lesao} readOnly />
        </label>
        <label className="field">
          <span>Partes lesionadas <span className="asterisco">*</span></span>
          <div className="multi-select">
            <select
              name="partesLesionadas"
              value={parteSelecionada}
              onChange={handlePartesSelectChange}
              required={!currentPartes.length}
              disabled={shouldDisablePartes}
            >
              <option value="">{partesPlaceholder}</option>
              {parteSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="multi-select__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={adicionarParteSelecionada}
                disabled={!podeAdicionarParte || shouldDisablePartes}
              >
                Adicionar
              </button>
            </div>
            <div className="multi-select__chips">
              {currentPartes.length ? (
                currentPartes.map((parte) => (
                  <button
                    type="button"
                    key={parte}
                    className="chip"
                    onClick={() => removerParte(parte)}
                    aria-label={`Remover ${parte}`}
                  >
                    {parte} <span aria-hidden="true">x</span>
                  </button>
                ))
              ) : (
                <span className="multi-select__placeholder">Nenhuma parte adicionada</span>
              )}
            </div>
          </div>
        </label>
        <label className="field">
          <span>Centro de servico <span className="asterisco">*</span></span>
          <select
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            required
            disabled={shouldDisableCentroServico}
          >
            <option value="">{centroServicoPlaceholder}</option>
            {centroServicoOptions.map((centro) => (
              <option key={centro} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Local <span className="asterisco">*</span></span>
          <select
            name="local"
            value={form.local}
            onChange={onChange}
            required
            disabled={shouldDisableLocal}
          >
            <option value="">{localPlaceholder}</option>
            {localOptions.map((local) => (
              <option key={local} value={local}>
                {local}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>CAT</span>
          <input
            type="text"
            name="cat"
            value={form.cat}
            onChange={onChange}
            placeholder="000000"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </label>
      </div>
      {pessoasError ? <p className="feedback feedback--error">{pessoasError}</p> : null}
      {agentesError ? <p className="feedback feedback--error">{agentesError}</p> : null}
      {tiposError ? <p className="feedback feedback--error">{tiposError}</p> : null}
      {locaisError ? <p className="feedback feedback--error">{locaisError}</p> : null}
      {lesoesError ? <p className="feedback feedback--error">{lesoesError}</p> : null}
      {partesError ? <p className="feedback feedback--error">{partesError}</p> : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingAcidente ? 'Salvar alteracoes' : 'Registrar acidente'}
        </button>
        {editingAcidente ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  )
}
