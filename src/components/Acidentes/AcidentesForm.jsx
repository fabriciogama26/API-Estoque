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
}) {
  const agenteOptions = Array.from(
    new Set([...(agentes || []), form.agente].filter(Boolean)),
  )
  const tipoOptions = Array.from(new Set([...(tipos || []), form.tipo].filter(Boolean)))
  const agenteListId = 'acidentes-agentes'
  const tipoListId = 'acidentes-tipos'
  const localListId = 'acidentes-locais'

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
          <span>Lesao <span className="asterisco">*</span></span>
          <input name="lesao" value={form.lesao} onChange={onChange} placeholder="Entorse" required />
        </label>
        <label className="field">
          <span>Parte Lesionada <span className="asterisco">*</span></span>
          <input name="parteLesionada" value={form.parteLesionada} onChange={onChange} placeholder="Tornozelo" required />
        </label>
        <label className="field">
          <span>Centro de servico <span className="asterisco">*</span></span>
          <input name="centroServico" value={form.centroServico} readOnly placeholder="Ex: Operacao" required />
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
