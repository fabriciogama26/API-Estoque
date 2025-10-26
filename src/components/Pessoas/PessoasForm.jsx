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
          <span>Centro de servico <span className="asterisco">*</span></span>
          <input
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            required
            placeholder="Ex: Operacao"
          />
        </label>
        <label className="field">
          <span>Setor <span className="asterisco">*</span></span>
          <input name="setor" value={form.setor} onChange={onChange} required placeholder="Ex: Almoxarifado" />
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <input name="cargo" value={form.cargo} onChange={onChange} required placeholder="Tecnico de manutencao" />
        </label>
        <label className="field">
          <span>Data de admissao</span>
          <input
            type="date"
            name="dataAdmissao"
            value={form.dataAdmissao}
            onChange={onChange}
            placeholder="2025-01-01"
          />
        </label>
        <label className="field">
          <span>Tipo Execucao <span className="asterisco">*</span></span>
          <input
            name="tipoExecucao"
            value={form.tipoExecucao}
            onChange={onChange}
            required
            placeholder="Ex: Proprio, Terceirizado"
          />
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
