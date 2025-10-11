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
}) {
  const hasMatriculaOption = pessoas.some(
    (pessoa) => pessoa?.matricula !== undefined && String(pessoa.matricula) === form.matricula,
  )

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
            disabled={isLoadingPessoas}
          >
            <option value="">Selecione uma matricula</option>
            {pessoas.map((pessoa) => {
              const value = pessoa?.matricula !== undefined && pessoa?.matricula !== null
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
            {!hasMatriculaOption && form.matricula ? (
              <option value={form.matricula}>{form.matricula}</option>
            ) : null}
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
            name="diasDebitados"
            value={form.diasDebitados}
            onChange={onChange}
            placeholder="0"
            required
          />
        </label>
        <label className="field">
          <span>Tipo <span className="asterisco">*</span></span>
          <input name="tipo" value={form.tipo} onChange={onChange} placeholder="Queda" required />
        </label>
        <label className="field">
          <span>Agente <span className="asterisco">*</span></span>
          <input name="agente" value={form.agente} onChange={onChange} placeholder="Equipamento" required />
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
          <input name="local" value={form.local} readOnly placeholder="Linha 1" required />
        </label>
        <label className="field">
          <span>CAT</span>
          <input name="cat" value={form.cat} onChange={onChange} placeholder="000000" />
        </label>
      </div>
      {pessoasError ? <p className="feedback feedback--error">{pessoasError}</p> : null}
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
