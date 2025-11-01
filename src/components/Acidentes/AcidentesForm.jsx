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

  const agenteOptions = Array.from(
    new Set([...(agentes || []), form.agente].map(normalizeText).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const tipoOptions = Array.from(
    new Set([...(tipos || []), form.tipo].map(normalizeText).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

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

  const handleLesoesSelectChange = (event) => {
    const selecionadas = Array.from(event.target.selectedOptions || []).map((option) => option.value)
    updateLesoes(selecionadas)
  }

  const handlePartesSelectChange = (event) => {
    const selecionadas = Array.from(event.target.selectedOptions || []).map((option) => option.value)
    updatePartes(selecionadas)
  }

  const multiSelectSize = (lista) => {
    const quantidade = Array.isArray(lista) ? lista.length : 0
    if (quantidade === 0) {
      return 3
    }
    return Math.min(6, Math.max(3, quantidade))
  }

  const lesoesSelectSize = multiSelectSize(lesaoSelectOptions)
  const partesSelectSize = multiSelectSize(parteSelectOptions)

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
  const lesoesPlaceholder = isLoadingLesoes ? 'Carregando lesoes...' : 'Selecione as lesoes'
  const partesPlaceholder = isLoadingPartes ? 'Carregando partes...' : 'Selecione as partes lesionadas'

  const shouldDisableMatricula = isLoadingPessoas && pessoaOptions.length === 0
  const shouldDisableTipo = !form.agente && !form.tipo
  const shouldDisableCentroServico = isLoadingPessoas && centroServicoOptions.length === 0
  const shouldDisableLocal = isLoadingLocais && localOptions.length === 0
  const shouldDisableLesoes = isLoadingLesoes && lesaoSelectOptions.length === 0
  const shouldDisablePartes = isLoadingPartes && parteSelectOptions.length === 0

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
        </label>
        <label className="field">
          <span>Agente <span className="asterisco">*</span></span>
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
        </label>
        <label className="field">
          <span>CID</span>
          <input name="cid" value={form.cid} onChange={onChange} placeholder="S93" />
        </label>
        <label className="field">
          <span>Lesoes <span className="asterisco">*</span></span>
          <select
            name="lesoes"
            value={currentLesoes}
            onChange={handleLesoesSelectChange}
            multiple
            required
            size={lesoesSelectSize}
            disabled={shouldDisableLesoes}
          >
            {lesaoSelectOptions.length === 0 ? (
              <option value="" disabled>
                {lesoesPlaceholder}
              </option>
            ) : null}
            {lesaoSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="lesao" value={form.lesao} readOnly />
        </label>
        <label className="field">
          <span>Partes lesionadas <span className="asterisco">*</span></span>
          <select
            name="partesLesionadas"
            value={currentPartes}
            onChange={handlePartesSelectChange}
            multiple
            required
            size={partesSelectSize}
            disabled={shouldDisablePartes}
          >
            {parteSelectOptions.length === 0 ? (
              <option value="" disabled>
                {partesPlaceholder}
              </option>
            ) : null}
            {parteSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
