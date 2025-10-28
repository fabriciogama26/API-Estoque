import { useState } from 'react'

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
  const agenteOptions = Array.from(
    new Set([...(agentes || []), form.agente].filter(Boolean)),
  )
  const tipoOptions = Array.from(new Set([...(tipos || []), form.tipo].filter(Boolean)))
  const lesaoOptions = Array.isArray(lesoes) ? lesoes : []
  const parteOptions = Array.isArray(partes) ? partes : []
  const agenteListId = 'acidentes-agentes'
  const tipoListId = 'acidentes-tipos'
  const localListId = 'acidentes-locais'
  const lesaoListId = 'acidentes-lesoes'
  const parteListId = 'acidentes-partes'
  const centroServicoListId = 'acidentes-centros-servico'
  const centroServicoOptions = Array.from(
    new Set([...(centrosServico || []), form.centroServico].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  const [lesaoDraft, setLesaoDraft] = useState('')
  const [parteDraft, setParteDraft] = useState('')

  const currentLesoes =
    Array.isArray(form.lesoes) && form.lesoes.length
      ? form.lesoes
      : form.lesao
        ? [form.lesao]
        : []

  const lesaoSuggestions = (() => {
    const suggestions = []
    const seen = new Set()
    const add = (nome, label) => {
      const valor = (nome ?? '').trim()
      if (!valor) {
        return
      }
      const chave = valor.toLowerCase()
      if (seen.has(chave)) {
        return
      }
      seen.add(chave)
      suggestions.push({ nome: valor, label: (label ?? valor).trim() || valor })
    }
    lesaoOptions.forEach((item, index) => {
      if (typeof item === 'string') {
        add(item, item)
        return
      }
      if (item && typeof item === 'object') {
        const nome = item.nome ?? item.label ?? ''
        const label = item.label ?? nome ?? ''
        add(nome, label)
      }
    })
    currentLesoes.forEach((nome) => add(nome, nome))
    return suggestions
  })()

  const updateLesoes = (lista) => {
    onChange({ target: { name: 'lesoes', value: lista } })
    onChange({ target: { name: 'lesao', value: lista[0] ?? '' } })
  }

  const updatePartes = (lista) => {
    onChange({ target: { name: 'partesLesionadas', value: lista } })
  }

  const handleAddLesao = () => {
    const value = lesaoDraft.trim()
    if (!value) {
      return
    }
    const atual = currentLesoes
    if (atual.some((lesao) => lesao.toLowerCase() === value.toLowerCase())) {
      setLesaoDraft('')
      return
    }
    updateLesoes([...atual, value])
    setLesaoDraft('')
  }

  const handleLesaoKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      handleAddLesao()
    }
  }

  const handleRemoveLesao = (lesao) => {
    const atual = currentLesoes
    updateLesoes(atual.filter((item) => item !== lesao))
  }

  const handleLesaoBlur = () => {
    if (lesaoDraft.trim()) {
      handleAddLesao()
    }
  }

  const handleAddParte = () => {
    const value = parteDraft.trim()
    if (!value) {
      return
    }
    const atual = Array.isArray(form.partesLesionadas) ? form.partesLesionadas : []
    if (atual.some((parte) => parte.toLowerCase() === value.toLowerCase())) {
      setParteDraft('')
      return
    }
    updatePartes([...atual, value])
    setParteDraft('')
  }

  const handleParteKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      handleAddParte()
    }
  }

  const handleRemoveParte = (parte) => {
    const atual = Array.isArray(form.partesLesionadas) ? form.partesLesionadas : []
    updatePartes(atual.filter((item) => item !== parte))
  }

  const handleParteBlur = () => {
    if (parteDraft.trim()) {
      handleAddParte()
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid form__grid--two">
        <label className="field">
          <span>Matricula <span className="asterisco">*</span></span>
          <input
            name="matricula"
            value={form.matricula}
            onChange={onChange}
            list="acidentes-matriculas"
            placeholder="Digite ou selecione a matricula"
            required
            disabled={isLoadingPessoas}
            autoComplete="off"
            inputMode="numeric"
          />
          <datalist id="acidentes-matriculas">
            {pessoas.map((pessoa) => {
              const value =
                pessoa?.matricula !== undefined && pessoa?.matricula !== null
                  ? String(pessoa.matricula)
                  : ''
              if (!value) {
                return null
              }
              return (
                <option key={value} value={value}>
                  {value} - {pessoa?.nome ?? 'Sem nome'}
                </option>
              )
            })}
          </datalist>
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
          <input
            name="tipo"
            value={form.tipo}
            onChange={onChange}
            list={tipoListId}
            required
            disabled={!form.agente && !form.tipo}
            placeholder={
              isLoadingTipos
                ? 'Carregando tipos...'
                : form.agente
                  ? 'Digite ou selecione o tipo'
                  : 'Selecione o agente primeiro'
            }
            autoComplete="off"
          />
          <datalist id={tipoListId}>
            {tipoOptions.map((tipo) => (
              <option key={tipo} value={tipo} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Agente <span className="asterisco">*</span></span>
          <input
            name="agente"
            value={form.agente}
            onChange={onChange}
            list={agenteListId}
            required
            placeholder={
              isLoadingAgentes ? 'Carregando agentes...' : 'Digite ou selecione o agente'
            }
            autoComplete="off"
          />
          <datalist id={agenteListId}>
            {agenteOptions.map((agente) => (
              <option key={agente} value={agente} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>CID</span>
          <input name="cid" value={form.cid} onChange={onChange} placeholder="S93" />
        </label>
        <label className="field">
          <span>Lesoes <span className="asterisco">*</span></span>
          <div className="multi-select">
            <div className="multi-select__input">
              <input
                value={lesaoDraft}
                onChange={(event) => setLesaoDraft(event.target.value)}
                onKeyDown={handleLesaoKeyDown}
                onBlur={handleLesaoBlur}
                list={lesaoListId}
                placeholder={
                  isLoadingLesoes
                    ? 'Carregando lesoes...'
                    : 'Digite e pressione Enter para adicionar'
                }
                autoComplete="off"
              />
            </div>
            <div className="multi-select__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={handleAddLesao}
                disabled={!lesaoDraft.trim()}
              >
                Adicionar
              </button>
              <div className="multi-select__chips">
                {currentLesoes.length ? (
                  currentLesoes.map((lesao, index) => (
                    <button
                      type="button"
                      key={`${lesao}-${index}`}
                      className="chip"
                      aria-label={`Remover ${lesao}`}
                      onClick={() => handleRemoveLesao(lesao)}
                    >
                      {lesao} <span aria-hidden="true">x</span>
                    </button>
                  ))
                ) : (
                  <span className="multi-select__placeholder">Nenhuma lesao adicionada</span>
                )}
              </div>
            </div>
          </div>
          <input type="hidden" name="lesao" value={form.lesao} readOnly />
          <datalist id={lesaoListId}>
            {lesaoSuggestions.map((item, index) => (
              <option key={`${item.nome}-${index}`} value={item.nome} label={item.label} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Partes lesionadas <span className="asterisco">*</span></span>
          <div className="multi-select">
            <div className="multi-select__input">
              <input
                value={parteDraft}
                onChange={(event) => setParteDraft(event.target.value)}
                onKeyDown={handleParteKeyDown}
                onBlur={handleParteBlur}
                list={parteListId}
                placeholder={
                  isLoadingPartes ? 'Carregando partes...' : 'Digite e pressione Enter para adicionar'
                }
                autoComplete="off"
              />
            </div>
            <div className="multi-select__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={handleAddParte}
                disabled={!parteDraft.trim()}
              >
                Adicionar
              </button>
              <div className="multi-select__chips">
                {Array.isArray(form.partesLesionadas) && form.partesLesionadas.length
                  ? form.partesLesionadas.map((parte, index) => (
                      <button
                        type="button"
                        key={`${parte}-${index}`}
                        className="chip"
                        aria-label={`Remover ${parte}`}
                        onClick={() => handleRemoveParte(parte)}
                      >
                        {parte} <span aria-hidden="true">x</span>
                      </button>
                    ))
                  : <span className="multi-select__placeholder">Nenhuma parte adicionada</span>}
              </div>
            </div>
          </div>
          <datalist id={parteListId}>
            {parteOptions.map((parte, index) => {
              if (!parte) {
                return null
              }
              if (typeof parte === 'string') {
                return <option key={`${parte}-${index}`} value={parte} />
              }
              const nome = parte.nome ?? ''
              const label = parte.label ?? nome
              const key = `${nome}-${parte.subgrupo ?? ''}-${index}`
              return <option key={key} value={nome} label={label} />
            })}
          </datalist>
        </label>
        <label className="field">
          <span>Centro de servico <span className="asterisco">*</span></span>
          <input
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            list={centroServicoListId}
            required
            placeholder={
              isLoadingPessoas
                ? 'Carregando centros...'
                : 'Digite ou selecione o centro de servico'
            }
            autoComplete="off"
          />
          <datalist id={centroServicoListId}>
            {centroServicoOptions.map((centro) => (
              <option key={centro} value={centro} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Local <span className="asterisco">*</span></span>
          <input
            name="local"
            value={form.local}
            onChange={onChange}
            list={localListId}
            required
            placeholder={
              isLoadingLocais
                ? 'Carregando locais...'
                : 'Digite ou selecione o local do acidente'
            }
            autoComplete="off"
          />
          <datalist id={localListId}>
            {locais.map((local) => (
              <option key={local} value={local} />
            ))}
          </datalist>
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
