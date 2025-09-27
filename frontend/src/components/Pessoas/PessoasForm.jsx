export function PessoasForm({ form, onChange, onSubmit, isSaving, editingPessoa, onCancel, error }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid">
        <label className="field">
          <span>Nome <span className="asterisco">*</span></span>
          <input name="nome" value={form.nome} onChange={onChange} required placeholder="Joao Silva" />
        </label>
        <label className="field">
          <span>Matricula <span className="asterisco">*</span></span>
          <input name="matricula" value={form.matricula} onChange={onChange} required placeholder="12345" />
        </label>
        <label className="field">
          <span>Local <span className="asterisco">*</span></span>
          <input name="local" value={form.local} onChange={onChange} required placeholder="Unidade/Setor" />
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <input name="cargo" value={form.cargo} onChange={onChange} required placeholder="Tecnico de manutencao" />
        </label>
      </div>
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingPessoa ? 'Salvar alteracoes' : 'Salvar pessoa'}
        </button>
        {editingPessoa ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  )
}
